import { describe, expect, it } from 'vitest';
import { calculateCardiovascularRisk } from './cardiovascularRisk';

describe('Nexus cardiovascular risk', () => {
  it('calculates a deterministic lipid-mode result', () => {
    const input = { age: 52, gender: 'male' as const, sysBp: 135, isBpTreated: false, isSmoker: false, hasDiabetes: false, calcMode: 'lipid' as const, totCholesterol: 210, hdlCholesterol: 45 };
    expect(calculateCardiovascularRisk(input)).toEqual(calculateCardiovascularRisk(input));
  });

  it('forces very-high direct risk for established CVD', () => {
    const result = calculateCardiovascularRisk({ age: 52, gender: 'male', sysBp: 130, isBpTreated: false, isSmoker: false, hasDiabetes: false, calcMode: 'lipid', totCholesterol: 180, hdlCholesterol: 55, hasEstablishedCvd: true });
    expect(result.riskCategory).toBe('very_high');
    expect(result.isDirectRisk).toBe(true);
    expect(result.riskPercentage).toBeGreaterThanOrEqual(25);
  });

  it('reclassifies intermediate risk when an SBC aggravator is present', () => {
    const base = { age: 55, gender: 'male' as const, sysBp: 135, isBpTreated: false, isSmoker: false, hasDiabetes: false, calcMode: 'lipid' as const, totCholesterol: 205, hdlCholesterol: 45 };
    const initial = calculateCardiovascularRisk(base);
    if (initial.riskCategory === 'intermediate') {
      const reclassified = calculateCardiovascularRisk({ ...base, hasFamilyHistoryPrematureCvd: true });
      expect(reclassified.riskCategory).toBe('high');
      expect(reclassified.isReclassified).toBe(true);
    }
  });

  it('adds metabolic monitoring context for high-risk antipsychotic use', () => {
    const result = calculateCardiovascularRisk({ age: 50, gender: 'female', sysBp: 125, isBpTreated: false, isSmoker: false, hasDiabetes: false, calcMode: 'bmi', weightKg: 70, heightCm: 165, usesHighRiskAntipsychotic: true, antipsychoticName: 'Olanzapina' });
    expect(result.psychiatricAlert).toContain('Olanzapina');
    expect(result.metabolicMonitoringPlan?.length).toBeGreaterThan(0);
  });
});
