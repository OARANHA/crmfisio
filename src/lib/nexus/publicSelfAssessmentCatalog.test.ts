import { describe, expect, it } from 'vitest';
import { getPublicSelfAssessmentDefinition } from './publicSelfAssessmentCatalog';

describe('public Nexus self-assessment catalog', () => {
  it('exposes PHQ-9 with the processor rule version and 9 questions', () => {
    const definition = getPublicSelfAssessmentDefinition('phq9');
    expect(definition?.ruleVersion).toBe('nexus-2026-09-03');
    expect(definition?.questions).toHaveLength(9);
    expect(definition?.questions.every((question) => question.options.map((option) => option.value).join(',') === '0,1,2,3')).toBe(true);
  });

  it('exposes GAD-7 with the processor rule version and 7 questions', () => {
    const definition = getPublicSelfAssessmentDefinition('gad7');
    expect(definition?.ruleVersion).toBe('nexus-2026-09-03');
    expect(definition?.questions).toHaveLength(7);
    expect(definition?.questions.every((question) => question.options.map((option) => option.value).join(',') === '0,1,2,3')).toBe(true);
  });

  it('rejects instruments not explicitly supported by the public flow', () => {
    expect(getPublicSelfAssessmentDefinition('hcl32')).toBeNull();
    expect(getPublicSelfAssessmentDefinition(undefined)).toBeNull();
  });
});
