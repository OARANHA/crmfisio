import { supabase } from './supabaseClient';

export interface AutomationSettings {
  clinicId: string;
  confirmationsEnabled: boolean;
  confirmationHours: number;
  npsEnabled: boolean;
  npsDelayMinutes: number;
  npsLookbackDays: number;
  waitlistAutoEnabled: boolean;
  waitlistOfferLimit: number;
  waitlistExpiryMinutes: number;
  reactivationEnabled: boolean;
  reactivationInactiveDays: number;
  reactivationCooldownDays: number;
  reactivationLimitPerRun: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  timezone: string;
  active: boolean;
  updatedAt: string;
}

const mapSettings = (row: Record<string, unknown>): AutomationSettings => ({
  clinicId: String(row.clinic_id),
  confirmationsEnabled: Boolean(row.confirmations_enabled),
  confirmationHours: Number(row.confirmation_hours ?? 48),
  npsEnabled: Boolean(row.nps_enabled),
  npsDelayMinutes: Number(row.nps_delay_minutes ?? 15),
  npsLookbackDays: Number(row.nps_lookback_days ?? 7),
  waitlistAutoEnabled: Boolean(row.waitlist_auto_enabled ?? true),
  waitlistOfferLimit: Number(row.waitlist_offer_limit ?? 3),
  waitlistExpiryMinutes: Number(row.waitlist_expiry_minutes ?? 30),
  reactivationEnabled: Boolean(row.reactivation_enabled ?? false),
  reactivationInactiveDays: Number(row.reactivation_inactive_days ?? 30),
  reactivationCooldownDays: Number(row.reactivation_cooldown_days ?? 30),
  reactivationLimitPerRun: Number(row.reactivation_limit_per_run ?? 10),
  sendWindowStart: String(row.send_window_start ?? '08:00'),
  sendWindowEnd: String(row.send_window_end ?? '20:00'),
  timezone: String(row.timezone ?? 'America/Sao_Paulo'),
  active: Boolean(row.active),
  updatedAt: String(row.updated_at ?? ''),
});

export async function loadAutomationSettings() {
  const { data, error } = await supabase.from('automation_settings' as never).select('*').maybeSingle();
  if (error) throw error;
  return data ? mapSettings(data as unknown as Record<string, unknown>) : null;
}

export async function saveAutomationSettings(settings: AutomationSettings) {
  const payload = {
    confirmations_enabled: settings.confirmationsEnabled,
    confirmation_hours: settings.confirmationHours,
    nps_enabled: settings.npsEnabled,
    nps_delay_minutes: settings.npsDelayMinutes,
    nps_lookback_days: settings.npsLookbackDays,
    waitlist_auto_enabled: settings.waitlistAutoEnabled,
    waitlist_offer_limit: settings.waitlistOfferLimit,
    waitlist_expiry_minutes: settings.waitlistExpiryMinutes,
    reactivation_enabled: settings.reactivationEnabled,
    reactivation_inactive_days: settings.reactivationInactiveDays,
    reactivation_cooldown_days: settings.reactivationCooldownDays,
    reactivation_limit_per_run: settings.reactivationLimitPerRun,
    send_window_start: settings.sendWindowStart,
    send_window_end: settings.sendWindowEnd,
    timezone: settings.timezone,
    active: settings.active,
  };
  const { data, error } = await supabase
    .from('automation_settings' as never)
    .update(payload as never)
    .eq('clinic_id', settings.clinicId)
    .select('clinic_id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('A configuração não pôde ser alterada com o acesso atual.');
}
