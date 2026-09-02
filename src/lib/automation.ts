import { supabase } from './supabaseClient';

export interface AutomationSettings {
  clinicId: string;
  confirmationsEnabled: boolean;
  confirmationHours: number;
  npsEnabled: boolean;
  npsDelayMinutes: number;
  npsLookbackDays: number;
  sendWindowStart: string;
  sendWindowEnd: string;
  timezone: string;
  active: boolean;
  updatedAt: string;
}

export interface AutomationRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  queuedConfirmations: number;
  queuedNps: number;
  expiredWaitlistOffers: number;
  workerProcessed: number;
  workerSent: number;
  workerFailed: number;
  clinicsProcessed: number;
  status: 'queued' | 'completed' | 'failed';
  errorMessage: string | null;
}

const mapSettings = (row: Record<string, unknown>): AutomationSettings => ({
  clinicId: String(row.clinic_id),
  confirmationsEnabled: Boolean(row.confirmations_enabled),
  confirmationHours: Number(row.confirmation_hours ?? 48),
  npsEnabled: Boolean(row.nps_enabled),
  npsDelayMinutes: Number(row.nps_delay_minutes ?? 15),
  npsLookbackDays: Number(row.nps_lookback_days ?? 7),
  sendWindowStart: String(row.send_window_start ?? '08:00'),
  sendWindowEnd: String(row.send_window_end ?? '20:00'),
  timezone: String(row.timezone ?? 'America/Sao_Paulo'),
  active: Boolean(row.active),
  updatedAt: String(row.updated_at ?? ''),
});

const mapRun = (row: Record<string, unknown>): AutomationRun => ({
  id: String(row.id),
  startedAt: String(row.started_at),
  finishedAt: row.finished_at ? String(row.finished_at) : null,
  queuedConfirmations: Number(row.queued_confirmations ?? 0),
  queuedNps: Number(row.queued_nps ?? 0),
  expiredWaitlistOffers: Number(row.expired_waitlist_offers ?? 0),
  workerProcessed: Number(row.worker_processed ?? 0),
  workerSent: Number(row.worker_sent ?? 0),
  workerFailed: Number(row.worker_failed ?? 0),
  clinicsProcessed: Number(row.clinics_processed ?? 0),
  status: row.status as AutomationRun['status'],
  errorMessage: row.error_message ? String(row.error_message) : null,
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
    send_window_start: settings.sendWindowStart,
    send_window_end: settings.sendWindowEnd,
    timezone: settings.timezone,
    active: settings.active,
  };
  const { error } = await supabase.from('automation_settings' as never).update(payload as never).eq('clinic_id', settings.clinicId);
  if (error) throw error;
}

export async function loadAutomationRuns(limit = 8) {
  const { data, error } = await supabase.from('automation_runs' as never).select('*').order('started_at', { ascending: false }).limit(limit);
  if (error) throw error;
  return ((data ?? []) as unknown as Record<string, unknown>[]).map(mapRun);
}
