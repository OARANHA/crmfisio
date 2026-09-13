import { supabase } from './supabaseClient';

export type ClinicClinicalFlowSettings = {
  referralAuthoringEnabled: boolean;
  updatedAt: string | null;
};

type ClinicClinicalFlowSettingsRow = {
  referral_authoring_enabled: boolean;
  updated_at: string | null;
};

const DEFAULT_SETTINGS: ClinicClinicalFlowSettings = {
  referralAuthoringEnabled: true,
  updatedAt: null,
};

function mapSettings(row: ClinicClinicalFlowSettingsRow | null | undefined): ClinicClinicalFlowSettings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    referralAuthoringEnabled: row.referral_authoring_enabled !== false,
    updatedAt: row.updated_at ?? null,
  };
}

export async function getCurrentClinicClinicalFlowSettings(): Promise<ClinicClinicalFlowSettings> {
  const { data, error } = await supabase.rpc('get_current_clinic_clinical_flow_settings');
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as ClinicClinicalFlowSettingsRow | null | undefined;
  return mapSettings(row);
}

export async function updateCurrentClinicClinicalFlowSettings(
  referralAuthoringEnabled: boolean,
): Promise<ClinicClinicalFlowSettings> {
  const { data, error } = await supabase.rpc('update_current_clinic_clinical_flow_settings', {
    p_referral_authoring_enabled: referralAuthoringEnabled,
  });
  if (error) throw error;
  const row = (Array.isArray(data) ? data[0] : data) as ClinicClinicalFlowSettingsRow | null | undefined;
  if (!row) throw new Error('Política de fluxos clínicos sem confirmação do servidor.');
  return mapSettings(row);
}
