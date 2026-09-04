export type ProfessionalIdentity = {
  professionalType: string | null;
  specialty: string | null;
  councilType: string | null;
};

const normalize = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export function isPhysicianProfessionalType(value: string | null | undefined): boolean {
  const normalized = normalize(value);
  return ['medico', 'medica', 'physician', 'doctor'].includes(normalized);
}

export function isPsychiatrySpecialty(value: string | null | undefined): boolean {
  const normalized = normalize(value);
  return normalized.includes('psiquiatr') || normalized.includes('psychiatr');
}

export function isPsychiatristIdentity(identity: ProfessionalIdentity | null | undefined): boolean {
  if (!identity) return false;
  return isPhysicianProfessionalType(identity.professionalType) && isPsychiatrySpecialty(identity.specialty);
}

export function professionalIdentityLabel(identity: ProfessionalIdentity | null | undefined): string {
  if (!identity) return 'Profissional de saúde';
  if (isPsychiatristIdentity(identity)) return 'Médico Psiquiatra';
  if (isPhysicianProfessionalType(identity.professionalType)) return 'Médico';
  if (normalize(identity.professionalType).includes('fisioter')) return 'Fisioterapeuta';
  return identity.professionalType?.trim() || 'Profissional de saúde';
}
