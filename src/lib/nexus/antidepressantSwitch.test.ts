import { describe, expect, it } from 'vitest';
import { calculateAntidepressantTransition } from './antidepressantSwitch';

describe('Nexus antidepressant switching', () => {
  it('uses direct switch from fluoxetine to non-MAOI', () => {
    const result = calculateAntidepressantTransition('fluoxetina', 40, 'sertralina');
    expect(result.strategyType).toBe('direct');
    expect(result.recommendedTargetDoseMg).toBe(100);
    expect(result.timelineSteps).toHaveLength(2);
  });

  it('uses direct switch between low/medium dose SSRIs', () => {
    const result = calculateAntidepressantTransition('sertralina', 50, 'escitalopram');
    expect(result.strategyType).toBe('direct');
  });

  it('uses gradual cross taper for ordinary cross-class transition', () => {
    const result = calculateAntidepressantTransition('venlafaxina', 150, 'mirtazapina');
    expect(result.strategyType).toBe('cross_taper');
    expect(result.timelineSteps).toHaveLength(3);
  });

  it('preserves five-week fluoxetine washout before tranylcypromine', () => {
    const result = calculateAntidepressantTransition('fluoxetina', 40, 'tranilcipromina');
    expect(result.strategyType).toBe('washout');
    expect(result.durationWeeks).toBe(6);
    expect(result.clinicalRisks.serotoninSyndrome.risk).toBe('Crítico');
  });

  it('preserves 14-day washout after tranylcypromine', () => {
    const result = calculateAntidepressantTransition('tranilcipromina', 20, 'sertralina');
    expect(result.strategyType).toBe('washout');
    expect(result.timelineSteps[0].periodLabel).toContain('14');
  });

  it('rejects unknown drug or invalid dose', () => {
    expect(() => calculateAntidepressantTransition('nope', 20, 'sertralina')).toThrow();
    expect(() => calculateAntidepressantTransition('sertralina', 0, 'escitalopram')).toThrow();
  });
});
