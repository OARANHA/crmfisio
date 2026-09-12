import { describe, expect, it } from 'vitest';
import { emptyExamOrderPayload } from './clinicalExamOrder';
import {
  buildExamOrderDocumentHtml,
  buildExamOrderRenderContextFromSnapshot,
  DEFAULT_EXAM_ORDER_RENDER_DEFINITION,
  normalizeExamOrderRenderDefinition,
  serializeExamOrderRenderDefinition,
} from './examOrderPrintRenderer';

const context = {
  patient: { name: 'João <Teste>', birthDate: '1985-03-15' },
  clinic: { name: 'Clínica Saúde Total', address: 'Av. Paulista, 1000', phone: '(11) 3333-3333' },
  issuer: {
    name: 'Dra. Maria Santos', professionalType: 'medico', councilType: 'crm', councilState: 'sp', registration: '123456', specialty: 'Cardiologia',
  },
  issuedAt: '2026-09-12T12:00:00Z',
  documentIdentifier: 'DOC-EXAME',
};

describe('Exam Order Print Renderer V1', () => {
  it('accepts only the closed visual contract', () => {
    expect(normalizeExamOrderRenderDefinition({ layout: 'clinical-document/plain-text-v1' })).toBeNull();
    expect(normalizeExamOrderRenderDefinition({ layout: 'html', html: '<script>alert(1)</script>' })).toBeNull();
    expect(normalizeExamOrderRenderDefinition({ ...serializeExamOrderRenderDefinition(DEFAULT_EXAM_ORDER_RENDER_DEFINITION), html: '<script>alert(1)</script>' })).toBeNull();
    expect(serializeExamOrderRenderDefinition(DEFAULT_EXAM_ORDER_RENDER_DEFINITION)).toEqual({
      layout: 'clinical-document/exam-order-v1',
      title: 'Pedido de exames',
      show_clinic_address: true,
      show_clinic_phone: true,
      show_patient_birth_date: true,
      show_specialty: true,
    });
  });

  it('renders a human A4 order with structured exams and signature region', () => {
    const payload = emptyExamOrderPayload();
    payload.priority = 'urgent';
    payload.items[0] = { examName: 'Hemograma completo', category: 'Laboratório', code: 'HC-01', instructions: 'Jejum conforme orientação.', urgent: true };
    payload.items.push({ examName: 'TSH', category: 'Laboratório', code: '', instructions: '', urgent: false });
    payload.clinicalIndication = 'Investigação clínica.';
    payload.impression = 'Hipótese em avaliação.';
    payload.observations = 'Correlacionar com quadro clínico.';
    const html = buildExamOrderDocumentHtml({
      payload,
      context,
      renderDefinition: serializeExamOrderRenderDefinition(DEFAULT_EXAM_ORDER_RENDER_DEFINITION),
      mode: 'issued',
    });

    expect(html).toContain('data-exam-order-renderer="v1"');
    expect(html).toContain('Pedido de exames');
    expect(html).not.toContain('exam_order');
    expect(html).toContain('Hemograma completo');
    expect(html).toContain('TSH');
    expect(html).toContain('Laboratório');
    expect(html).toContain('Código: HC-01');
    expect(html).toContain('Jejum conforme orientação.');
    expect(html).toContain('Prioridade: Urgente');
    expect(html).toContain('Investigação clínica.');
    expect(html).toContain('Hipótese em avaliação.');
    expect(html).toContain('Correlacionar com quadro clínico.');
    expect(html).toContain('CRM-SP 123456');
    expect(html).toContain('Assinatura do profissional solicitante');
    expect(html).toContain('DOC-EXAME');
  });

  it('escapes dynamic content instead of interpreting markup', () => {
    const payload = emptyExamOrderPayload();
    payload.items[0].examName = '<img src=x onerror=alert(1)>';
    payload.items[0].instructions = '<script>alert(2)</script>';
    payload.clinicalIndication = '<b>indicação</b>';
    const html = buildExamOrderDocumentHtml({
      payload,
      context,
      renderDefinition: { ...serializeExamOrderRenderDefinition(DEFAULT_EXAM_ORDER_RENDER_DEFINITION), title: '<svg onload=alert(3)>' },
      mode: 'draft',
    });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(2)</script>');
    expect(html).not.toContain('<b>indicação</b>');
    expect(html).not.toContain('<svg onload=alert(3)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
    expect(html).toContain('João &lt;Teste&gt;');
  });

  it('keeps already-issued plain-text documents on the frozen legacy snapshot', () => {
    const payload = emptyExamOrderPayload();
    payload.items[0].examName = 'Exame antigo';
    const html = buildExamOrderDocumentHtml({
      payload,
      context,
      renderDefinition: { layout: 'clinical-document/plain-text-v1' },
      renderedSnapshot: 'PEDIDO DE EXAMES\nPaciente: João\n<script>alert(1)</script>',
      mode: 'issued',
    });
    expect(html).toContain('data-exam-order-renderer="legacy"');
    expect(html).toContain('PEDIDO DE EXAMES');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('builds issued context exclusively from the frozen context snapshot', () => {
    const frozen = buildExamOrderRenderContextFromSnapshot({
      patient: { name: 'Paciente congelado', birth_date: '1990-01-02' },
      clinic: { name: 'Clínica congelada', address: 'Rua A', phone: '123' },
      issuer: { name: 'Dr. Congelado', professional_type: 'medico', council_type: 'crm', council_state: 'rs', registro: '999', specialty: 'Clínica Médica' },
      issued_at: '2026-09-12T15:00:00Z',
    }, 'Paciente atual', 'DOC-FROZEN');
    expect(frozen.patient.name).toBe('Paciente congelado');
    expect(frozen.clinic.name).toBe('Clínica congelada');
    expect(frozen.issuer.name).toBe('Dr. Congelado');
    expect(frozen.issuer.councilType).toBe('crm');
    expect(frozen.documentIdentifier).toBe('DOC-FROZEN');
  });

  it('only injects the controlled print script when explicitly requested', () => {
    const payload = emptyExamOrderPayload();
    const preview = buildExamOrderDocumentHtml({ payload, context, mode: 'draft' });
    const issued = buildExamOrderDocumentHtml({
      payload,
      context,
      renderDefinition: serializeExamOrderRenderDefinition(DEFAULT_EXAM_ORDER_RENDER_DEFINITION),
      mode: 'issued',
      autoPrint: true,
    });
    expect(preview).not.toContain('window.print()');
    expect(issued).toContain('window.print()');
  });
});
