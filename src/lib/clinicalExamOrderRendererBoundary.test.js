import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const renderer = readFileSync(resolve(here, './examOrderPrintRenderer.ts'), 'utf8');
const workspace = readFileSync(resolve(here, '../components/ClinicalExamOrderWorkspace.tsx'), 'utf8');
const preview = readFileSync(resolve(here, '../components/ExamOrderDocumentPreview.tsx'), 'utf8');

describe('Clinical Exam Order D2-D2 renderer boundary', () => {
  it('uses one code-owned closed A4 renderer for preview and issued print', () => {
    expect(renderer).toContain("EXAM_ORDER_RENDER_LAYOUT_V1 = 'clinical-document/exam-order-v1'");
    expect(preview).toContain('buildExamOrderDocumentHtml');
    expect(workspace).toContain('buildExamOrderDocumentHtml');
    expect(preview).toContain('sandbox=""');
    expect(renderer).not.toContain('dangerouslySetInnerHTML');
  });

  it('keeps all clinically authored and identity text escaped', () => {
    expect(renderer).toContain('escapeHtml(name)');
    expect(renderer).toContain('nl2br(item.instructions.trim())');
    expect(renderer).toContain('nl2br(payload.clinicalIndication.trim())');
    expect(renderer).toContain('nl2br(payload.impression.trim())');
    expect(renderer).toContain('nl2br(payload.observations.trim())');
  });

  it('prints issued documents only from frozen server snapshots', () => {
    expect(workspace).toContain("document.status !== 'issued' || !document.payloadSnapshot");
    expect(workspace).toContain('buildExamOrderRenderContextFromSnapshot(document.contextSnapshot');
    expect(workspace).toContain('examOrderDocumentRenderDefinition(document)');
    expect(workspace).toContain('renderedSnapshot: document.renderedSnapshot');
    expect(workspace).not.toContain('renderDefinition: selectedTemplate?.renderDefinition,\n    renderedSnapshot: document.renderedSnapshot');
  });

  it('keeps legacy issued snapshots printable without rewriting their layout', () => {
    expect(renderer).toContain('data-exam-order-renderer="legacy"');
    expect(renderer).toContain("input.mode === 'issued' && (input.renderedSnapshot || '').trim()");
    expect(renderer).toContain("title = 'Pedido de exames'");
  });

  it('includes clinic, patient, professional credential and signature semantics', () => {
    expect(renderer).toContain('Assinatura do profissional solicitante');
    expect(renderer).toContain('Exames solicitados');
    expect(renderer).toContain('Indicação clínica');
    expect(renderer).toContain('Hipótese / impressão clínica');
    expect(renderer).toContain('Observações');
  });
});
