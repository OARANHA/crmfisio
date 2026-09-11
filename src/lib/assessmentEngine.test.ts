import { describe, expect, it } from 'vitest';
import { clampNormalizedCoordinate, isAssessmentTemplateSchema, validateAssessmentTemplateSchemaForAuthoring } from './assessmentEngine';

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

  it('rejects duplicate component keys across sections', () => {
    expect(isAssessmentTemplateSchema({
      sections: [
        {
          key: 'dor',
          title: 'Dor',
          components: [{ key: 'eva', type: 'scale', label: 'Intensidade' }],
        },
        {
          key: 'funcao',
          title: 'Função',
          components: [{ key: 'eva', type: 'long_text', label: 'Observação' }],
        },
      ],
    })).toBe(false);
  });

  it('rejects duplicate section keys', () => {
    expect(isAssessmentTemplateSchema({
      sections: [
        { key: 'dor', title: 'Dor', components: [] },
        { key: 'dor', title: 'Dor 2', components: [] },
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

describe('assessment template authoring validation', () => {
  const schema = (component: Record<string, unknown>) => ({ sections: [{ key: 'dor', title: 'Dor', components: [component] }] }) as any;

  it.each([
    ['empty label', schema({ key: 'dor', type: 'long_text', label: '  ' })],
    ['choice without options', schema({ key: 'tipo', type: 'single_choice', label: 'Tipo', config: { options: [] } })],
    ['empty option', schema({ key: 'tipo', type: 'multiple_choice', label: 'Tipo', config: { options: ['A', '  '] } })],
    ['normalized duplicate options', schema({ key: 'tipo', type: 'single_choice', label: 'Tipo', config: { options: ['Dor', ' dor '] } })],
  ])('rejects %s', (_name, value) => {
    expect(validateAssessmentTemplateSchemaForAuthoring(value)).toBeTruthy();
  });

  it('keeps section and component order while accepting valid choice options', () => {
    const value = schema({ key: 'tipo', type: 'single_choice', label: 'Tipo', required: true, config: { options: ['Aguda', 'Crônica'] } });
    expect(validateAssessmentTemplateSchemaForAuthoring(value)).toBeNull();
    expect(value.sections[0].components[0].key).toBe('tipo');
    expect(value.sections[0].components.map((component: { key: string }) => component.key)).toEqual(['tipo']);
  });
});
