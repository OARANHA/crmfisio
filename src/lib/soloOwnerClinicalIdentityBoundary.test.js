import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(new URL('../../supabase-migrations/20260907_solo_owner_clinical_identity.sql', import.meta.url)),
  'utf8',
);

describe('solo owner clinical identity boundary', () => {
  it('does not create a synthetic solo role or make every manager clinical', () => {
    expect(migration).not.toContain("role = 'solo'");
    expect(migration).toContain("v_role NOT IN ('owner', 'admin')");
    expect(migration).toContain("v_council_type = 'crefito'");
    expect(migration).toContain("v_registration <> ''");
  });

  it('keeps clinical authorship self-bound', () => {
    expect(migration).toContain('professional_id = auth.uid()');
    expect(migration).toContain('OLD.fisio_id IS DISTINCT FROM auth.uid()');
    expect(migration).toContain('NEW.fisio_id IS DISTINCT FROM auth.uid()');
  });

  it('requires an authored evolution for the exact session before finalization', () => {
    expect(migration).toContain('e.session_id = NEW.id');
    expect(migration).toContain('e.professional_id = auth.uid()');
    expect(migration).toContain('clinical_evolution_required_before_finalize');
  });

  it('does not touch Nexus capability or medical entitlement functions', () => {
    expect(migration).not.toContain('CREATE OR REPLACE FUNCTION public.current_nexus_medical_identity_valid');
    expect(migration).not.toContain('CREATE OR REPLACE FUNCTION public.current_nexus_entitlement_allowed');
    expect(migration).not.toContain('CREATE OR REPLACE FUNCTION public.has_professional_capability');
  });
});
