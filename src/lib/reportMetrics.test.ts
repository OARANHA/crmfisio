import { describe, expect, it } from 'vitest';
import { calculateAttendanceRate, calculateNpsSummary } from './reportMetrics';

describe('report metrics', () => {
  it('does not invent 100% attendance when there is no sample', () => {
    expect(calculateAttendanceRate(0, 0)).toBeNull();
  });

  it('calculates attendance from completed and missed sessions only', () => {
    expect(calculateAttendanceRate(8, 2)).toBe(80);
    expect(calculateAttendanceRate(3, 1)).toBe(75);
  });

  it('calculates standard NPS from promoters minus detractors', () => {
    const summary = calculateNpsSummary([10, 9, 8, 6, 4]);
    expect(summary).toEqual({
      score: 0,
      average: 7.4,
      responses: 5,
      promoters: 2,
      passives: 1,
      detractors: 2,
    });
  });

  it('returns no NPS when there are no valid responses', () => {
    expect(calculateNpsSummary([]).score).toBeNull();
    expect(calculateNpsSummary([11, -1, Number.NaN]).responses).toBe(0);
  });
});
