import { describe, expect, it } from 'vitest';
import {
  buildPrescriptionDocumentHtml,
  DEFAULT_PRESCRIPTION_RENDER_DEFINITION,
  normalizePrescriptionRenderDefinition,
  serializePrescriptionRenderDefinition,
} from './prescriptionPrintRenderer';
import { emptyMedicationPrescriptionPayload } from './clinicalPrescription';

const context = {
  patient: { name: 'João <Teste>', birthDate: '1985-03-15' },
  clinic: { name: 'Clínica Saúde Total', address: 'Av. Paulista, 1000', phone: '(11) 3333-3333' },
  issuer: {
    name: 'Dra. Maria Santos',
    councilType: 'crm',
    councilState: 'sp',
    registration: '123456',
    specialty: 'Cardiologia',
  },
  issuedAt: '2026-09-12T12:00:00Z',
  documentIdentifier: 'DOC-TESTE',
};

describe('Prescription Print Renderer V2', () => {
  it('fails safe to a classic monochrome renderer for legacy or unknown definitions', () => {
    expect(normalizePrescriptionRenderDefinition({ layout: 'clinical-document/plain-text-v1' })).toMatchObject({
      preset: 'classic',
      accent: 'monochrome',
      medicationStyle: 'numbered',
    });
    expect(normalizePrescriptionRenderDefinition({ layout: 'html', html: '<script>alert(1)</script>' })).toMatchObject({
      preset: 'classic',
      accent: 'monochrome',
      medicationStyle: 'numbered',
    });
  });

  it('serializes only the closed renderer contract', () => {
    expect(serializePrescriptionRenderDefinition(DEFAULT_PRESCRIPTION_RENDER_DEFINITION)).toEqual({
      layout: 'clinical-document/prescription-v2',
      preset: 'institutional',
      accent: 'navy',
      title: 'Receita médica',
      medication_style: 'cards',
      show_clinic_address: true,
      show_clinic_phone: true,
      show_patient_birth_date: true,
      show_specialty: true,
    });
  });

  it('renders the same institutional document contract with frozen identity fields', () => {
    const payload = emptyMedicationPrescriptionPayload();
    payload.items[0] = {
      medicationName: 'Dipirona 500 mg',
      dose: '1 comprimido',
      route: 'oral',
      frequency: '8/8h',
      duration: '3 dias',
      instructions: 'Se dor',
    };
    payload.observations = 'Hidratar-se.';

    const html = buildPrescriptionDocumentHtml({
      payload,
      context,
      renderDefinition: {
        layout: 'clinical-document/prescription-v2',
        preset: 'institutional',
        accent: 'navy',
        title: 'Prescrição médica',
        medication_style: 'cards',
        show_clinic_address: true,
        show_clinic_phone: true,
        show_patient_birth_date: true,
        show_specialty: true,
      },
      mode: 'issued',
    });

    expect(html).toContain('data-prescription-renderer="v2"');
    expect(html).toContain('data-prescription-preset="institutional"');
    expect(html).toContain('Clínica Saúde Total');
    expect(html).toContain('Av. Paulista, 1000');
    expect(html).toContain('(11) 3333-3333');
    expect(html).toContain('15/03/1985');
    expect(html).toContain('CRM-SP 123456');
    expect(html).toContain('Cardiologia');
    expect(html).toContain('Dipirona 500 mg');
    expect(html).toContain('DOC-TESTE');
  });

  it('escapes all clinical and identity text rather than interpreting markup', () => {
    const payload = emptyMedicationPrescriptionPayload();
    payload.items[0].medicationName = '<img src=x onerror=alert(1)>';
    payload.items[0].instructions = '<script>alert(2)</script>';
    payload.observations = '<b>não interpretar</b>';

    const html = buildPrescriptionDocumentHtml({
      payload,
      context,
      renderDefinition: {
        ...serializePrescriptionRenderDefinition(DEFAULT_PRESCRIPTION_RENDER_DEFINITION),
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

  it('honors safe visibility toggles without deleting the frozen context', () => {
    const html = buildPrescriptionDocumentHtml({
      payload: emptyMedicationPrescriptionPayload(),
      context,
      renderDefinition: {
        layout: 'clinical-document/prescription-v2',
        preset: 'compact',
        accent: 'emerald',
        title: 'Receita médica',
        medication_style: 'numbered',
        show_clinic_address: false,
        show_clinic_phone: false,
        show_patient_birth_date: false,
        show_specialty: false,
      },
      mode: 'admin-preview',
    });

    expect(html).not.toContain('Av. Paulista, 1000');
    expect(html).not.toContain('(11) 3333-3333');
    expect(html).not.toContain('15/03/1985');
    expect(html).not.toContain('Cardiologia');
    expect(html).toContain('Clínica Saúde Total');
    expect(html).toContain('CRM-SP 123456');
    expect(html).toContain('Pré-visualização · sem validade');
  });

  it('only injects the controlled auto-print script for issued printing', () => {
    const withoutPrint = buildPrescriptionDocumentHtml({
      payload: emptyMedicationPrescriptionPayload(),
      context,
      mode: 'admin-preview',
    });
    const withPrint = buildPrescriptionDocumentHtml({
      payload: emptyMedicationPrescriptionPayload(),
      context,
      mode: 'issued',
      autoPrint: true,
    });

    expect(withoutPrint).not.toContain('window.print()');
    expect(withPrint).toContain('window.print()');
  });
});