import { supabase } from "./supabaseClient";

const db = supabase as any;

export type ClinicalInstrumentPatientDeliveryOption = {
  instrumentKey: string;
  engineRuleVersion: string;
  displayLabel: string;
  defaultExpiresHours: number;
};

export type ClinicalInstrumentPatientDeliveryStatus = {
  inviteId: string;
  instrumentKey: string;
  engineRuleVersion: string;
  displayLabel: string;
  status: string;
  createdAt: string;
  openedAt: string | null;
  submittedAt: string | null;
  expiresAt: string;
  processed: boolean;
};

export type ClinicalInstrumentPatientDeliveryResponse = {
  inviteId: string;
  waLogId: string;
  instrumentKey: string;
  ruleVersion: string;
  displayLabel: string;
  expiresAt: string;
  status: string;
  replayed: boolean;
};

export type ClinicalInstrumentPatientDeliveryRequest = {
  appointmentId: string;
  instrumentKey: string;
  requestId: string;
  expiresHours: number;
};

export async function loadAvailableClinicalInstrumentPatientDelivery(
  appointmentId: string,
): Promise<ClinicalInstrumentPatientDeliveryOption[]> {
  const { data, error } = await db.rpc(
    "list_available_clinical_instrument_patient_delivery",
    {
      p_appointment_id: appointmentId,
    },
  );
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    instrumentKey: String(row.instrument_key),
    engineRuleVersion: String(row.engine_rule_version),
    displayLabel: String(row.display_label),
    defaultExpiresHours: Number(row.default_expires_hours),
  }));
}

export async function loadClinicalInstrumentPatientDeliveries(
  appointmentId: string,
): Promise<ClinicalInstrumentPatientDeliveryStatus[]> {
  const { data, error } = await db.rpc(
    "list_clinical_instrument_patient_deliveries",
    {
      p_appointment_id: appointmentId,
    },
  );
  if (error) throw error;

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    inviteId: String(row.invite_id),
    instrumentKey: String(row.instrument_key),
    engineRuleVersion: String(row.engine_rule_version),
    displayLabel: String(row.display_label),
    status: String(row.status),
    createdAt: String(row.created_at),
    openedAt: row.opened_at ? String(row.opened_at) : null,
    submittedAt: row.submitted_at ? String(row.submitted_at) : null,
    expiresAt: String(row.expires_at),
    processed: row.processed === true,
  }));
}

export async function sendClinicalInstrumentPatientDelivery(
  payload: ClinicalInstrumentPatientDeliveryRequest,
): Promise<ClinicalInstrumentPatientDeliveryResponse> {
  const { data, error } = await supabase.functions.invoke(
    "clinical-instrument-patient-delivery",
    {
      body: payload,
    },
  );
  if (error) throw error;

  const response = data as {
    delivery?: ClinicalInstrumentPatientDeliveryResponse;
    error?: string;
  } | null;
  if (!response?.delivery) {
    throw new Error(
      response?.error || "O servidor não confirmou o envio do instrumento.",
    );
  }
  return response.delivery;
}
