import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(resolve(here, './clinicalDocumentTemplates.ts'), 'utf8');
const rendererSource = readFileSync(resolve(here, './prescriptionPrintRenderer.ts'), 'utf8');
const adminSource = readFileSync(resolve(here, '../components/PrescriptionTemplatesAdmin.tsx'), 'utf8');
const configSource = readFileSync(resolve(here, '../pages/ConfigPremium.tsx'), 'utf8');

describe('Prescription Template Admin frontend boundary', () => {
  it('uses only explicit admin RPCs for template mutations', () => {
    expect(clientSource).toContain("db.rpc('list_clinical_document_templates_for_management'");
    expect(clientSource).toContain("db.rpc('create_clinic_clinical_document_template'");
    expect(clientSource).toContain("db.rpc('clone_clinical_document_template_to_clinic'");
    expect(clientSource).toContain("db.rpc('save_clinic_prescription_template_presentation'");
    expect(clientSource).toContain("db.rpc('update_clinic_clinical_document_template_metadata'");
    expect(clientSource).not.toContain(".from('clinical_document_templates').insert");
    expect(clientSource).not.toContain(".from('clinical_document_templates').update");
    expect(clientSource).not.toContain(".from('clinical_document_template_versions').insert");
  });

  it('keeps template administration restricted to clinic managers in presentation', () => {
    expect(adminSource).toContain('const canManage = isClinicManager(user?.role)');
    expect(adminSource).toContain('if (!canManage) return null');
    expect(adminSource).toContain('administrar um modelo não permite emitir receita');
  });

  it('keeps platform templates read-only by offering clone instead of edit', () => {
    expect(adminSource).toContain('title="Modelos MedicsPro"');
    expect(adminSource).toContain('onDuplicate={(template) => void duplicate(template)}');
    expect(adminSource).not.toContain('updatePlatformPrescriptionTemplate');
  });

  it('does not create a generic active template before the admin confirms its identity', () => {
    expect(adminSource).toContain('setCreatingNew(true)');
    expect(adminSource).toContain('Nada é criado no servidor até você confirmar em “Criar modelo”.');
    expect(adminSource).toContain('if (creatingNew) {');
    expect(adminSource).toContain('createClinicPrescriptionTemplate({ name, description, specialty, renderDefinition })');
  });

  it('publishes presentation changes through an immutable-version RPC', () => {
    expect(adminSource).toContain('saveClinicPrescriptionTemplatePresentation({');
    expect(adminSource).toContain('renderDefinition,');
    expect(adminSource).toContain('Salvar e publicar');
    expect(adminSource).toContain('receitas já emitidas não são alteradas');
  });

  it('makes specialty relevance explicit without turning it into authorization', () => {
    expect(clientSource).toContain("p_relevance_metadata: { specialty:");
    expect(adminSource).toContain('Especialidade / relevância');
    expect(adminSource).toContain('Especialidade aqui serve somente para relevância e organização.');
  });

  it('uses the same closed renderer in the admin preview instead of arbitrary markup', () => {
    expect(adminSource).toContain('buildPrescriptionDocumentHtml({');
    expect(adminSource).toContain('srcDoc={previewHtml}');
    expect(adminSource).toContain('sandbox=""');
    expect(rendererSource).toContain("type PrescriptionPrintPreset = 'classic' | 'institutional' | 'compact'");
    expect(rendererSource).toContain('serializePrescriptionRenderDefinition');
    expect(adminSource).toContain('Não há editor HTML/CSS livre.');
    expect(adminSource).not.toContain('contentEditable');
    expect(adminSource).not.toContain('dangerouslySetInnerHTML');
  });

  it('exposes the admin surface in clinic settings without creating a new top-level app route', () => {
    expect(configSource).toContain("'documentos'");
    expect(configSource).toContain("title: 'Documentos clínicos'");
    expect(configSource).toContain('<PrescriptionTemplatesAdmin />');
  });
});