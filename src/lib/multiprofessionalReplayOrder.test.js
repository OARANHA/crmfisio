import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const root = process.cwd();
const migrationsDir = path.join(root, 'supabase-migrations');
const legacySolo = '20260907_solo_owner_clinical_identity.sql';
const canonicalReplay = '20260908_multiprofessional_replay_canonicalization.sql';

const readMigration = (name) => fs.readFileSync(path.join(migrationsDir, name), 'utf8');

test('canonical replay migration sorts after the legacy solo bridge', () => {
  const ordered = fs.readdirSync(migrationsDir).filter((name) => name.endsWith('.sql')).sort();
  assert.ok(ordered.indexOf(legacySolo) >= 0, 'legacy solo migration must remain visible until retired deliberately');
  assert.ok(ordered.indexOf(canonicalReplay) > ordered.indexOf(legacySolo), 'canonical replay guard must execute after the legacy solo migration');
});

test('canonical replay guard reasserts generic clinical boundaries', () => {
  const sql = readMigration(canonicalReplay);
  assert.match(sql, /current_user_has_clinical_capability\('clinical\.assessment\.apply'\)/i);
  assert.match(sql, /current_user_has_clinical_capability\('clinical\.evolution\.write'\)/i);
  assert.match(sql, /current_user_has_clinical_capability\('clinical\.body_map'\)/i);
  assert.match(sql, /v_role\s*=\s*'professional'/i);
  assert.match(sql, /app_role\s*=\s*'professional'/i);
  assert.match(sql, /legacy_fisio_role_reintroduced_after_canonical_cutover/i);

  const statusGuard = sql.match(/create or replace function public\.guard_appointment_status_transition\(\)[\s\S]*?\$\$;/i)?.[0] ?? '';
  assert.doesNotMatch(statusGuard, /app_role\s*=\s*'fisio'/i);
});
