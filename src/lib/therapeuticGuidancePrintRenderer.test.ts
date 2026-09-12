import { describe, expect, it } from 'vitest';
import { emptyTherapeuticGuidancePayload } from './clinicalTherapeuticGuidance';
import {
  buildTherapeuticGuidanceDocumentHtml,
  buildTherapeuticGuidanceRenderContextFromSnapshot,
  DEFAULT_THERAPEUTIC_GUIDANCE_RENDER_DEFINITION,
  normalizeTherapeuticGuidanceRenderDefinition,
  serializeTherapeuticGuidanceRenderDefinition,
} from './therapeuticGuidancePrintRenderer';

const context = {
  patient: { name: 'João <Teste>', birthDate: '1985-03-15' },
  clinic: { name: 'Clínica Saúde Total', address: 'Av. Paulista, 1000', phone: '(11) 3333-3333' },
  issuer: {
    name: 'Dra. Maria Santos',
    professionalType: 'medico',
    councilType: 'crm',
    councilState: 'sp',
    registration: '123456',
    specialty: 'Cardiologia',
  },
  issuedAt: '2026-09-12T12:00:00Z',
  documentIdentifier: 'DOC-TESTE',
};

describe('Therapeutic Guidance Print Renderer V1', () => {
  it('accepts only the closed visual contract', () => {
    expect(normalizeTherapeuticGuidanceRenderDefinition({ layout: 'clinical-document/plain-text-v1' })).toBeNull();
    expect(normalizeTherapeuticGuidanceRenderDefinition({ layout: 'html', html: '<script>alert(1)</script>' })).toBeNull();
    expect(serializeTherapeuticGuidanceRenderDefinition(DEFAULT_THERAPEUTIC_GUIDANCE_RENDER_DEFINITION)).toEqual({
      layout: 'clinical-document/therapeutic-guidance-v1',
      title: 'Orientações terapêuticas',
      show_clinic_address: true,
      show_clinic_phone: true,
      show_patient_birth_date: true,
      show_specialty: true,
    });
  });

  it('renders a human A4 document with frozen patient, clinic and professional identity', () => {
    const payload = emptyTherapeuticGuidancePayload();
    payload.items[0].guidance = 'Manter hidratação e observar sinais de alerta.';
    payload.patientInstructions = 'Retornar se houver piora.';
    payload.observations = 'Reavaliação conforme evolução.';

    const html = buildTherapeuticGuidanceDocumentHtml({
      payload,
      context,
      renderDefinition: serializeTherapeuticGuidanceRenderDefinition(DEFAULT_THERAPEUTIC_GUIDANCE_RENDER_DEFINITION),
      mode: 'issued',
    });

    expect(html).toContain('data-therapeutic-guidance-renderer="v1"');
    expect(html).toContain('Orientações terapêuticas');
    expect(html).not.toContain('therapeutic_guidance');
    expect(html).toContain('Clínica Saúde Total');
    expect(html).toContain('Av. Paulista, 1000');
    expect(html).toContain('(11) 3333-3333');
    expect(html).toContain('15/03/1985');
    expect(html).toContain('CRM-SP 123456');
    expect(html).toContain('Cardiologia');
    expect(html).toContain('Manter hidratação e observar sinais de alerta.');
    expect(html).toContain('Retornar se houver piora.');
    expect(html).toContain('Reavaliação conforme evolução.');
    expect(html).toContain('DOC-TESTE');
  });

  it('escapes dynamic clinical and identity content instead of interpreting markup', () => {
    const payload = emptyTherapeuticGuidancePayload();
    payload.items[0].guidance = '<img src=x onerror=alert(1)>';
    payload.patientInstructions = '<script>alert(2)</script>';
    payload.observations = '<b>não interpretar</b>';

    const html = buildTherapeuticGuidanceDocumentHtml({
      payload,
      context,
      renderDefinition: {
        ...serializeTherapeuticGuidanceRenderDefinition(DEFAULT_THERAPEUTIC_GUIDANCE_RENDER_DEFINITION),
        title: '<svg onload=alert(3)>',
      },
      mode: 'draft',
    });

    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(2)</script>');
    expect(html).not.toContain('<b>não interpretar</b>');
    expect(html).not.toContain('<svg onload=alert(3)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
    expect(html).toContain('&lt;b&gt;não interpretar&lt;/b&gt;');
    expect(html).toContain('João &lt;Teste&gt;');
  });

  it('keeps legacy issued documents on a safe plain-text fallback', () => {
    const payload = emptyTherapeuticGuidancePayload();
    payload.items[0].guidance = 'Orientação antiga';
    const html = buildTherapeuticGuidanceDocumentHtml({
      payload,
      context,
      renderDefinition: { layout: 'clinical-document/plain-text-v1' },
      renderedSnapshot: 'Paciente: João\n<script>alert(1)</script>',
      mode: 'issued',
    });

    expect(html).toContain('data-therapeutic-guidance-renderer="legacy"');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('uses the frozen snapshot as the issued render context', () => {
    const frozen = buildTherapeuticGuidanceRenderContextFromSnapshot({
      patient: { name: 'Paciente congelado', birth_date: '1990-01-02' },
      clinic: { name: 'Clínica congelada', address: 'Rua A', phone: '123' },
      issuer: {
        name: 'Profissional congelado',
        professional_type: 'fisioterapeuta',
        council_type: 'crefito',
        council_state: 'rs',
        registro: '999',
        specialty: 'Ortopedia',
      },
      issued_at: '2026-09-12T15:00:00Z',
    }, 'Paciente atual', 'DOC-FROZEN');

    expect(frozen.patient.name).toBe('Paciente congelado');
    expect(frozen.clinic.name).toBe('Clínica congelada');
    expect(frozen.issuer.name).toBe('Profissional congelado');
    expect(frozen.issuer.councilType).toBe('crefito');
    expect(frozen.documentIdentifier).toBe('DOC-FROZEN');
  });

  it('only injects the controlled print script when explicitly requested', () => {
    const payload = emptyTherapeuticGuidancePayload();
    const preview = buildTherapeuticGuidanceDocumentHtml({ payload, context, mode: 'draft' });
    const issued = buildTherapeuticGuidanceDocumentHtml({
      payload,
      context,
      renderDefinition: serializeTherapeuticGuidanceRenderDefinition(DEFAULT_THERAPEUTIC_GUIDANCE_RENDER_DEFINITION),
      mode: 'issued',
      autoPrint: true,
    });
    expect(preview).not.toContain('window.print()');
    expect(issued).toContain('window.print()');
  });
});
