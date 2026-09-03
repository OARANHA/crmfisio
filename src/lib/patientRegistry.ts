import { supabase } from './supabaseClient';
import { resolveClinicId } from './repository';
import type { PatientGuardian, PatientGuardianInput } from './types';

export interface PatientRegistryInput {
  name: string;
  preferredName?: string;
  birthDate: string;
  phone?: string;
  email?: string;
  cpf?: string;
  addressLine?: string;
  insurance?: string;
  insuranceNumber?: string;
  chiefComplaint?: string;
  cid10?: string[];
  administrativeNotes?: string;
  whatsappOptIn: boolean;
  guardians: PatientGuardianInput[];
}

const guardianPayload = (guardian: PatientGuardianInput) => ({
  name: guardian.name.trim(),
  relationship: guardian.relationship.trim(),
  cpf: guardian.cpf?.trim() ?? '',
  phone: guardian.phone?.trim() ?? '',
  email: guardian.email?.trim() ?? '',
  is_legal_guardian: guardian.isLegalGuardian ?? false,
  is_financial_responsible: guardian.isFinancialResponsible ?? false,
  is_primary_contact: guardian.isPrimaryContact ?? false,
});

export const isMinorBirthDate = (birthDate: string, referenceDate = new Date()): boolean => {
  if (!birthDate) return false;
  const birth = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(birth.getTime())) return false;
  const adultDate = new Date(birth.getFullYear() + 18, birth.getMonth(), birth.getDate(), 12, 0, 0, 0);
  const referenceDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate(), 12, 0, 0, 0);
  return referenceDay < adultDate;
};

export async function createPatientRegistry(input: PatientRegistryInput): Promise<string> {
  const { data, error } = await supabase.rpc('create_patient_registry_v2', {
    p_patient: {
      name: input.name.trim(),
      preferred_name: input.preferredName?.trim() ?? '',
      birth_date: input.birthDate,
      phone: input.phone?.trim() ?? '',
      email: input.email?.trim() ?? '',
      cpf: input.cpf?.trim() ?? '',
      address_line: input.addressLine?.trim() ?? '',
      insurance: input.insurance?.trim() ?? '',
      insurance_number: input.insuranceNumber?.trim() ?? '',
      chief_complaint: input.chiefComplaint?.trim() ?? '',
      cid10: input.cid10 ?? [],
      administrative_notes: input.administrativeNotes?.trim() ?? '',
      whatsapp_opt_in: input.whatsappOptIn,
    },
    p_guardians: input.guardians.map(guardianPayload),
  });

  if (error || !data) throw error ?? new Error('Cadastro concluído sem identificador do paciente');
  return String(data);
}

export async function uploadPatientAvatar(userId: string, patientId: string, file: File): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Formato de imagem não suportado. Use JPG, PNG ou WEBP.');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('A foto deve ter no máximo 5 MB.');

  const clinicId = await resolveClinicId(userId);
  const path = `${clinicId}/${patientId}/avatar`;
  const { error: uploadError } = await supabase.storage
    .from('patient-avatars')
    .upload(path, file, { upsert: true, contentType: file.type, cacheControl: '3600' });
  if (uploadError) throw uploadError;

  const { error: pathError } = await supabase.rpc('set_patient_avatar_path', {
    p_patient_id: patientId,
    p_avatar_path: path,
  });
  if (pathError) throw pathError;
  return path;
}

export async function getPatientAvatarUrl(patientId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('patients')
    .select('avatar_path')
    .eq('id', patientId)
    .maybeSingle();
  if (error) throw error;
  if (!data?.avatar_path) return null;

  const { data: signed, error: signedError } = await supabase.storage
    .from('patient-avatars')
    .createSignedUrl(data.avatar_path, 30 * 60);
  if (signedError) throw signedError;
  return signed?.signedUrl ?? null;
}

export async function listPatientGuardians(patientId: string): Promise<PatientGuardian[]> {
  const { data, error } = await supabase
    .from('patient_guardians')
    .select('*')
    .eq('patient_id', patientId)
    .order('is_primary_contact', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    clinicId: row.clinic_id,
    patientId: row.patient_id,
    name: row.name,
    relationship: row.relationship,
    cpf: row.cpf ?? '',
    phone: row.phone ?? '',
    email: row.email ?? '',
    isLegalGuardian: row.is_legal_guardian,
    isFinancialResponsible: row.is_financial_responsible,
    isPrimaryContact: row.is_primary_contact,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function loadPatientRegistryExtras(patientId: string) {
  const [{ data: patient, error }, guardians, avatarUrl] = await Promise.all([
    supabase
      .from('patients')
      .select('preferred_name,address_line,insurance_number,administrative_notes,avatar_path')
      .eq('id', patientId)
      .single(),
    listPatientGuardians(patientId),
    getPatientAvatarUrl(patientId),
  ]);
  if (error) throw error;
  return {
    preferredName: patient.preferred_name ?? '',
    addressLine: patient.address_line ?? '',
    insuranceNumber: patient.insurance_number ?? '',
    administrativeNotes: patient.administrative_notes ?? '',
    avatarPath: patient.avatar_path ?? null,
    avatarUrl,
    guardians,
  };
}
