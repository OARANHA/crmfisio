import { describe, expect, it } from 'vitest';
import { calculateGad7, type Gad7Answers } from './gad7';

const answersForTotal = (total: number): Gad7Answers => {
  const answers: Gad7Answers = {};
  let remaining = total;
  for (let i = 1; i <= 7; i += 1) {
    const value = Math.min(3, remaining) as 0 | 1 | 2 | 3;
    answers[`q${i}` as keyof Gad7Answers] = value;
    remaining -= value;
  }
  return answers;
};

describe('GAD-7 Nexus', () => {
  it.each([
    [0, 'Ansiedade mínima ou ausente'],
    [4, 'Ansiedade mínima ou ausente'],
    [5, 'Ansiedade leve'],
    [9, 'Ansiedade leve'],
    [10, 'Ansiedade moderada'],
    [14, 'Ansiedade moderada'],
    [15, 'Ansiedade grave'],
    [21, 'Ansiedade grave'],
  ])('preserva corte %i', (score, classification) => {
    const result = calculateGad7(answersForTotal(score));
    expect(result.totalScore).toBe(score);
    expect(result.classification).toBe(classification);
  });

  it('rejeita instrumento incompleto', () => {
    expect(() => calculateGad7({ q1: 1 })).toThrow(/incompleto/i);
  });
});
