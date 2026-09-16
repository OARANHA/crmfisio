import { supabase } from "./supabaseClient";

const db = supabase as any;

export const CLINICIAN_ASSISTED_INSTRUMENT_KEYS = [
  "phq9",
  "gad7",
  "phq15",
  "cage",
  "pcl5",
  "pcptsd5",
] as const;
export type ClinicianAssistedInstrumentKey =
  (typeof CLINICIAN_ASSISTED_INSTRUMENT_KEYS)[number];

export type ClinicianAssistedSafetySignal = {
  flagCode: string;
  severity: "warning" | "critical";
  title: string;
  message: string;
  requiredAction?: string;
};

export type ClinicianAssistedAdministration = {
  id: string;
  appointmentId: string;
  patientId: string;
  instrumentKey: ClinicianAssistedInstrumentKey;
  provenance: "clinician_assisted";
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

export type ClinicalInstrumentHistoryItem = {
  id: string;
  appointmentId: string;
  professionalId: string;
  instrumentKey: string;
  engineRuleVersion: string;
  provenance: "clinician_assisted" | "patient_self";
  totalScore: number;
  maxScore: number;
  classification: string;
  severity: string;
  interpretation: string;
  hasSafetySignal: boolean;
  hasCriticalSafetySignal: boolean;
  completedAt: string;
};

export type ClinicianAssistedInstrumentAvailability = Record<
  ClinicianAssistedInstrumentKey,
  boolean
>;

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
  const entries = await Promise.all(
    CLINICIAN_ASSISTED_INSTRUMENT_KEYS.map(async (instrumentKey) => {
      const { data, error } = await db.rpc(
        "can_apply_clinical_instrument_in_encounter",
        {
          p_appointment_id: appointmentId,
          p_instrument_key: instrumentKey,
        },
      );
      if (error) throw error;
      return [instrumentKey, data === true] as const;
    }),
  );

  return Object.fromEntries(entries) as ClinicianAssistedInstrumentAvailability;
}

export async function submitClinicianAssistedInstrument(
  payload: ClinicianAssistedRequestPayload,
): Promise<ClinicianAssistedAdministration> {
  const { data, error } = await supabase.functions.invoke(
    "clinical-instrument-clinician-assisted",
    {
      body: payload,
    },
  );
  if (error) throw error;

  const administration = (
    data as { administration?: ClinicianAssistedAdministration } | null
  )?.administration;
  if (!administration)
    throw new Error("Administração clínica não retornada pelo servidor");
  return administration;
}

export async function loadClinicalInstrumentHistory(
  patientId: string,
): Promise<ClinicalInstrumentHistoryItem[]> {
  const { data, error } = await db.rpc(
    "list_patient_clinical_instrument_history",
    {
      p_patient_id: patientId,
    },
  );
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    appointmentId: String(row.appointment_id),
    professionalId: String(row.professional_id),
    instrumentKey: String(row.instrument_key),
    engineRuleVersion: String(row.engine_rule_version),
    provenance:
      row.provenance === "patient_self"
        ? ("patient_self" as const)
        : ("clinician_assisted" as const),
    totalScore: Number(row.total_score),
    maxScore: Number(row.max_score),
    classification: String(row.classification),
    severity: String(row.severity),
    interpretation: String(row.interpretation),
    hasSafetySignal: row.has_safety_signal === true,
    hasCriticalSafetySignal: row.has_critical_safety_signal === true,
    completedAt: String(row.completed_at),
  }));
}
