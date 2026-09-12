import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const client = read('./clinicalReferral.ts');
const workspace = read('../components/ClinicalReferralWorkspace.tsx');
const encounter = read('../components/ClinicalEncounterWorkspaceV4.tsx');

describe('Clinical Referral Encounter V1 boundary', () => {
  it('uses referral as a first-class D2-A Clinical Documents type', () => {
    expect(client).toContain("p_document_type: 'referral'");
    expect(client).toContain(".eq('document_type', 'referral')");
    expect(client).toContain("db.rpc('create_clinical_document_draft'");
    expect(client).toContain("db.rpc('save_clinical_document_draft'");
    expect(client).toContain("db.rpc('issue_clinical_document'");
    expect(client).toContain("db.rpc('cancel_clinical_document'");
    expect(client).not.toContain(".insert(");
    expect(client).not.toContain(".update(");
  });

  it('rechecks server eligibility instead of treating UI visibility as authorization', () => {
    expect(client).toContain("current_user_can_issue_clinical_document");
    expect(workspace).toContain('const canIssue = await canIssueReferral();');
    expect(workspace).toContain('A autorização permanece definida pelo servidor.');
  });

  it('binds draft provenance to patient + canonical encounter + current issuer', () => {
    expect(workspace).toContain('const contextKey = `${props.patient.id}:${props.encounter.id}:${props.userId}`');
    expect(workspace).toContain("document.status === 'draft'");
    expect(workspace).toContain('document.appointmentId === encounter.id');
    expect(workspace).toContain('document.issuerId === userId');
    expect(workspace).toContain('createReferralDraft(encounter.id, selectedTemplateVersionId');
  });

  it('requires an explicit human review before issue', () => {
    expect(workspace).toContain('Revisar encaminhamento');
    expect(workspace).toContain('Revisão humana obrigatória');
    expect(workspace).toContain('Confirmar emissão');
    expect(workspace).toContain('issueReferral(documentToIssue.id)');
  });

  it('renders only a non-valid content preview until the professional A4 slice exists', () => {
    expect(workspace).toContain('Prévia de conteúdo');
    expect(workspace).toContain('Sem validade');
    expect(workspace).toContain('A composição A4 profissional será publicada na próxima slice.');
    expect(workspace).not.toContain('window.print');
  });

  it('reads issued history from immutable snapshots when available', () => {
    expect(workspace).toContain('document.payloadSnapshot ?? document.payload');
    expect(workspace).toContain('Conteúdo emitido preservado em snapshot');
  });

  it('keeps recipient, reason and requested action structured without Nexus automation', () => {
    expect(client).toContain('professional_name');
    expect(client).toContain('professional_type');
    expect(client).toContain('clinical_summary');
    expect(client).toContain('requested_action');
    expect(workspace).not.toContain('nexus.');
    expect(workspace).not.toContain('Nexus');
  });

  it('integrates a human Encaminhamento workspace into the active Encounter', () => {
    expect(encounter).toContain("['referral', 'Encaminhamento']");
    expect(encounter).toContain("workspace === 'referral'");
    expect(encounter).toContain('<ClinicalReferralWorkspace');
    expect(encounter).not.toContain('title="referral"');
  });
});
