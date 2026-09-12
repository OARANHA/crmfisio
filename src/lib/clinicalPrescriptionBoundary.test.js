import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(resolve(here, './clinicalPrescription.ts'), 'utf8');
const workspaceSource = readFileSync(resolve(here, '../components/ClinicalPrescriptionWorkspace.tsx'), 'utf8');
const previewSource = readFileSync(resolve(here, '../components/PrescriptionDocumentPreview.tsx'), 'utf8');
const encounterSource = readFileSync(resolve(here, '../components/ClinicalEncounterWorkspaceV4.tsx'), 'utf8');

describe('Clinical Prescription V1 boundary', () => {
  it('reuses the four D2-A lifecycle RPCs instead of writing protected tables directly', () => {
    expect(clientSource).toContain("db.rpc('create_clinical_document_draft'");
    expect(clientSource).toContain("db.rpc('save_clinical_document_draft'");
    expect(clientSource).toContain("db.rpc('issue_clinical_document'");
    expect(clientSource).toContain("db.rpc('cancel_clinical_document'");
    expect(clientSource).not.toContain(".from('clinical_documents').insert");
    expect(clientSource).not.toContain(".from('clinical_documents').update");
    expect(clientSource).not.toContain(".from('clinical_documents').delete");
  });

  it('keeps server eligibility authoritative for medication prescriptions', () => {
    expect(clientSource).toContain("db.rpc('current_user_can_issue_clinical_document'");
    expect(clientSource).toContain("p_document_type: 'medication_prescription'");
    expect(workspaceSource).toContain('const canIssue = await canIssueMedicationPrescription()');
    expect(workspaceSource).toContain('if (!eligible)');
  });

  it('keeps draft save separate from explicit human issue confirmation', () => {
    expect(workspaceSource).toContain('Salvar rascunho não emite a receita. Emitir é uma ação separada que torna esta versão imutável.');
    expect(workspaceSource).toContain('Revisão humana obrigatória');
    expect(workspaceSource).toContain('Confirmar e emitir');
    expect(workspaceSource).toContain('saveMedicationPrescriptionDraft(');
    expect(workspaceSource).toContain('issueMedicationPrescription(');
    expect(workspaceSource).not.toContain('setInterval(');
  });

  it('keeps the live preview presentation-only and explicitly non-issued', () => {
    expect(workspaceSource).toContain('<PrescriptionDocumentPreview patient={patient} payload={payload} />');
    expect(previewSource).toContain('data-prescription-live-preview="draft"');
    expect(previewSource).toContain('Rascunho · não emitida');
    expect(previewSource).toContain('Sem validade até a emissão');
    expect(previewSource).toContain('Pré-visualização de rascunho · documento não emitido');
    expect(previewSource).toContain('payload.items.filter');
    expect(previewSource).not.toContain("db.rpc(");
    expect(previewSource).not.toContain('window.print');
    expect(previewSource).not.toContain('document.write');
  });

  it('uses canonical patient and authenticated professional data in the live preview', () => {
    expect(previewSource).toContain('patient.preferredName || patient.nome');
    expect(previewSource).toContain('formatDateOnly(patient.nascimento)');
    expect(previewSource).toContain('const { user } = useCurrentUserAccess()');
    expect(previewSource).toContain("const professionalName = user?.nome || 'Profissional responsável'");
    expect(previewSource).toContain("const professionalRegistration = user?.registro || ''");
  });

  it('prints only the immutable issued snapshot and its frozen professional identity', () => {
    expect(workspaceSource).toContain("document.status !== 'issued' || !document.payloadSnapshot");
    expect(workspaceSource).toContain('document.payloadSnapshot.items');
    expect(workspaceSource).toContain("const issuerCredential = snapshotIssuerCredential(document.contextSnapshot)");
    expect(workspaceSource).toContain('issuer.council_type');
    expect(workspaceSource).toContain('issuer.council_state');
    expect(workspaceSource).toContain('issuer.registro');
    expect(workspaceSource).not.toContain('template.definition');
  });

  it('isolates local draft state by patient, canonical encounter and authenticated user', () => {
    expect(workspaceSource).toContain('const contextKey = `${props.patient.id}:${props.encounter.id}:${props.userId}`');
    expect(workspaceSource).toContain('<ClinicalPrescriptionWorkspaceContext key={contextKey} {...props} />');
  });

  it('separates documents from this encounter from prior longitudinal history', () => {
    expect(workspaceSource).toContain('document.appointmentId === encounter.id');
    expect(workspaceSource).toContain('document.appointmentId !== encounter.id');
    expect(workspaceSource).toContain('title="Histórico anterior"');
  });

  it('integrates prescription as navigation inside the same canonical Encounter', () => {
    expect(encounterSource).toContain("'prescription' | 'nexus'");
    expect(encounterSource).toContain("['prescription', 'Prescrição']");
    expect(encounterSource).toContain("useClinicalCapability('clinical.documents'");
    expect(encounterSource).toContain('<ClinicalPrescriptionWorkspace patient={patient} encounter={canonicalEncounter} userId={user.id} />');
  });

  it('uses profession only for presentation relevance, not for authorization', () => {
    expect(encounterSource).toContain('const prescriptionRelevant = isPhysicianProfessionalType(identity?.professionalType);');
    expect(workspaceSource).toContain('canIssueMedicationPrescription');
    expect(workspaceSource).not.toContain('isPhysicianProfessionalType');
  });

  it('does not couple Prescription V1 to Nexus', () => {
    expect(workspaceSource).not.toContain('Nexus');
    expect(previewSource).not.toContain('Nexus');
    expect(clientSource).not.toContain('nexus.');
  });
});
