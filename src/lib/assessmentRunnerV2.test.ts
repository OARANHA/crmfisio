import { describe, expect, it } from 'vitest';
import { assessmentProgress } from './assessmentRunnerV2';

describe('assessment runner V2 progress', () => {
  const schema: any = { sections: [
    { key: 'a', title: 'A', components: [{ key: 'title', type: 'heading', label: 'x' }, { key: 'name', type: 'short_text', label: 'Nome', required: true }] },
    { key: 'b', title: 'B', components: [{ key: 'note', type: 'info', label: 'x' }, { key: 'pain', type: 'scale', label: 'Dor', required: true }] },
  ] };
  it('ignores heading/info and identifies the first required section', () => {
    const result = assessmentProgress(schema, { pain: 4 }, []);
    expect(result).toMatchObject({ total: 2, complete: 1, firstRequiredSection: 0 });
  });
});
