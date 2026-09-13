import { describe, expect, it } from 'vitest';
import { emptyReferralPayload } from './clinicalReferral';
import {
  buildReferralDocumentHtml,
  buildReferralRenderContextFromSnapshot,
  DEFAULT_REFERRAL_RENDER_DEFINITION,
  normalizeReferralRenderDefinition,
  serializeReferralRenderDefinition,
} from './referralPrintRenderer';

const context = {
  patient: { name: 'João <Teste>', birthDate: '1985-03-15' },
  clinic: { name: 'Clínica Saúde Total', address: 'Av. Paulista, 1000', phone: '(11) 3333-3333' },
  issuer: {
    name: 'Dra. Maria Santos', professionalType: 'medico', councilType: 'crm', councilState: 'sp', registration: '123456', specialty: 'Cardiologia',
  },
  issuedAt: '2026-09-12T12:00:00Z',
  documentIdentifier: 'DOC-ENCAMINHAMENTO',
};

describe('Referral Print Renderer V1', () => {
  it('accepts only the closed visual contract', () => {
    expect(normalizeReferralRenderDefinition({ layout: 'clinical-document/plain-text-v1' })).toBeNull();
    expect(normalizeReferralRenderDefinition({ layout: 'html', html: '<script>alert(1)</script>' })).toBeNull();
    expect(normalizeReferralRenderDefinition({ ...serializeReferralRenderDefinition(DEFAULT_REFERRAL_RENDER_DEFINITION), html: '<script>alert(1)</script>' })).toBeNull();
    expect(serializeReferralRenderDefinition(DEFAULT_REFERRAL_RENDER_DEFINITION)).toEqual({
      layout: 'clinical-document/referral-v1',
      title: 'Encaminhamento clínico',
      show_clinic_address: true,
      show_clinic_phone: true,
      show_patient_birth_date: true,
      show_specialty: true,
    });
  });

  it('renders a human A4 referral with destination, clinical context and signature region', () => {
    const payload = emptyReferralPayload();
    payload.priority = 'high';
    payload.recipient = {
      scope: 'external',
      targetProfileId: '',
      professionalName: 'Dra. Ana Costa',
      professionalType: 'Psicóloga',
      specialty: 'Psicologia clínica',
      service: 'Avaliação psicológica',
      facility: 'Clínica Integrada',
      contact: '(51) 99999-9999',
    };
    payload.reason = 'Avaliação especializada para continuidade do cuidado.';
    payload.clinicalSummary = 'Paciente em acompanhamento clínico.';
    payload.requestedAction = 'Avaliação e conduta conforme julgamento profissional.';
    payload.observations = 'Compartilhar retorno assistencial quando pertinente.';
    const html = buildReferralDocumentHtml({
      payload,
      context,
      renderDefinition: serializeReferralRenderDefinition(DEFAULT_REFERRAL_RENDER_DEFINITION),
      mode: 'issued',
    });

    expect(html).toContain('data-referral-renderer="v1"');
    expect(html).toContain('Encaminhamento clínico');
    expect(html).not.toContain('>referral<');
    expect(html).toContain('Dra. Ana Costa');
    expect(html).toContain('Psicologia clínica');
    expect(html).toContain('Avaliação psicológica');
    expect(html).toContain('Clínica Integrada');
    expect(html).toContain('(51) 99999-9999');
    expect(html).toContain('Prioridade: Prioridade alta');
    expect(html).toContain('Avaliação especializada para continuidade do cuidado.');
    expect(html).toContain('Paciente em acompanhamento clínico.');
    expect(html).toContain('Avaliação e conduta conforme julgamento profissional.');
    expect(html).toContain('CRM-SP 123456');
    expect(html).toContain('Assinatura do profissional responsável pelo encaminhamento');
    expect(html).toContain('DOC-ENCAMINHAMENTO');
  });

  it('escapes dynamic content instead of interpreting markup', () => {
    const payload = emptyReferralPayload();
    payload.recipient.professionalName = '<img src=x onerror=alert(1)>';
    payload.reason = '<script>alert(2)</script>';
    payload.clinicalSummary = '<b>resumo</b>';
    const html = buildReferralDocumentHtml({
      payload,
      context,
      renderDefinition: { ...serializeReferralRenderDefinition(DEFAULT_REFERRAL_RENDER_DEFINITION), title: '<svg onload=alert(3)>' },
      mode: 'draft',
    });
    expect(html).not.toContain('<img src=x');
    expect(html).not.toContain('<script>alert(2)</script>');
    expect(html).not.toContain('<b>resumo</b>');
    expect(html).not.toContain('<svg onload=alert(3)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('&lt;script&gt;alert(2)&lt;/script&gt;');
    expect(html).toContain('João &lt;Teste&gt;');
  });

  it('keeps already-issued plain-text referrals on the frozen legacy snapshot', () => {
    const payload = emptyReferralPayload();
    payload.recipient.specialty = 'Cardiologia';
    payload.reason = 'Avaliação';
    const html = buildReferralDocumentHtml({
      payload,
      context,
      renderDefinition: { layout: 'clinical-document/plain-text-v1' },
      renderedSnapshot: 'ENCAMINHAMENTO CLÍNICO\nPaciente: João\n<script>alert(1)</script>',
      mode: 'issued',
    });
    expect(html).toContain('data-referral-renderer="legacy"');
    expect(html).toContain('ENCAMINHAMENTO CLÍNICO');
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('builds issued context exclusively from the frozen context snapshot', () => {
    const frozen = buildReferralRenderContextFromSnapshot({
      patient: { name: 'Paciente congelado', birth_date: '1990-01-02' },
      clinic: { name: 'Clínica congelada', address: 'Rua A', phone: '123' },
      issuer: { name: 'Profissional congelado', professional_type: 'psicologo', council_type: 'crp', council_state: 'rs', registro: '999', specialty: 'Psicologia Clínica' },
      issued_at: '2026-09-12T15:00:00Z',
    }, 'Paciente atual', 'DOC-FROZEN');
    expect(frozen.patient.name).toBe('Paciente congelado');
    expect(frozen.clinic.name).toBe('Clínica congelada');
    expect(frozen.issuer.name).toBe('Profissional congelado');
    expect(frozen.issuer.councilType).toBe('crp');
    expect(frozen.documentIdentifier).toBe('DOC-FROZEN');
  });

  it('only injects the controlled print script when explicitly requested', () => {
    const payload = emptyReferralPayload();
    const preview = buildReferralDocumentHtml({ payload, context, mode: 'draft' });
    const issued = buildReferralDocumentHtml({
      payload,
      context,
      renderDefinition: serializeReferralRenderDefinition(DEFAULT_REFERRAL_RENDER_DEFINITION),
      mode: 'issued',
      autoPrint: true,
    });
    expect(preview).not.toContain('window.print()');
    expect(issued).toContain('window.print()');
  });
});
