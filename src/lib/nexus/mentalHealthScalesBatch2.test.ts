import { describe, expect, it } from 'vitest';
import { calculateScale } from './scaleRuntime';
import {
  ASRS18_DEFINITION,
  EPDS_DEFINITION,
  PHQ15_DEFINITION,
  SRQ20_DEFINITION,
  YBOCS_DEFINITION,
} from './mentalHealthScalesBatch2';

const fill = (count: number, value: number) => Object.fromEntries(Array.from({ length: count }, (_, index) => [`q${index + 1}`, value]));

describe('Nexus mental-health batch 2', () => {
  it('ASRS-18 preserva classificação por domínio', () => {
    const answers = fill(18, 0);
    for (const id of ['q1','q2','q3','q4']) answers[id] = 1;
    expect(calculateScale(ASRS18_DEFINITION, answers).classification).toContain('Predomínio Desatento');
    for (const id of ['q10','q11','q12','q13']) answers[id] = 1;
    const result = calculateScale(ASRS18_DEFINITION, answers);
    expect(result.classification).toContain('Combinada');
    expect(result.structuredData).toMatchObject({ inattention: 4, hyperactivity: 4 });
  });

  it('Y-BOCS preserva cortes 7/8/15/16/23/24/31/32', () => {
    const base = fill(10, 0);
    const result0 = calculateScale(YBOCS_DEFINITION, base);
    expect(result0.totalScore).toBe(0);
    const cases = [
      [8, 'leve'], [16, 'moderada'], [24, 'grave'], [32, 'extremamente grave'],
    ] as const;
    for (const [score, text] of cases) {
      const answers = fill(10, Math.floor(score / 10));
      let remaining = score - Object.values(answers).reduce((a, b) => a + b, 0);
      for (let i = 1; i <= 10 && remaining > 0; i++) {
        const room = 4 - answers[`q${i}`];
        const add = Math.min(room, remaining);
        answers[`q${i}`] += add;
        remaining -= add;
      }
      expect(calculateScale(YBOCS_DEFINITION, answers).classification.toLowerCase()).toContain(text);
    }
  });

  it('EPDS item 10 positivo gera red flag crítica mesmo com escore baixo', () => {
    const answers = fill(10, 0);
    answers.q10 = 1;
    const result = calculateScale(EPDS_DEFINITION, answers);
    expect(result.severity).toBe('severe');
    expect(result.redFlags?.[0]?.flagCode).toBe('epds.item10.self-harm');
  });

  it('SRQ-20 usa corte >=7 e item 17 gera red flag crítica', () => {
    const answers = fill(20, 0);
    for (let i = 1; i <= 7; i++) answers[`q${i}`] = 1;
    expect(calculateScale(SRQ20_DEFINITION, answers).classification).toContain('Positivo');
    const safety = fill(20, 0);
    safety.q17 = 1;
    const result = calculateScale(SRQ20_DEFINITION, safety);
    expect(result.severity).toBe('severe');
    expect(result.redFlags?.[0]?.flagCode).toBe('srq20.item17.death-ideation');
  });

  it('PHQ-15 preserva quatro faixas de gravidade', () => {
    const score = (target: number) => {
      const answers = fill(15, 0);
      let remaining = target;
      for (let i = 1; i <= 15 && remaining > 0; i++) {
        const add = Math.min(2, remaining);
        answers[`q${i}`] = add;
        remaining -= add;
      }
      return calculateScale(PHQ15_DEFINITION, answers).classification;
    };
    expect(score(4)).toContain('mínima');
    expect(score(5)).toContain('baixa');
    expect(score(10)).toContain('média');
    expect(score(15)).toContain('alta');
  });
});
