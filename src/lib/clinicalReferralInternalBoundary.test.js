import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const client = read('./clinicalReferral.ts');
const workspace = read('../components/ClinicalReferralWorkspace.tsx');
const migration = read('../../supabase-migrations/20260912_clinical_referral_internal_v1.sql');
const hardening = read('../../supabase-migrations/20260913_clinical_referral_internal_v1_hardening.sql');
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
    expect(hardening).toContain('p.clinic_id = v_clinic_id');
    expect(hardening).toContain('p.ativo IS TRUE');
    expect(hardening).toContain('p.id IS DISTINCT FROM auth.uid()');
    expect(workspace).not.toContain("from('profiles')");
  });

  it('routes only to canonical clinical professions and never re-couples role with profession', () => {
    expect(hardening).toContain("'medico'");
    expect(hardening).toContain("'fisioterapeuta'");
    expect(hardening).toContain("'psicologo'");
    expect(hardening).toContain("'quiropraxista'");
    expect(hardening).not.toContain("p.role = 'professional'");
    expect(hardening).not.toContain("p.role='professional'");
  });

  it('fails closed for invalid internal professional and service targets without granting care access', () => {
    expect(hardening).toContain('clinical_referral_target_invalid');
    expect(hardening).toContain('clinical_referral_internal_service_invalid');
    expect(hardening).toContain('p.clinic_id = NEW.clinic_id');
    expect(hardening).toContain("NEW.status = 'issued'");
    expect(hardening).not.toContain('can_access_patient_clinical_record');
    expect(hardening).not.toContain('clinic_owners');
    expect(hardening).not.toContain('platform_admin');
    expect(workspace).toContain('não concede acesso ao prontuário');
  });

  it('does not display the clinic itself as a selected internal destination before a real choice', () => {
    expect(workspace).toContain("facility: '', contact: ''");
  });

  it('never exposes the stable internal target id in the patient-facing renderer', () => {
    expect(renderer).not.toContain('targetProfileId');
    expect(renderer).not.toContain('target_profile_id');
    expect(renderer).not.toContain('destination_scope');
  });
});
