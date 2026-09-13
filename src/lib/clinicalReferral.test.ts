import { describe, expect, it } from 'vitest';
import {
  classifyReferralError,
  emptyReferralPayload,
  normalizeReferralPayload,
  referralPriorityLabel,
  referralProfessionalTypeLabel,
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

  it('serializes routing metadata outside the closed recipient contract and keeps canonical internal profession values', () => {
    expect(serializeReferralPayload({
      recipient: {
        scope: 'internal_professional',
        targetProfileId: ' 00000000-0000-4000-8000-000000000001 ',
        professionalName: ' Dra. Ana ', professionalType: ' Médico ', specialty: ' Cardiologia ',
        service: ' Avaliação cardiológica ', facility: ' Serviço A ', contact: ' (51) 99999-0000 ',
      },
      reason: ' Sintomas persistentes ', clinicalSummary: ' Resumo ', requestedAction: ' Avaliar ', priority: 'high', observations: ' Retorno assistencial ',
    })).toEqual({
      destination_scope: 'internal_professional',
      target_profile_id: '00000000-0000-4000-8000-000000000001',
      recipient: {
        professional_name: 'Dra. Ana', professional_type: 'medico', specialty: 'Cardiologia',
        service: 'Avaliação cardiológica', facility: 'Serviço A', contact: '(51) 99999-0000',
      },
      reason: 'Sintomas persistentes', clinical_summary: 'Resumo', requested_action: 'Avaliar', priority: 'high', observations: 'Retorno assistencial',
    });
  });

  it('does not rewrite free-text professional labels for external referrals', () => {
    const payload = emptyReferralPayload();
    payload.recipient.professionalType = 'Médica especialista';
    const serialized = serializeReferralPayload(payload) as { recipient: { professional_type: string } };
    expect(serialized.recipient.professional_type).toBe('Médica especialista');
  });

  it('normalizes legacy payloads as external and humanizes only canonical internal profession labels', () => {
    expect(normalizeReferralPayload({ recipient: { professional_type: 'psicologo' }, reason: 'Avaliação' }).recipient.professionalType).toBe('psicologo');
    expect(normalizeReferralPayload({
      destination_scope: 'internal_professional',
      target_profile_id: '00000000-0000-4000-8000-000000000001',
      recipient: { professional_name: 'Dra. Ana', professional_type: 'psicologo' }, reason: 'Avaliação', priority: 'immediate',
    })).toMatchObject({
      recipient: {
        scope: 'internal_professional',
        targetProfileId: '00000000-0000-4000-8000-000000000001',
        professionalName: 'Dra. Ana',
        professionalType: 'Psicólogo',
      },
      priority: 'routine',
    });
  });

  it('uses human labels for canonical internal professional types without guessing unknown values', () => {
    expect(referralProfessionalTypeLabel('medico')).toBe('Médico');
    expect(referralProfessionalTypeLabel('psicologo')).toBe('Psicólogo');
    expect(referralProfessionalTypeLabel('fisioterapeuta')).toBe('Fisioterapeuta');
    expect(referralProfessionalTypeLabel('quiropraxista')).toBe('Quiropraxista');
    expect(referralProfessionalTypeLabel('terapeuta_ocupacional')).toBe('terapeuta_ocupacional');
  });

  it('maps internal routing failures to actionable UI feedback', () => {
    expect(classifyReferralError(new Error('clinical_referral_target_invalid'))).toBe('target');
    expect(classifyReferralError(new Error('clinical_referral_internal_service_invalid'))).toBe('target');
    expect(classifyReferralError(new Error('clinical_referral_internal_service_required'))).toBe('payload');
  });

  it('uses human priority labels', () => {
    expect(referralPriorityLabel('routine')).toBe('Rotina');
    expect(referralPriorityLabel('high')).toBe('Prioridade alta');
    expect(referralPriorityLabel('urgent')).toBe('Urgente');
  });
});
