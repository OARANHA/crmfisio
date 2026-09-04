import { describe, expect, it } from 'vitest';
import { calculateCssrs, type CssrsAnswers } from './cssrs';

const answers = (values: Partial<CssrsAnswers> = {}): CssrsAnswers => ({
  q1: 0,
  q2: 0,
  q3: 0,
  q4: 0,
  q5: 0,
  q6: 0,
  ...values,
});

describe('Nexus C-SSRS', () => {
  it('classifies level 0 as no active suicidal ideation', () => {
    const result = calculateCssrs(answers());
    expect(result.totalScore).toBe(0);
    expect(result.severity).toBe('low');
    expect(result.classification).toContain('Sem ideação');
  });

  it('classifies levels 1 and 2 as low risk', () => {
    expect(calculateCssrs(answers({ q1: 1 })).classification).toBe('Risco Baixo de Suicídio');
    expect(calculateCssrs(answers({ q2: 2 })).classification).toBe('Risco Baixo de Suicídio');
  });

  it('classifies level 3 as moderate risk', () => {
    const result = calculateCssrs(answers({ q3: 3 }));
    expect(result.totalScore).toBe(3);
    expect(result.severity).toBe('moderate');
    expect(result.classification).toBe('Risco Moderado de Suicídio');
  });

  it('classifies levels 4 and 5 as high-risk emergency', () => {
    const level4 = calculateCssrs(answers({ q4: 4 }));
    const level5 = calculateCssrs(answers({ q5: 5 }));
    expect(level4.severity).toBe('severe');
    expect(level5.severity).toBe('severe');
    expect(level4.classification).toContain('Emergência');
    expect(level5.classification).toContain('Emergência');
  });

  it('uses the maximum endorsed level rather than summing responses', () => {
    const result = calculateCssrs(answers({ q1: 1, q2: 2, q3: 3 }));
    expect(result.totalScore).toBe(3);
  });

  it('maps prior/recent suicidal behavior to level 5', () => {
    const result = calculateCssrs(answers({ q6: 5 }));
    expect(result.totalScore).toBe(5);
    expect(result.severity).toBe('severe');
  });

  it('rejects incomplete answers', () => {
    expect(() => calculateCssrs({ q1: 0 })).toThrow(/incompleta/i);
  });
});
