import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const workspace = source('../components/ClinicalWorkspace.tsx');
const repository = source('./repository.ts');
const consentMigration = source('../../supabase-migrations/20260901_consent_accept_autofill.sql');

describe('patient consent collection boundary', () => {
  it('keeps consent acceptance on its dedicated server-side RPC', () => {
    expect(repository).toContain("rpc('accept_patient_consent', {");
    expect(repository).toContain('p_consent_id: id');
    expect(consentMigration).toContain('accept_patient_consent(p_consent_id uuid)');
    expect(consentMigration).toContain('accept_patient_consent_not_allowed');
    expect(consentMigration).toContain("'recep'");
  });

  it('preserves reception collection without granting clinical.documents', () => {
    expect(workspace).toContain("const canCollectConsent = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'recep';");
    expect(workspace).toContain('!term.assinado && canCollectConsent');
    expect(workspace).not.toContain("useClinicalCapability('clinical.documents'");
    expect(workspace).not.toContain('canManageClinicalDocuments');
  });
});
