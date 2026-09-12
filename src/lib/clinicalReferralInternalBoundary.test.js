import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const client = read('./clinicalReferral.ts');
const workspace = read('../components/ClinicalReferralWorkspace.tsx');
const migration = read('../../supabase-migrations/20260912_clinical_referral_internal_v1.sql');
const renderer = read('./referralPrintRenderer.ts');

describe('D2-E3 Internal Referral V1 boundary', () => {
  it('keeps one canonical referral document and adds routing metadata without a parallel engine', () => {
    expect(client).toContain("destination_scope");
    expect(client).toContain("target_profile_id");
    expect(client).toContain("db.rpc('create_clinical_document_draft'");
    expect(client).toContain("db.rpc('issue_clinical_document'");
    expect(client).not.toContain('.insert(');
  });

  it('offers internal professional, internal service and external destinations as human choices', () => {
    expect(workspace).toContain('Profissional da clínica');
    expect(workspace).toContain('Especialidade / serviço');
    expect(workspace).toContain('Destino externo');
    expect(workspace).toContain('loadReferralInternalTargets');
    expect(workspace).toContain('targetProfileId');
  });

  it('loads only a narrow server-governed same-clinic professional directory', () => {
    expect(client).toContain("db.rpc('list_clinical_referral_internal_targets'");
    expect(migration).toContain("current_user_can_issue_clinical_document('referral')");
    expect(migration).toContain('p.clinic_id = v_clinic_id');
    expect(migration).toContain('p.ativo IS TRUE');
    expect(migration).toContain('p.id IS DISTINCT FROM auth.uid()');
    expect(workspace).not.toContain("from('profiles')");
  });

  it('fails closed for invalid internal professional targets without granting care access', () => {
    expect(migration).toContain('clinical_referral_target_invalid');
    expect(migration).toContain('p.clinic_id = NEW.clinic_id');
    expect(migration).toContain("NEW.status = 'issued'");
    expect(migration).not.toContain('can_access_patient_clinical_record');
    expect(migration).not.toContain('clinic_owners');
    expect(migration).not.toContain('platform_admin');
    expect(workspace).toContain('não concede acesso ao prontuário');
  });

  it('never exposes the stable internal target id in the patient-facing renderer', () => {
    expect(renderer).not.toContain('targetProfileId');
    expect(renderer).not.toContain('target_profile_id');
    expect(renderer).not.toContain('destination_scope');
  });
});
