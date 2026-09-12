import { describe, expect, it } from 'vitest';
import {
  normalizePrescriptionTemplateAdminRow,
  prescriptionTemplateSpecialty,
} from './clinicalDocumentTemplates';

describe('Prescription Template Admin client', () => {
  it('maps the D2-B.2A management RPC row without inventing clinical state', () => {
    const template = normalizePrescriptionTemplateAdminRow({
      template_id: 'template-1',
      owner_type: 'platform',
      clinic_id: null,
      document_type: 'medication_prescription',
      name: 'Receita simples',
      description: 'Modelo padrão',
      relevance_metadata: { specialty: 'clinica_medica' },
      status: 'active',
      current_version_id: 'version-1',
      current_version: 2,
      definition: { kind: 'medication_prescription', fields: ['items', 'observations'] },
      render_definition: { layout: 'clinical-document/plain-text-v1' },
      variables_contract: ['patient.name'],
      published_at: '2026-09-12T00:00:00Z',
      read_only: true,
      created_at: '2026-09-12T00:00:00Z',
      updated_at: '2026-09-12T00:00:00Z',
    });

    expect(template.ownerType).toBe('platform');
    expect(template.readOnly).toBe(true);
    expect(template.currentVersion).toBe(2);
    expect(template.renderDefinition).toEqual({ layout: 'clinical-document/plain-text-v1' });
    expect(prescriptionTemplateSpecialty(template)).toBe('clinica_medica');
  });

  it('fails soft for malformed optional JSON returned by the management projection', () => {
    const template = normalizePrescriptionTemplateAdminRow({
      template_id: 'template-2',
      owner_type: 'clinic',
      clinic_id: 'clinic-1',
      document_type: 'medication_prescription',
      name: 'Modelo da clínica',
      description: '',
      relevance_metadata: null,
      status: 'archived',
      current_version_id: null,
      current_version: null,
      definition: null,
      render_definition: null,
      variables_contract: null,
      published_at: null,
      read_only: false,
      created_at: '2026-09-12T00:00:00Z',
      updated_at: '2026-09-12T00:00:00Z',
    });

    expect(template.status).toBe('archived');
    expect(template.relevanceMetadata).toEqual({});
    expect(template.definition).toBeNull();
    expect(template.variablesContract).toEqual([]);
    expect(prescriptionTemplateSpecialty(template)).toBe('geral');
  });
});
