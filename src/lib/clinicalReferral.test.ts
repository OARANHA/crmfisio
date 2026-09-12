import { describe, expect, it } from 'vitest';
import {
  emptyReferralPayload,
  normalizeReferralPayload,
  referralPriorityLabel,
  referralReadyToIssue,
  serializeReferralPayload,
} from './clinicalReferral';

describe('clinicalReferral', () => {
  it('starts with an intentionally incomplete draft', () => {
    expect(emptyReferralPayload()).toEqual({
      recipient: {
        professionalName: '',
        professionalType: '',
        specialty: '',
        service: '',
        facility: '',
        contact: '',
      },
      reason: '',
      clinicalSummary: '',
      requestedAction: '',
      priority: 'routine',
      observations: '',
    });
  });

  it('requires both an identifiable recipient and a reason before issue', () => {
    const payload = emptyReferralPayload();
    expect(referralReadyToIssue(payload)).toBe(false);
    payload.reason = 'Avaliação especializada';
    expect(referralReadyToIssue(payload)).toBe(false);
    payload.recipient.specialty = 'Cardiologia';
    expect(referralReadyToIssue(payload)).toBe(true);
  });

  it('accepts any canonical identifying recipient field but not contact alone', () => {
    const base = { ...emptyReferralPayload(), reason: 'Continuidade do cuidado' };
    expect(referralReadyToIssue({ ...base, recipient: { ...base.recipient, contact: 'contato@servico.test' } })).toBe(false);
    expect(referralReadyToIssue({ ...base, recipient: { ...base.recipient, professionalName: 'Dra. Ana' } })).toBe(true);
    expect(referralReadyToIssue({ ...base, recipient: { ...base.recipient, professionalType: 'Psicólogo' } })).toBe(true);
    expect(referralReadyToIssue({ ...base, recipient: { ...base.recipient, service: 'Reabilitação' } })).toBe(true);
    expect(referralReadyToIssue({ ...base, recipient: { ...base.recipient, facility: 'Serviço de referência' } })).toBe(true);
  });

  it('serializes exactly to the server snake_case contract', () => {
    expect(serializeReferralPayload({
      recipient: {
        professionalName: ' Dra. Ana ',
        professionalType: ' Médica ',
        specialty: ' Cardiologia ',
        service: ' Avaliação cardiológica ',
        facility: ' Serviço A ',
        contact: ' (51) 99999-0000 ',
      },
      reason: ' Sintomas persistentes ',
      clinicalSummary: ' Resumo ',
      requestedAction: ' Avaliar ',
      priority: 'high',
      observations: ' Retorno assistencial ',
    })).toEqual({
      recipient: {
        professional_name: 'Dra. Ana',
        professional_type: 'Médica',
        specialty: 'Cardiologia',
        service: 'Avaliação cardiológica',
        facility: 'Serviço A',
        contact: '(51) 99999-0000',
      },
      reason: 'Sintomas persistentes',
      clinical_summary: 'Resumo',
      requested_action: 'Avaliar',
      priority: 'high',
      observations: 'Retorno assistencial',
    });
  });

  it('normalizes persisted payloads and fails safe to routine priority', () => {
    expect(normalizeReferralPayload({
      recipient: { professional_name: 'Dra. Ana', specialty: 'Cardiologia' },
      reason: 'Avaliação',
      clinical_summary: 'Resumo',
      requested_action: 'Conduta',
      priority: 'immediate',
    })).toMatchObject({
      recipient: { professionalName: 'Dra. Ana', specialty: 'Cardiologia' },
      reason: 'Avaliação',
      clinicalSummary: 'Resumo',
      requestedAction: 'Conduta',
      priority: 'routine',
    });
  });

  it('uses human priority labels', () => {
    expect(referralPriorityLabel('routine')).toBe('Rotina');
    expect(referralPriorityLabel('high')).toBe('Prioridade alta');
    expect(referralPriorityLabel('urgent')).toBe('Urgente');
  });
});
