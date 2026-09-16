import { describe, expect, it } from 'vitest';
import {
  CAGE_PROCESSOR,
  CLINICAL_INSTRUMENT_PROCESSORS,
  GAD7_PROCESSOR,
  getClinicalInstrumentProcessor,
  PHQ9_PROCESSOR,
  PHQ15_PROCESSOR,
  PCL5_PROCESSOR,
} from '../../supabase/functions/_shared/clinical-instrument-engine';

describe('shared clinical instrument server engine', () => {
  it('keeps the canonical Nexus identity and version for supported instruments', () => {
    expect(CLINICAL_INSTRUMENT_PROCESSORS.map((item) => ({
      toolKey: item.toolKey,
      ruleKey: item.ruleKey,
      ruleVersion: item.ruleVersion,
      moduleKey: item.moduleKey,
      requiredCapability: item.requiredCapability,
    }))).toEqual([
      {
        toolKey: 'phq9',
        ruleKey: 'nexus.phq9',
        ruleVersion: 'nexus-2026-09-03',
        moduleKey: 'scales',
        requiredCapability: 'nexus.scales',
      },
      {
        toolKey: 'gad7',
        ruleKey: 'nexus.gad7',
        ruleVersion: 'nexus-2026-09-03',
        moduleKey: 'scales',
        requiredCapability: 'nexus.scales',
      },
      {
        toolKey: 'phq15',
        ruleKey: 'nexus.phq15',
        ruleVersion: 'nexus-phq15-2026-09-13',
        moduleKey: 'scales',
        requiredCapability: 'nexus.scales',
      },
      {
        toolKey: 'cage',
        ruleKey: 'nexus.cage',
        ruleVersion: 'nexus-cage-2026-09-16',
        moduleKey: 'scales',
        requiredCapability: 'nexus.scales',
      },
      {
        toolKey: 'pcl5',
        ruleKey: 'nexus.pcl5',
        ruleVersion: 'nexus-pcl5-br-2026-09-16',
        moduleKey: 'scales',
        requiredCapability: 'nexus.scales',
      },
    ]);
  });

  it('scores PHQ-9 deterministically and preserves item 9 as an independent safety signal', () => {
    const calculated = PHQ9_PROCESSOR.calculate({
      q1: 1,
      q2: 1,
      q3: 1,
      q4: 1,
      q5: 1,
      q6: 1,
      q7: 1,
      q8: 1,
      q9: 1,
    });

    expect(calculated.totalScore).toBe(9);
    expect(calculated.maxScore).toBe(27);
    expect(calculated.classification).toBe('Faixa leve de sintomas depressivos');
    expect(calculated.redFlags).toEqual([
      expect.objectContaining({
        flagCode: 'phq9.item9.positive',
        severity: 'critical',
      }),
    ]);
    expect(calculated.recommendations[0]).toContain('resposta positiva no item 9');
  });

  it('does not create a PHQ-9 safety signal when item 9 is zero', () => {
    const calculated = PHQ9_PROCESSOR.calculate({
      q1: 3,
      q2: 3,
      q3: 2,
      q4: 2,
      q5: 1,
      q6: 1,
      q7: 1,
      q8: 1,
      q9: 0,
    });

    expect(calculated.totalScore).toBe(14);
    expect(calculated.classification).toBe('Faixa moderada de sintomas depressivos');
    expect(calculated.redFlags).toEqual([]);
  });

  it('scores GAD-7 with the canonical 0-21 cutoffs', () => {
    const calculated = GAD7_PROCESSOR.calculate({
      q1: 2,
      q2: 2,
      q3: 2,
      q4: 2,
      q5: 2,
      q6: 2,
      q7: 3,
    });

    expect(calculated.totalScore).toBe(15);
    expect(calculated.maxScore).toBe(21);
    expect(calculated.classification).toBe('Faixa grave de sintomas ansiosos');
    expect(calculated.redFlags).toEqual([]);
  });

  it('scores PHQ-15 deterministically with the canonical 0-30 severity bands', () => {
    const calculated = PHQ15_PROCESSOR.calculate(Object.fromEntries(
      Array.from({ length: 15 }, (_, index) => [`q${index + 1}`, 1]),
    ));

    expect(calculated.totalScore).toBe(15);
    expect(calculated.maxScore).toBe(30);
    expect(calculated.classification).toBe('Faixa alta de sintomas somáticos');
    expect(calculated.redFlags).toEqual([]);
    expect(calculated.recommendations.join(' ')).toContain('não diferencia causa orgânica');
  });


  it('scores CAGE only with four explicit binary answers and keeps screening language non-diagnostic', () => {
    const positive = CAGE_PROCESSOR.calculate({ q1: 1, q2: 1, q3: 0, q4: 0 });
    expect(positive.totalScore).toBe(2);
    expect(positive.maxScore).toBe(4);
    expect(positive.classification).toContain('Rastreio positivo');
    expect(positive.severity).toBe('moderate');
    expect(positive.interpretation).toContain('não estabelece diagnóstico');
    expect(positive.redFlags).toEqual([]);

    const negative = CAGE_PROCESSOR.calculate({ q1: 1, q2: 0, q3: 0, q4: 0 });
    expect(negative.totalScore).toBe(1);
    expect(negative.classification).toContain('Rastreio negativo');
    expect(negative.interpretation).toContain('não exclui uso de risco');
  });


  it('scores PCL-5 with the versioned Brazilian cutoff and keeps screening language non-diagnostic', () => {
    const answers = Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`q${index + 1}`, index < 18 ? 2 : 0]));
    const positive = PCL5_PROCESSOR.calculate(answers);
    expect(positive.totalScore).toBe(36);
    expect(positive.maxScore).toBe(80);
    expect(positive.classification).toContain('Rastreio positivo');
    expect(positive.severity).toBe('moderate');
    expect(positive.interpretation).toContain('não estabelece diagnóstico');
    expect(positive.recommendations.join(' ')).toContain('Critério A');
    expect(positive.redFlags).toEqual([]);

    const negative = PCL5_PROCESSOR.calculate(Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`q${index + 1}`, index < 17 ? 2 : 0])));
    expect(negative.totalScore).toBe(34);
    expect(negative.classification).toContain('abaixo do corte');
    expect(negative.interpretation).toContain('não exclui TEPT');
  });

  it('fails closed on incomplete, out-of-range or unknown instruments', () => {
    expect(() => PHQ9_PROCESSOR.calculate({ q1: 0 })).toThrow('PHQ-9 incompleto');
    expect(() => GAD7_PROCESSOR.calculate({
      q1: 0,
      q2: 0,
      q3: 0,
      q4: 0,
      q5: 0,
      q6: 0,
      q7: 4,
    })).toThrow('GAD-7 incompleto ou com resposta fora da faixa 0-3');
    expect(() => PHQ15_PROCESSOR.calculate({ q1: 0 })).toThrow('PHQ-15 incompleto');
    expect(() => PHQ15_PROCESSOR.calculate(Object.fromEntries(Array.from({ length: 15 }, (_, index) => [`q${index + 1}`, index === 14 ? 3 : 0])))).toThrow('PHQ-15 incompleto ou com resposta fora da faixa 0-2');
    expect(() => CAGE_PROCESSOR.calculate({ q1: 1, q2: 0, q3: 1 })).toThrow('CAGE incompleto');
    expect(() => CAGE_PROCESSOR.calculate({ q1: 1, q2: 0, q3: 1, q4: 2 })).toThrow('CAGE incompleto ou com resposta fora da faixa 0-1');
    expect(() => PCL5_PROCESSOR.calculate({ q1: 0 })).toThrow('PCL-5 incompleto');
    expect(() => PCL5_PROCESSOR.calculate(Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`q${index + 1}`, index === 19 ? 5 : 0])))).toThrow('PCL-5 incompleto ou com resposta fora da faixa 0-4');
    expect(getClinicalInstrumentProcessor('unknown')).toBeNull();
  });
});
