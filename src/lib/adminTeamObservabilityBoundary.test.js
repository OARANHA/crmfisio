import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const teamAdmin = read('../components/TeamAdmin.tsx');
const normalizer = read('./adminTeamFunctionError.ts');
const edge = read('../../supabase/functions/admin-team/index.ts');
const nexusFoundation = read('../../supabase-migrations/20260903_nexus_wave0_foundation.sql');

describe('admin-team observability boundary', () => {
  it('reads non-2xx JSON through the FunctionsHttpError response context', () => {
    expect(teamAdmin).toContain('resolveAdminTeamFunctionError(error, fallback)');
    expect(normalizer).toContain("const context = (error as { context?: unknown }).context");
    expect(normalizer).toContain('await readable.json()');
    expect(teamAdmin).not.toContain('if (error) throw error');
  });

  it('only surfaces explicitly safe server messages', () => {
    expect(teamAdmin).toContain('safeAdminTeamServerMessage(data.error) ?? fallback');
    expect(normalizer).toContain('SAFE_ADMIN_TEAM_MESSAGES.has(message)');
    expect(normalizer).not.toContain('error.message');
  });

  it('keeps unknown Edge failures internal and returns a generic 500 response', () => {
    expect(edge).toContain("console.error('[admin-team]', error)");
    expect(edge).toContain("return json({ error: 'Falha ao gerenciar equipe' }, 500)");
    expect(edge).not.toContain("error instanceof Error ? error.message : 'Falha ao gerenciar equipe'");
  });

  it('keeps the capability upsert conflict target aligned with the schema unique key', () => {
    expect(nexusFoundation).toMatch(/UNIQUE\s*\(professional_id,\s*capability_key\)/i);
    expect(edge).toContain("onConflict: 'professional_id,capability_key'");
    expect(edge).not.toContain("onConflict: 'clinic_id,professional_id,capability_key'");
  });
});
