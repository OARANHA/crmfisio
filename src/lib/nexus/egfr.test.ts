import { describe, expect, it } from 'vitest';
import { calculateEgfr2021 } from './egfr';

describe('CKD-EPI 2021', () => {
  it('reproduces a female example exactly', () => {
    const result = calculateEgfr2021(1, 45, 'female');
    expect(result.egfr).toBe(71);
    expect(result.stage).toBe('G2');
  });

  it('classifies a G3a example', () => {
    const result = calculateEgfr2021(1.5, 60, 'male');
    expect(result.egfr).toBe(53);
    expect(result.stage).toBe('G3a');
  });

  it('is deterministic', () => {
    expect(calculateEgfr2021(0.9, 52, 'male')).toEqual(calculateEgfr2021(0.9, 52, 'male'));
  });

  it('rejects invalid inputs', () => {
    expect(() => calculateEgfr2021(0, 50, 'male')).toThrow();
    expect(() => calculateEgfr2021(1, 0, 'female')).toThrow();
  });
});
