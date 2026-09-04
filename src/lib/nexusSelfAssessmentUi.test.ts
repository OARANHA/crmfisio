import { describe, expect, it } from 'vitest';
import {
  NEXUS_SELF_ASSESSMENT_SCALE_OPTIONS,
  nexusSelfAssessmentScaleLabel,
  normalizeNexusFunctionError,
} from './nexusSelfAssessmentUi';

describe('Nexus self-assessment UI contract', () => {
  it('exposes only the currently supported PHQ-9 and GAD-7 actions', () => {
    expect(NEXUS_SELF_ASSESSMENT_SCALE_OPTIONS.map((item) => item.value)).toEqual(['phq9', 'gad7']);
  });

  it('keeps stable human labels for the supported tools', () => {
    expect(nexusSelfAssessmentScaleLabel('phq9')).toBe('PHQ-9');
    expect(nexusSelfAssessmentScaleLabel('gad7')).toBe('GAD-7');
  });

  it('falls back safely without leaking transport internals', () => {
    expect(normalizeNexusFunctionError(null, 'Falha segura')).toBe('Falha segura');
    expect(normalizeNexusFunctionError(new Error('Erro clínico controlado'), 'Falha segura')).toBe('Erro clínico controlado');
  });
});
