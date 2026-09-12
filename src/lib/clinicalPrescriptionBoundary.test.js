import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(resolve(here, './clinicalPrescription.ts'), 'utf8');
const rendererSource = readFileSync(resolve(here, './prescriptionPrintRenderer.ts'), 'utf8');
const templatesSource = readFileSync(resolve(here, './clinicalDocumentTemplates.ts'), 'utf8');
const workspaceSource = readFileSync(resolve(here, '../components/ClinicalPrescriptionWorkspace.tsx'), 'utf8');
const previewSource = readFileSync(resolve(here, '../components/PrescriptionDocumentPreview.tsx'), 'utf8');
const professionalIdentitySource = readFileSync(resolve(here, '../hooks/useProfessionalIdentity.ts'), 'utf8');
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

  it('uses the shared safe renderer for live preview without print or RPC side effects', () => {
    expect(workspaceSource).toContain('renderDefinition={previewRenderDefinition} clinic={clinic}');
    expect(previewSource).toContain('buildPrescriptionDocumentHtml({');
    expect(previewSource).toContain("mode: 'draft'");
    expect(previewSource).toContain('srcDoc={html}');
    expect(previewSource).toContain('sandbox=""');
    expect(previewSource).toContain('data-prescription-live-preview="draft"');
    expect(previewSource).toContain('Rascunho · não emitida');
    expect(previewSource).not.toContain('db.rpc(');
    expect(previewSource).not.toContain('window.print');
    expect(previewSource).not.toContain('document.write');
  });

  it('feeds canonical patient, clinic and authenticated professional identity into the draft renderer', () => {
    expect(previewSource).toContain('patient.preferredName || patient.nome');
    expect(previewSource).toContain('birthDate: patient.nascimento');
    expect(previewSource).toContain("name: clinic.name || 'Clínica'");
    expect(previewSource).toContain('address: clinic.address');
    expect(previewSource).toContain('phone: clinic.phone');
    expect(previewSource).toContain('const { user } = useCurrentUserAccess()');
    expect(previewSource).toContain("name: user?.nome || 'Profissional responsável'");
    expect(previewSource).toContain('registration: user?.registro');
    expect(previewSource).toContain('councilType: identity?.councilType');
    expect(previewSource).toContain('councilState: identity?.councilState');
    expect(previewSource).toContain('specialty: identity?.specialty');
    expect(professionalIdentitySource).toContain(".select('professional_type, especialidade, council_type, council_state')");
  });

  it('keeps specialty in the published template variable contract when the renderer can display it', () => {
    expect(templatesSource).toContain("'issuer.specialty'");
    expect(templatesSource).toContain('p_variables_contract: DEFAULT_VARIABLES_CONTRACT');
  });

  it('prints only the immutable issued payload/context/template renderer snapshots', () => {
    expect(workspaceSource).toContain("document.status !== 'issued' || !document.payloadSnapshot");
    expect(workspaceSource).toContain('payload: document.payloadSnapshot');
    expect(workspaceSource).toContain('buildPrescriptionRenderContextFromSnapshot(document.contextSnapshot');
    expect(workspaceSource).toContain('prescriptionDocumentRenderDefinition(document)');
    expect(workspaceSource).toContain("mode: 'issued'");
    expect(clientSource).toContain('template_definition_snapshot');
    expect(clientSource).toContain('templateDefinitionSnapshot');
    expect(workspaceSource).not.toContain('template.definition');
  });

  it('keeps the renderer closed and escapes all dynamic text', () => {
    expect(rendererSource).toContain("PRESCRIPTION_RENDER_LAYOUT_V2 = 'clinical-document/prescription-v2'");
    expect(rendererSource).toContain("type PrescriptionPrintPreset = 'classic' | 'institutional' | 'compact'");
    expect(rendererSource).toContain('escapeHtml(item.medicationName');
    expect(rendererSource).toContain('escapeHtml(context.patient.name');
    expect(rendererSource).not.toContain('dangerouslySetInnerHTML');
    expect(rendererSource).not.toContain('eval(');
  });

  it('resumes an existing draft with its exact template-version renderer instead of the current template', () => {
    expect(clientSource).toContain('loadMedicationPrescriptionTemplateRenderDefinition');
    expect(workspaceSource).toContain('loadMedicationPrescriptionTemplateRenderDefinition(draft.templateVersionId)');
    expect(workspaceSource).toContain('setActiveRenderDefinition(renderDefinition)');
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