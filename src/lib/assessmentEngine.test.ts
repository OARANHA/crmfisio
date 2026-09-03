import { describe, expect, it } from 'vitest';
import { clampNormalizedCoordinate, isAssessmentTemplateSchema } from './assessmentEngine';

describe('assessmentEngine helpers', () => {
  it('clamps body-map coordinates into the normalized range', () => {
    expect(clampNormalizedCoordinate(-0.3)).toBe(0);
    expect(clampNormalizedCoordinate(0.42)).toBe(0.42);
    expect(clampNormalizedCoordinate(2)).toBe(1);
    expect(clampNormalizedCoordinate(Number.NaN)).toBe(0);
  });

  it('accepts a minimal valid assessment schema', () => {
    expect(isAssessmentTemplateSchema({
      sections: [
        {
          key: 'dor',
          title: 'Dor',
          components: [
            { key: 'eva', type: 'scale', label: 'Intensidade', required: true },
            { key: 'mapa', type: 'body_map', label: 'Mapa corporal' },
          ],
        },
      ],
    })).toBe(true);
  });

  it('rejects duplicate component keys inside the same section', () => {
    expect(isAssessmentTemplateSchema({
      sections: [
        {
          key: 'dor',
          title: 'Dor',
          components: [
            { key: 'eva', type: 'scale', label: 'Intensidade' },
            { key: 'eva', type: 'long_text', label: 'Observação' },
          ],
        },
      ],
    })).toBe(false);
  });

  it('rejects unsupported component types', () => {
    expect(isAssessmentTemplateSchema({
      sections: [
        {
          key: 'x',
          title: 'X',
          components: [{ key: 'foo', type: 'script', label: 'Foo' }],
        },
      ],
    })).toBe(false);
  });
});
