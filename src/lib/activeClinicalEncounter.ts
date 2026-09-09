import { professionalIdOf } from './professionalReference';
import type { Appointment } from './types';

export function resolveOwnActiveEncounter(
  appointments: readonly Appointment[],
  patientId: string | null | undefined,
  professionalId: string | null | undefined,
): Appointment | null {
  if (!patientId || !professionalId) return null;

  const matches = appointments.filter((appointment) =>
    appointment.pacienteId === patientId
    && appointment.status === 'em_atendimento'
    && professionalIdOf(appointment) === professionalId,
  );

  // PostgreSQL should make this impossible. Fail closed instead of silently
  // choosing an arbitrary encounter if production data ever drifts.
  return matches.length === 1 ? matches[0] : null;
}

export function isPsychiatryContext(
  professionalType: string | null | undefined,
  specialty: string | null | undefined,
): boolean {
  const normalize = (value: string | null | undefined) => (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  const type = normalize(professionalType);
  const area = normalize(specialty);
  return ['medico', 'medica', 'physician', 'doctor'].includes(type)
    && (area.includes('psiquiatr') || area.includes('psychiatr'));
}

export function rankAssessmentTemplatesForContext<T extends { name: string; description?: string | null }>(
  templates: readonly T[],
  context: { professionalType?: string | null; specialty?: string | null },
): { recommended: T[]; other: T[] } {
  if (!isPsychiatryContext(context.professionalType, context.specialty)) {
    return { recommended: [...templates], other: [] };
  }

  const physioTerms = ['fisioter', 'dor', 'funcao', 'função', 'postur', 'muscul', 'articular', 'movimento'];
  const relevantTerms = ['psiquiatr', 'mental', 'humor', 'ansiedade', 'depress', 'sono', 'cogn', 'anamnes'];
  const score = (template: T) => {
    const haystack = `${template.name} ${template.description ?? ''}`.toLowerCase();
    return relevantTerms.reduce((sum, term) => sum + (haystack.includes(term) ? 2 : 0), 0)
      - physioTerms.reduce((sum, term) => sum + (haystack.includes(term) ? 1 : 0), 0);
  };

  const ranked = [...templates].sort((a, b) => score(b) - score(a));
  const recommended = ranked.filter((template) => score(template) > 0);
  const other = ranked.filter((template) => score(template) <= 0);
  return { recommended, other };
}
