import { describe, expect, it } from 'vitest';
import {
  isPhysicianProfessionalType,
  isPsychiatristIdentity,
  isPsychiatrySpecialty,
  professionalIdentityLabel,
} from './professionalIdentity';

describe('professional identity', () => {
  it('normalizes physician labels in Portuguese and English', () => {
    expect(isPhysicianProfessionalType('Médico')).toBe(true);
    expect(isPhysicianProfessionalType('medica')).toBe(true);
    expect(isPhysicianProfessionalType('physician')).toBe(true);
    expect(isPhysicianProfessionalType('fisioterapeuta')).toBe(false);
  });

  it('recognizes psychiatry specialty variants', () => {
    expect(isPsychiatrySpecialty('Psiquiatria')).toBe(true);
    expect(isPsychiatrySpecialty('Médico Psiquiatra')).toBe(true);
    expect(isPsychiatrySpecialty('psychiatry')).toBe(true);
    expect(isPsychiatrySpecialty('cardiologia')).toBe(false);
  });

  it('requires profession and specialty together', () => {
    expect(isPsychiatristIdentity({ professionalType: 'medico', specialty: 'psiquiatria', councilType: 'CRM' })).toBe(true);
    expect(isPsychiatristIdentity({ professionalType: 'fisioterapeuta', specialty: 'psiquiatria', councilType: 'CREFITO' })).toBe(false);
    expect(isPsychiatristIdentity({ professionalType: 'medico', specialty: null, councilType: 'CRM' })).toBe(false);
  });

  it('produces a safe display label without granting authorization', () => {
    expect(professionalIdentityLabel({ professionalType: 'medico', specialty: 'psiquiatria', councilType: 'CRM' })).toBe('Médico Psiquiatra');
    expect(professionalIdentityLabel({ professionalType: 'fisioterapeuta', specialty: null, councilType: 'CREFITO' })).toBe('Fisioterapeuta');
  });
});
