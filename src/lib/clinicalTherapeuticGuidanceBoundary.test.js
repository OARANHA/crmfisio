import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(resolve(here, './clinicalTherapeuticGuidance.ts'), 'utf8');
const rendererSource = readFileSync(resolve(here, './therapeuticGuidancePrintRenderer.ts'), 'utf8');
const workspaceSource = readFileSync(resolve(here, '../components/ClinicalTherapeuticGuidanceWorkspace.tsx'), 'utf8');
const previewSource = readFileSync(resolve(here, '../components/TherapeuticGuidanceDocumentPreview.tsx'), 'utf8');

describe('Clinical Therapeutic Guidance D2-C.1 boundary', () => {
  it('keeps the canonical D2-A lifecycle and server-side eligibility authority', () => {
    expect(clientSource).toContain("db.rpc('current_user_can_issue_clinical_document'");
    expect(clientSource).toContain("p_document_type: 'therapeutic_guidance'");
    expect(clientSource).toContain("db.rpc('create_clinical_document_draft'");
    expect(clientSource).toContain("db.rpc('save_clinical_document_draft'");
    expect(clientSource).toContain("db.rpc('issue_clinical_document'");
    expect(clientSource).not.toContain(".from('clinical_documents').insert");
    expect(clientSource).not.toContain(".from('clinical_documents').update");
  });

  it('uses one safe renderer for the live draft and immutable issued print', () => {
    expect(previewSource).toContain('buildTherapeuticGuidanceDocumentHtml({');
    expect(previewSource).toContain("mode: 'draft'");
    expect(previewSource).toContain('srcDoc={html}');
    expect(previewSource).toContain('sandbox=""');
    expect(previewSource).not.toContain('window.print');
    expect(previewSource).not.toContain('document.write');
    expect(workspaceSource).toContain('buildTherapeuticGuidanceDocumentHtml({');
    expect(workspaceSource).toContain("mode: 'issued'");
    expect(workspaceSource).toContain('autoPrint: true');
  });

  it('prints only issued snapshots and the frozen template renderer definition', () => {
    expect(workspaceSource).toContain("document.status !== 'issued' || !document.payloadSnapshot");
    expect(workspaceSource).toContain('payload: document.payloadSnapshot');
    expect(workspaceSource).toContain('buildTherapeuticGuidanceRenderContextFromSnapshot(document.contextSnapshot');
    expect(workspaceSource).toContain('therapeuticGuidanceDocumentRenderDefinition(document)');
    expect(clientSource).toContain('template_definition_snapshot');
    expect(clientSource).toContain('templateDefinitionSnapshot');
  });

  it('resumes old drafts with their exact template-version renderer', () => {
    expect(clientSource).toContain('loadTherapeuticGuidanceTemplateRenderDefinition');
    expect(workspaceSource).toContain('loadTherapeuticGuidanceTemplateRenderDefinition(draft.templateVersionId)');
    expect(workspaceSource).toContain('setActiveRenderDefinition(renderDefinition)');
  });

  it('keeps the visual contract code-owned and escapes dynamic content', () => {
    expect(rendererSource).toContain("THERAPEUTIC_GUIDANCE_RENDER_LAYOUT_V1 = 'clinical-document/therapeutic-guidance-v1'");
    expect(rendererSource).toContain('escapeHtml(context.patient.name');
    expect(rendererSource).toContain('nl2br(guidance)');
    expect(rendererSource).not.toContain('dangerouslySetInnerHTML');
    expect(rendererSource).not.toContain('eval(');
  });

  it('uses human document copy and never exposes the internal document_type as a title', () => {
    expect(rendererSource).toContain("title: 'Orientações terapêuticas'");
    expect(rendererSource).not.toContain('<h1>therapeutic_guidance</h1>');
  });

  it('keeps Nexus outside the authored guidance document path', () => {
    expect(clientSource).not.toContain('nexus.');
    expect(rendererSource).not.toContain('Nexus');
    expect(previewSource).not.toContain('Nexus');
  });
});
