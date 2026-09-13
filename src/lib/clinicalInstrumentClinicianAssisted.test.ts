import { describe, expect, it } from 'vitest';
import {
  buildClinicianAssistedRequestPayload,
  CLINICIAN_ASSISTED_INSTRUMENT_KEYS,
} from './clinicalInstrumentClinicianAssisted';

describe('clinician-assisted instrument browser boundary', () => {
  it('exposes only the neutral PHQ-9/GAD-7 keys', () => {
    expect(CLINICIAN_ASSISTED_INSTRUMENT_KEYS).toEqual(['phq9', 'gad7']);
  });

  it('builds the minimal Edge payload without tenant, patient, actor, engine or score authority', () => {
    const payload = buildClinicianAssistedRequestPayload(
      '11111111-1111-4111-8111-111111111111',
      'phq9',
      '22222222-2222-4222-8222-222222222222',
      { q1: 0, q2: 1, q3: 2, q4: 3, q5: 0, q6: 1, q7: 2, q8: 3, q9: 0 },
    );

    expect(payload).toEqual({
      appointmentId: '11111111-1111-4111-8111-111111111111',
      instrumentKey: 'phq9',
      requestId: '22222222-2222-4222-8222-222222222222',
      answers: { q1: 0, q2: 1, q3: 2, q4: 3, q5: 0, q6: 1, q7: 2, q8: 3, q9: 0 },
    });
    expect(Object.keys(payload).sort()).toEqual(['answers', 'appointmentId', 'instrumentKey', 'requestId']);
    expect(payload).not.toHaveProperty('clinicId');
    expect(payload).not.toHaveProperty('patientId');
    expect(payload).not.toHaveProperty('professionalId');
    expect(payload).not.toHaveProperty('engineRuleVersion');
    expect(payload).not.toHaveProperty('totalScore');
  });
});
