import { describe, expect, it } from 'vitest';
import {
  emptyExamOrderPayload,
  examOrderPriorityLabel,
  examOrderReadyToIssue,
  normalizeExamOrderPayload,
  serializeExamOrderPayload,
} from './clinicalExamOrder';

describe('Clinical Exam Order D2-D1 payload contract', () => {
  it('keeps incomplete content as a valid draft shape', () => {
    const payload = emptyExamOrderPayload();
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0].examName).toBe('');
    expect(payload.priority).toBe('routine');
    expect(examOrderReadyToIssue(payload)).toBe(false);
  });

  it('requires every requested exam to be named before issue', () => {
    const payload = emptyExamOrderPayload();
    payload.items = [
      { examName: 'Hemograma completo', code: '', category: 'Laboratório', instructions: '', urgent: false },
      { examName: '   ', code: '', category: '', instructions: '', urgent: false },
    ];
    expect(examOrderReadyToIssue(payload)).toBe(false);
    payload.items[1].examName = 'TSH';
    expect(examOrderReadyToIssue(payload)).toBe(true);
  });

  it('serializes the exact canonical snake_case server payload', () => {
    const payload = emptyExamOrderPayload();
    payload.items = [{
      examName: '  Ressonância magnética de joelho ',
      code: '  RM-JOELHO ',
      category: ' Imagem ',
      instructions: ' Sem contraste. ',
      urgent: true,
    }];
    payload.clinicalIndication = ' Dor persistente após trauma. ';
    payload.impression = ' Suspeita de lesão meniscal. ';
    payload.priority = 'high';
    payload.observations = ' Comparar com exame prévio. ';

    expect(serializeExamOrderPayload(payload)).toEqual({
      items: [{
        exam_name: 'Ressonância magnética de joelho',
        code: 'RM-JOELHO',
        category: 'Imagem',
        instructions: 'Sem contraste.',
        urgent: true,
      }],
      clinical_indication: 'Dor persistente após trauma.',
      impression: 'Suspeita de lesão meniscal.',
      priority: 'high',
      observations: 'Comparar com exame prévio.',
    });
  });

  it('normalizes persisted payloads without inventing clinical content', () => {
    expect(normalizeExamOrderPayload({
      items: [{ exam_name: ' Hemograma completo ', category: ' Laboratório ', urgent: true }],
      clinical_indication: ' Investigação de anemia. ',
      impression: ' ',
      priority: 'urgent',
      observations: ' Jejum conforme orientação do laboratório. ',
    })).toEqual({
      items: [{
        examName: 'Hemograma completo',
        code: '',
        category: 'Laboratório',
        instructions: '',
        urgent: true,
      }],
      clinicalIndication: 'Investigação de anemia.',
      impression: '',
      priority: 'urgent',
      observations: 'Jejum conforme orientação do laboratório.',
    });
  });

  it('fails closed to routine when persisted priority is outside the closed enum', () => {
    expect(normalizeExamOrderPayload({ items: [], priority: 'stat' }).priority).toBe('routine');
    expect(examOrderPriorityLabel('routine')).toBe('Rotina');
    expect(examOrderPriorityLabel('high')).toBe('Prioridade alta');
    expect(examOrderPriorityLabel('urgent')).toBe('Urgente');
  });
});
