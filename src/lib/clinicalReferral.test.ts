import { describe, expect, it } from 'vitest';
import {
  emptyReferralPayload,
  normalizeReferralPayload,
  referralPriorityLabel,
  referralReadyToIssue,
  serializeReferralPayload,
} from './clinicalReferral';

describe('clinicalReferral', () => {
  it('starts with an intentionally incomplete external draft', () => {
    expect(emptyReferralPayload()).toEqual({
      recipient: {
        scope: 'external',
        targetProfileId: '',
        professionalName: '',
        professionalType: '',
        specialty: '',
        service: '',
        facility: '',
        contact: '',
      },
      reason: '', clinicalSummary: '', requestedAction: '', priority: 'routine', observations: '',
    });
  });

  it('keeps external referrals compatible with the original identifying fields', () => {
    const payload = emptyReferralPayload();
    payload.reason = 'Avaliação especializada';
    expect(referralReadyToIssue(payload)).toBe(false);
    payload.recipient.specialty = 'Cardiologia';
    expect(referralReadyToIssue(payload)).toBe(true);
    payload.recipient.specialty = '';
    payload.recipient.contact = 'contato@servico.test';
    expect(referralReadyToIssue(payload)).toBe(false);
  });

  it('requires a stable target id for internal professional referrals', () => {
    const payload = emptyReferralPayload();
    payload.reason = 'Continuidade do cuidado';
    payload.recipient.scope = 'internal_professional';
    payload.recipient.professionalName = 'Dra. Ana';
    expect(referralReadyToIssue(payload)).toBe(false);
    payload.recipient.targetProfileId = '00000000-0000-4000-8000-000000000001';
    expect(referralReadyToIssue(payload)).toBe(true);
  });

  it('allows an internal specialty/service destination without inventing a professional id', () => {
    const payload = emptyReferralPayload();
    payload.reason = 'Continuidade do cuidado';
    payload.recipient.scope = 'internal_service';
    payload.recipient.specialty = 'Psicologia';
    expect(referralReadyToIssue(payload)).toBe(true);
    expect(payload.recipient.targetProfileId).toBe('');
  });

  it('serializes routing metadata outside the closed recipient contract', () => {
    expect(serializeReferralPayload({
      recipient: {
        scope: 'internal_professional',
        targetProfileId: ' 00000000-0000-4000-8000-000000000001 ',
        professionalName: ' Dra. Ana ', professionalType: ' Médica ', specialty: ' Cardiologia ',
        service: ' Avaliação cardiológica ', facility: ' Serviço A ', contact: ' (51) 99999-0000 ',
      },
      reason: ' Sintomas persistentes ', clinicalSummary: ' Resumo ', requestedAction: ' Avaliar ', priority: 'high', observations: ' Retorno assistencial ',
    })).toEqual({
      destination_scope: 'internal_professional',
      target_profile_id: '00000000-0000-4000-8000-000000000001',
      recipient: {
        professional_name: 'Dra. Ana', professional_type: 'Médica', specialty: 'Cardiologia',
        service: 'Avaliação cardiológica', facility: 'Serviço A', contact: '(51) 99999-0000',
      },
      reason: 'Sintomas persistentes', clinical_summary: 'Resumo', requested_action: 'Avaliar', priority: 'high', observations: 'Retorno assistencial',
    });
  });

  it('normalizes legacy payloads as external and new routing metadata explicitly', () => {
    expect(normalizeReferralPayload({ recipient: { professional_name: 'Dra. Ana', specialty: 'Cardiologia' }, reason: 'Avaliação' }).recipient.scope).toBe('external');
    expect(normalizeReferralPayload({
      destination_scope: 'internal_professional',
      target_profile_id: '00000000-0000-4000-8000-000000000001',
      recipient: { professional_name: 'Dra. Ana' }, reason: 'Avaliação', priority: 'immediate',
    })).toMatchObject({
      recipient: { scope: 'internal_professional', targetProfileId: '00000000-0000-4000-8000-000000000001', professionalName: 'Dra. Ana' },
      priority: 'routine',
    });
  });

  it('uses human priority labels', () => {
    expect(referralPriorityLabel('routine')).toBe('Rotina');
    expect(referralPriorityLabel('high')).toBe('Prioridade alta');
    expect(referralPriorityLabel('urgent')).toBe('Urgente');
  });
});
