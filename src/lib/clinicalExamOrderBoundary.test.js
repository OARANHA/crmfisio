import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(resolve(here, './clinicalExamOrder.ts'), 'utf8');
const workspaceSource = readFileSync(resolve(here, '../components/ClinicalExamOrderWorkspace.tsx'), 'utf8');
const encounterSource = readFileSync(resolve(here, '../components/ClinicalEncounterWorkspaceV4.tsx'), 'utf8');

describe('Clinical Exam Order D2-D1/D2-D2 boundary', () => {
  it('keeps D2-A lifecycle and server eligibility as the authority', () => {
    expect(clientSource).toContain("db.rpc('current_user_can_issue_clinical_document'");
    expect(clientSource).toContain("p_document_type: 'exam_order'");
    expect(clientSource).toContain("db.rpc('create_clinical_document_draft'");
    expect(clientSource).toContain("db.rpc('save_clinical_document_draft'");
    expect(clientSource).toContain("db.rpc('issue_clinical_document'");
    expect(clientSource).toContain("db.rpc('cancel_clinical_document'");
    expect(clientSource).not.toContain(".from('clinical_documents').insert");
    expect(clientSource).not.toContain(".from('clinical_documents').update");
  });

  it('keeps a dedicated human Exames workspace in the active Encounter', () => {
    expect(encounterSource).toContain("import { ClinicalExamOrderWorkspace } from './ClinicalExamOrderWorkspace';");
    expect(encounterSource).toContain("['exams', 'Exames']");
    expect(encounterSource).toContain("workspace === 'exams'");
    expect(encounterSource).toContain('<ClinicalExamOrderWorkspace');
    expect(encounterSource).toContain('Pedido de exames');
  });

  it('keeps frontend presentation separate from authorization', () => {
    expect(workspaceSource).toContain('const canIssue = await canIssueExamOrder();');
    expect(workspaceSource).toContain('if (!eligible)');
    expect(encounterSource).toContain("useClinicalCapability('clinical.documents'");
    expect(workspaceSource).not.toContain('owner');
    expect(workspaceSource).not.toContain('admin');
  });

  it('supports structured multiple-exam drafts with explicit human review', () => {
    expect(workspaceSource).toContain('+ Adicionar exame');
    expect(workspaceSource).toContain('Indicação clínica');
    expect(workspaceSource).toContain('Hipótese / impressão clínica');
    expect(workspaceSource).toContain('Prioridade do pedido');
    expect(workspaceSource).toContain('Revisar pedido');
    expect(workspaceSource).toContain('Confirmar emissão');
    expect(workspaceSource).toContain('Emitir pedido');
  });

  it('shows and prints issued history from immutable snapshots', () => {
    expect(workspaceSource).toContain('document.payloadSnapshot ?? document.payload');
    expect(workspaceSource).toContain('document.payloadSnapshot');
    expect(workspaceSource).toContain('document.contextSnapshot');
    expect(workspaceSource).toContain('document.renderedSnapshot');
    expect(workspaceSource).toContain('examOrderDocumentRenderDefinition(document)');
    expect(workspaceSource).toContain('Imprimir');
    expect(clientSource).toContain('payload_snapshot');
    expect(clientSource).toContain('template_definition_snapshot');
  });

  it('keeps Nexus and exam fulfillment outside the authored request path', () => {
    expect(clientSource).not.toContain('nexus.');
    expect(workspaceSource).not.toContain('Nexus');
    expect(workspaceSource).not.toContain('resultado do exame');
    expect(workspaceSource).not.toContain('laboratory integration');
  });

  it('never exposes the internal document type as patient-facing copy', () => {
    expect(workspaceSource).toContain('Pedido de exames');
    expect(workspaceSource).not.toContain('>exam_order<');
  });
});
