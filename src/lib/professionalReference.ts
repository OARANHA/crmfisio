import type { Appointment, Commission, Evolution, RecurrenceRule } from './types';

type ProfessionalRef = Pick<Appointment, 'professionalId' | 'fisioId'>
  | Pick<RecurrenceRule, 'professionalId' | 'fisioId'>
  | Pick<Commission, 'professionalId' | 'fisioId'>
  | Pick<Evolution, 'professionalId' | 'fisioId'>;

/**
 * Canonical frontend reader during the staged fisioId -> professionalId cutover.
 * New code should use this helper until the compatibility alias is fully removed.
 */
export function professionalIdOf(value: ProfessionalRef): string {
  return value.professionalId ?? value.fisioId;
}
