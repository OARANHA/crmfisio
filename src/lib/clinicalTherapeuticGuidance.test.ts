import { describe, expect, it } from 'vitest';
import {
  emptyTherapeuticGuidancePayload,
  normalizeTherapeuticGuidancePayload,
  serializeTherapeuticGuidancePayload,
  therapeuticGuidanceReadyToIssue,
} from './clinicalTherapeuticGuidance';

describe('Clinical Therapeutic Guidance V1 payload contract', () => {
  it('keeps an incomplete guidance item valid as a draft shape', () => {
    const payload = emptyTherapeuticGuidancePayload();
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].guidance).toBe('');
    expect(therapeuticGuidanceReadyToIssue(payload)).toBe(false);
  });

  it('requires every guidance item to contain explicit content before issue', () => {
    const payload = emptyTherapeuticGuidancePayload();
    payload.items = [{ guidance: 'Manter hidratação adequada.' }, { guidance: '   ' }];
    expect(therapeuticGuidanceReadyToIssue(payload)).toBe(false);
    payload.items[1].guidance = 'Retornar se houver piora dos sintomas.';
    expect(therapeuticGuidanceReadyToIssue(payload)).toBe(true);
  });

  it('serializes the exact D2-A therapeutic_guidance payload without inventing content', () => {
    const payload = emptyTherapeuticGuidancePayload();
    payload.items = [
      { guidance: '  Fazer pausas durante atividades prolongadas. ' },
      { guidance: ' Manter rotina de sono regular. ' },
    ];
    payload.patientInstructions = '  Levar estas orientações para casa. ';
    payload.observations = '  Reavaliar no próximo atendimento. ';

    expect(serializeTherapeuticGuidancePayload(payload)).toEqual({
      items: [
        { guidance: 'Fazer pausas durante atividades prolongadas.' },
        { guidance: 'Manter rotina de sono regular.' },
      ],
      patient_instructions: 'Levar estas orientações para casa.',
      observations: 'Reavaliar no próximo atendimento.',
    });
  });

  it('normalizes persisted snake_case payloads and preserves only authored content', () => {
    expect(normalizeTherapeuticGuidancePayload({
      items: [{ guidance: '  Evitar esforço acima do habitual. ' }],
      patient_instructions: '  Procurar atendimento em caso de sinais de alerta. ',
      observations: '  Sem intercorrências. ',
    })).toEqual({
      items: [{ guidance: 'Evitar esforço acima do habitual.' }],
      patientInstructions: 'Procurar atendimento em caso de sinais de alerta.',
      observations: 'Sem intercorrências.',
    });
  });
});
