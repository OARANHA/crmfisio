import { supabase } from './supabaseClient';

const db = supabase as any;

export const CLINICIAN_ASSISTED_INSTRUMENT_KEYS = ['phq9', 'gad7'] as const;
export type ClinicianAssistedInstrumentKey = typeof CLINICIAN_ASSISTED_INSTRUMENT_KEYS[number];

export type ClinicianAssistedSafetySignal = {
  flagCode: string;
  severity: 'warning' | 'critical';
  title: string;
  message: string;
  requiredAction?: string;
};

export type ClinicianAssistedAdministration = {
  id: string;
  appointmentId: string;
  patientId: string;
  instrumentKey: ClinicianAssistedInstrumentKey;
  provenance: 'clinician_assisted';
  engineRuleKey: string;
  engineRuleVersion: string;
  totalScore: number;
  maxScore: number;
  classification: string;
  severity: string;
  interpretation: string;
  outputSnapshot: {
    recommendations?: string[];
    answersArray?: number[];
    clinicianAssisted?: boolean;
    guidanceMode?: string;
  };
  safetySignals: ClinicianAssistedSafetySignal[];
  completedAt: string;
  replayed: boolean;
};

export type ClinicianAssistedInstrumentAvailability = Record<ClinicianAssistedInstrumentKey, boolean>;

export type ClinicianAssistedRequestPayload = {
  appointmentId: string;
  instrumentKey: ClinicianAssistedInstrumentKey;
  requestId: string;
  answers: Record<string, number>;
};

export function buildClinicianAssistedRequestPayload(
  appointmentId: string,
  instrumentKey: ClinicianAssistedInstrumentKey,
  requestId: string,
  answers: Record<string, number>,
): ClinicianAssistedRequestPayload {
  return { appointmentId, instrumentKey, requestId, answers };
}

export async function loadClinicianAssistedInstrumentAvailability(
  appointmentId: string,
): Promise<ClinicianAssistedInstrumentAvailability> {
  const entries = await Promise.all(CLINICIAN_ASSISTED_INSTRUMENT_KEYS.map(async (instrumentKey) => {
    const { data, error } = await db.rpc('can_apply_clinical_instrument_in_encounter', {
      p_appointment_id: appointmentId,
      p_instrument_key: instrumentKey,
    });
    if (error) throw error;
    return [instrumentKey, data === true] as const;
  }));

  return Object.fromEntries(entries) as ClinicianAssistedInstrumentAvailability;
}

export async function submitClinicianAssistedInstrument(
  payload: ClinicianAssistedRequestPayload,
): Promise<ClinicianAssistedAdministration> {
  const { data, error } = await supabase.functions.invoke('clinical-instrument-clinician-assisted', {
    body: payload,
  });
  if (error) throw error;

  const administration = (data as { administration?: ClinicianAssistedAdministration } | null)?.administration;
  if (!administration) throw new Error('Administração clínica não retornada pelo servidor');
  return administration;
}
