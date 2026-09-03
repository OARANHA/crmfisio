import { describe, expect, it } from 'vitest';
import { isMinorBirthDate } from './patientRegistry';

describe('Patient Registry V2', () => {
  it('treats a patient under 18 as minor', () => {
    expect(isMinorBirthDate('2010-09-04', new Date('2026-09-03T16:00:00-03:00'))).toBe(true);
  });

  it('treats a patient whose 18th birthday already occurred as adult', () => {
    expect(isMinorBirthDate('2008-09-03', new Date('2026-09-03T16:00:00-03:00'))).toBe(false);
  });

  it('returns false for an empty date', () => {
    expect(isMinorBirthDate('')).toBe(false);
  });
});
