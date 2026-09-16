import { describe, expect, it } from 'vitest';
import { getClinicianAssistedInstrumentDefinition } from './clinicianAssistedInstrumentCatalog';
import { getPublicSelfAssessmentDefinition } from './publicSelfAssessmentCatalog';

describe('clinician-assisted instrument question catalog', () => {
  it('reuses the existing public PHQ-9/GAD-7 definitions without widening the public allowlist', () => {
    expect(getClinicianAssistedInstrumentDefinition('phq9')?.questions).toHaveLength(9);
    expect(getClinicianAssistedInstrumentDefinition('gad7')?.questions).toHaveLength(7);
    expect(getPublicSelfAssessmentDefinition('phq15')).toBeNull();
    expect(getPublicSelfAssessmentDefinition('cage')).toBeNull();
  });

  it('exposes CAGE only to the clinician-assisted surface with four explicit yes/no items', () => {
    const definition = getClinicianAssistedInstrumentDefinition('cage');
    expect(definition?.ruleVersion).toBe('nexus-cage-2026-09-16');
    expect(definition?.questions).toHaveLength(4);
    expect(definition?.instructions).toContain('Nexus/MedicsPro');
    expect(definition?.questions[0].text).toContain('deveria diminuir a quantidade de bebida');
    expect(definition?.questions.every((question) => question.options.map((option) => option.value).join(',') === '0,1')).toBe(true);
    expect(definition?.instructions).toContain('não estabelece diagnóstico');
  });

  it('exposes PHQ-15 only to the clinician-assisted surface', () => {
    const definition = getClinicianAssistedInstrumentDefinition('phq15');
    expect(definition?.ruleVersion).toBe('nexus-phq15-2026-09-13');
    expect(definition?.questions).toHaveLength(15);
    expect(definition?.questions.every((question) => question.options.map((option) => option.value).join(',') === '0,1,2')).toBe(true);
    expect(definition?.questions[3].text).toContain('quando aplicável');
  });
});
