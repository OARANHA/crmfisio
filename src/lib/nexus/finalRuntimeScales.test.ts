import { describe, expect, it } from 'vitest';
import { calculateScale } from './scaleRuntime';
import {
  HAMA_DEFINITION,
  ISI_DEFINITION,
  MDQ_DEFINITION,
  PCL5_DEFINITION,
  PCPTSD5_DEFINITION,
  SNAP_IV_DEFINITION,
} from './finalRuntimeScales';

const answers = (definition: { questions: readonly { id: string }[] }, value: number) =>
  Object.fromEntries(definition.questions.map((q) => [q.id, value]));

describe('Nexus final runtime scales', () => {
  it('SNAP-IV identifica apresentação combinada quando ambos domínios têm 6+ itens significativos', () => {
    const input = answers(SNAP_IV_DEFINITION, 0);
    for (let i = 1; i <= 6; i++) input[`q${i}`] = 2;
    for (let i = 10; i <= 15; i++) input[`q${i}`] = 2;
    const result = calculateScale(SNAP_IV_DEFINITION, input);
    expect(result.classification).toContain('Combinada');
    expect(result.structuredData?.desatencaoItems).toBe(6);
    expect(result.structuredData?.hiperatividadeItems).toBe(6);
  });

  it('ISI preserva as quatro faixas do Nexus', () => {
    const make = (score: number) => {
      const input = answers(ISI_DEFINITION, 0);
      let remaining = score;
      for (const q of ISI_DEFINITION.questions) {
        const v = Math.min(4, remaining);
        input[q.id] = v;
        remaining -= v;
      }
      return calculateScale(ISI_DEFINITION, input);
    };
    expect(make(7).severity).toBe('low');
    expect(make(8).severity).toBe('moderate');
    expect(make(15).severity).toBe('high');
    expect(make(22).severity).toBe('severe');
  });

  it('HAM-A preserva os pontos de transição executáveis', () => {
    const make = (score: number) => {
      const input = answers(HAMA_DEFINITION, 0);
      let remaining = score;
      for (const q of HAMA_DEFINITION.questions) {
        const v = Math.min(4, remaining);
        input[q.id] = v;
        remaining -= v;
      }
      return calculateScale(HAMA_DEFINITION, input);
    };
    expect(make(13).severity).toBe('low');
    expect(make(14).severity).toBe('moderate');
    expect(make(18).severity).toBe('high');
    expect(make(25).severity).toBe('severe');
  });

  it('MDQ preserva >=7/13 e sinaliza revisão de simultaneidade/prejuízo', () => {
    const input = answers(MDQ_DEFINITION, 0);
    for (let i = 1; i <= 7; i++) input[`q${i}`] = 1;
    const result = calculateScale(MDQ_DEFINITION, input);
    expect(result.severity).toBe('high');
    expect(result.structuredData?.clinicalReviewRequired).toBe('mdq-missing-concurrency-impairment-items');
  });

  it('PC-PTSD-5 usa corte >=3', () => {
    const input = answers(PCPTSD5_DEFINITION, 0);
    input.q1 = 1; input.q2 = 1; input.q3 = 1;
    expect(calculateScale(PCPTSD5_DEFINITION, input).severity).toBe('high');
  });

  it('PCL-5 usa corte executável >=33 e persiste clusters', () => {
    const input = answers(PCL5_DEFINITION, 0);
    let remaining = 33;
    for (const q of PCL5_DEFINITION.questions) {
      const v = Math.min(4, remaining);
      input[q.id] = v;
      remaining -= v;
    }
    const result = calculateScale(PCL5_DEFINITION, input);
    expect(result.totalScore).toBe(33);
    expect(result.severity).toBe('high');
    expect(result.structuredData?.intrusao).toBeDefined();
    expect(result.structuredData?.hiperativacao).toBeDefined();
  });
});
