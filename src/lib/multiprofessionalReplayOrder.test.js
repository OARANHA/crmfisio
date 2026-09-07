import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const migrationsDir = path.join(root, 'supabase-migrations');
const legacySolo = '20260907_solo_owner_clinical_identity.sql';
const canonicalReplay = '20260908_multiprofessional_replay_canonicalization.sql';

const readMigration = (name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8');

describe('multiprofessional migration replay order', () => {
  it('sorts the canonical replay guard after the legacy solo bridge', () => {
    const ordered = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
    expect(ordered.indexOf(legacySolo)).toBeGreaterThanOrEqual(0);
    expect(ordered.indexOf(canonicalReplay)).toBeGreaterThan(ordered.indexOf(legacySolo));
  });

  it('reasserts generic clinical boundaries after the legacy migration', () => {
    const sql = readMigration(canonicalReplay);
    expect(sql).toMatch(/current_user_has_clinical_capability\('clinical\.assessment\.apply'\)/i);
    expect(sql).toMatch(/current_user_has_clinical_capability\('clinical\.evolution\.write'\)/i);
    expect(sql).toMatch(/current_user_has_clinical_capability\('clinical\.body_map'\)/i);
    expect(sql).toMatch(/v_role\s*=\s*'professional'/i);
    expect(sql).toMatch(/app_role\s*=\s*'professional'/i);
    expect(sql).toMatch(/legacy_fisio_role_reintroduced_after_canonical_cutover/i);

    const statusGuard = sql.match(/create or replace function public\.guard_appointment_status_transition\(\)[\s\S]*?\$\$;/i)?.[0] ?? '';
    expect(statusGuard).not.toMatch(/app_role\s*=\s*'fisio'/i);
  });
});
