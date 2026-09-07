export type ProfessionalIdentity = {
  professionalType: string | null;
  specialty: string | null;
  councilType: string | null;
};

export type ProfessionalType = 'fisioterapeuta' | 'medico' | 'psicologo' | 'quiropraxista';
export type ClinicalCapabilityKey =
  | 'clinical.attend'
  | 'clinical.timeline.read'
  | 'clinical.evolution.write'
  | 'clinical.assessment.apply'
  | 'clinical.body_map'
  | 'clinical.documents';

const normalize = (value: string | null | undefined) =>
  (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const CLINICAL_CAPABILITIES: ReadonlyArray<{
  key: ClinicalCapabilityKey;
  label: string;
  description: string;
}> = [
  { key: 'clinical.attend', label: 'Realizar atendimentos', description: 'Iniciar e concluir atendimentos atribuídos ao próprio profissional.' },
  { key: 'clinical.timeline.read', label: 'Consultar prontuário', description: 'Consultar a linha do tempo clínica conforme o vínculo assistencial.' },
  { key: 'clinical.evolution.write', label: 'Registrar evoluções', description: 'Criar evolução clínica vinculada ao próprio atendimento.' },
  { key: 'clinical.assessment.apply', label: 'Aplicar avaliações', description: 'Preencher e finalizar avaliações clínicas estruturadas.' },
  { key: 'clinical.body_map', label: 'Usar mapa corporal', description: 'Registrar achados corporais quando fizer sentido para a profissão.' },
  { key: 'clinical.documents', label: 'Operar documentos clínicos', description: 'Trabalhar com documentos clínicos autorizados.' },
];

export const DEFAULT_CLINICAL_CAPABILITIES: Record<ProfessionalType, ClinicalCapabilityKey[]> = {
  fisioterapeuta: CLINICAL_CAPABILITIES.map((item) => item.key),
  medico: CLINICAL_CAPABILITIES.filter((item) => item.key !== 'clinical.body_map').map((item) => item.key),
  psicologo: CLINICAL_CAPABILITIES.filter((item) => item.key !== 'clinical.body_map').map((item) => item.key),
  quiropraxista: CLINICAL_CAPABILITIES.map((item) => item.key),
};

export const PROFESSIONAL_META: Record<ProfessionalType, {
  label: string;
  councilLabel: string;
  councilType: string;
  councilRequired: boolean;
  specialtyPlaceholder: string;
}> = {
  fisioterapeuta: { label: 'Fisioterapeuta', councilLabel: 'CREFITO', councilType: 'CREFITO', councilRequired: true, specialtyPlaceholder: 'Ex.: Traumato-ortopedia' },
  medico: { label: 'Médico', councilLabel: 'CRM', councilType: 'CRM', councilRequired: true, specialtyPlaceholder: 'Ex.: Psiquiatria' },
  psicologo: { label: 'Psicólogo', councilLabel: 'CRP', councilType: 'CRP', councilRequired: true, specialtyPlaceholder: 'Ex.: Psicologia clínica' },
  quiropraxista: { label: 'Quiropraxista', councilLabel: 'Registro profissional', councilType: '', councilRequired: false, specialtyPlaceholder: 'Ex.: Esportiva' },
};

export const isProfessionalType = (value: unknown): value is ProfessionalType =>
  typeof value === 'string' && value in PROFESSIONAL_META;

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
  const normalized = normalize(identity.professionalType);
  if (normalized.includes('fisioter')) return 'Fisioterapeuta';
  if (normalized.includes('psicolog')) return 'Psicólogo';
  if (normalized.includes('quiroprax') || normalized.includes('chiropract')) return 'Quiropraxista';
  return identity.professionalType?.trim() || 'Profissional de saúde';
}
