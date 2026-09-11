import { describe, expect, it } from 'vitest';
import { assessmentProgress, requiredAssessmentComponentKeys } from './assessmentRunnerV2';

describe('assessment runner V2 progress', () => {
  const schema: any = { sections: [
    { key: 'a', title: 'A', components: [{ key: 'title', type: 'heading', label: 'x' }, { key: 'name', type: 'short_text', label: 'Nome', required: true }] },
    { key: 'b', title: 'B', components: [{ key: 'note', type: 'info', label: 'x' }, { key: 'pain', type: 'scale', label: 'Dor', required: true }] },
  ] };
  it('ignores heading/info and identifies the first required section', () => {
    const result = assessmentProgress(schema, { pain: 4 }, []);
    expect(result).toMatchObject({ total: 2, complete: 1, firstRequiredSection: 0 });
  });

  it('uses the same answered semantics for progress and required fields, including body maps', () => {
    const bodySchema: any = { sections: [{ key: 'body', title: 'Body', components: [
      { key: 'heading', type: 'heading', label: 'Heading', required: true },
      { key: 'multi', type: 'multiple_choice', label: 'Múltipla', required: true },
      { key: 'map', type: 'body_map', label: 'Mapa', required: true },
    ] }] };
    expect(requiredAssessmentComponentKeys(bodySchema, { multi: [] }, [])).toEqual(['multi', 'map']);
    expect(assessmentProgress(bodySchema, { multi: [] }, []).sections[0].requiredMissing).toEqual(['multi', 'map']);
    const points: any[] = [{ componentKey: 'map' }];
    expect(requiredAssessmentComponentKeys(bodySchema, { multi: ['x'] }, points)).toEqual([]);
    expect(assessmentProgress(bodySchema, { multi: ['x'] }, points).sections[0].requiredMissing).toEqual([]);
  });
});
