import { describe, expect, it } from 'vitest';
import { calculateEgfr2021 } from './egfr';

describe('CKD-EPI 2021', () => {
  it('reproduces a normal female example', () => {
    const result = calculateEgfr2021(1, 45, 'female');
    expect(result.egfr).toBe(70);
    expect(result.stage).toBe('G2');
  });

  it('classifies stage boundaries', () => {
    const g3a = calculateEgfr2021(1.5, 60, 'male');
    expect(['G3a', 'G3b']).toContain(g3a.stage);
  });

  it('is deterministic', () => {
    expect(calculateEgfr2021(0.9, 52, 'male')).toEqual(calculateEgfr2021(0.9, 52, 'male'));
  });

  it('rejects invalid inputs', () => {
    expect(() => calculateEgfr2021(0, 50, 'male')).toThrow();
    expect(() => calculateEgfr2021(1, 0, 'female')).toThrow();
  });
});
