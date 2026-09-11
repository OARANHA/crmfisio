import { supabase } from './supabaseClient';

export type ClinicIdentity = {
  id: string;
  name: string;
  cnpj: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string;
};

export type ClinicOpeningHour = {
  clinic_id: string;
  day_of_week: number;
  is_open: boolean;
  opens_at: string | null;
  closes_at: string | null;
};

export type ClinicOpeningHourDraft = Omit<ClinicOpeningHour, 'clinic_id'>;

export const CLINIC_WEEKDAYS = [
  { day: 0, label: 'Segunda' },
  { day: 1, label: 'Terça' },
  { day: 2, label: 'Quarta' },
  { day: 3, label: 'Quinta' },
  { day: 4, label: 'Sexta' },
  { day: 5, label: 'Sábado' },
  { day: 6, label: 'Domingo' },
] as const;

const DEFAULT_OPENING = { opens_at: '08:00', closes_at: '18:00' } as const;

export function listIanaTimeZones(): string[] {
  const supportedValuesOf = (Intl as typeof Intl & { supportedValuesOf?: (key: 'timeZone') => string[] }).supportedValuesOf;
  const zones = supportedValuesOf ? supportedValuesOf('timeZone') : [];
  return Array.from(new Set(['UTC', ...zones])).sort((a, b) => a.localeCompare(b));
}

export function normalizeOpeningHours(rows: ClinicOpeningHour[] | null | undefined): ClinicOpeningHourDraft[] {
  const byDay = new Map((rows ?? []).map((row) => [row.day_of_week, row]));
  return CLINIC_WEEKDAYS.map(({ day }) => {
    const row = byDay.get(day);
    return {
      day_of_week: day,
      is_open: row?.is_open ?? false,
      opens_at: row?.opens_at?.slice(0, 5) ?? null,
      closes_at: row?.closes_at?.slice(0, 5) ?? null,
    };
  });
}

export function openingHourForToggle(row: ClinicOpeningHourDraft, isOpen: boolean): ClinicOpeningHourDraft {
  return isOpen
    ? {
        ...row,
        is_open: true,
        opens_at: row.opens_at || DEFAULT_OPENING.opens_at,
        closes_at: row.closes_at || DEFAULT_OPENING.closes_at,
      }
    : { ...row, is_open: false, opens_at: null, closes_at: null };
}

export function validateOpeningHours(rows: ClinicOpeningHourDraft[]): string | null {
  if (rows.length !== 7 || new Set(rows.map((row) => row.day_of_week)).size !== 7) {
    return 'Informe os sete dias da semana.';
  }
  for (const row of rows) {
    if (row.day_of_week < 0 || row.day_of_week > 6) return 'Dia da semana inválido.';
    if (row.is_open && (!row.opens_at || !row.closes_at || row.opens_at >= row.closes_at)) {
      return `${CLINIC_WEEKDAYS.find((item) => item.day === row.day_of_week)?.label ?? 'Dia'} precisa ter um intervalo válido.`;
    }
  }
  return null;
}

export async function getCurrentClinicIdentity(): Promise<ClinicIdentity> {
  const { data, error } = await supabase.rpc('get_current_clinic_identity');
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Clínica ativa não encontrada.');
  return row as ClinicIdentity;
}

export async function updateCurrentClinicIdentity(input: Omit<ClinicIdentity, 'id'>): Promise<ClinicIdentity> {
  const { data, error } = await supabase.rpc('update_current_clinic_identity', {
    p_name: input.name.trim(),
    p_cnpj: input.cnpj?.trim() || null,
    p_phone: input.phone?.trim() || null,
    p_email: input.email?.trim() || null,
    p_address: input.address?.trim() || null,
    p_timezone: input.timezone,
  });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) throw new Error('Não foi possível atualizar a clínica.');
  return row as ClinicIdentity;
}

export async function loadClinicOpeningHours(clinicId: string): Promise<ClinicOpeningHourDraft[]> {
  const { data, error } = await supabase
    .from('clinic_opening_hours')
    .select('clinic_id,day_of_week,is_open,opens_at,closes_at')
    .eq('clinic_id', clinicId)
    .order('day_of_week');
  if (error) throw error;
  return normalizeOpeningHours((data ?? []) as ClinicOpeningHour[]);
}

export async function saveClinicOpeningHours(clinicId: string, rows: ClinicOpeningHourDraft[]): Promise<void> {
  const validation = validateOpeningHours(rows);
  if (validation) throw new Error(validation);

  const payload = rows.map((row) => ({
    clinic_id: clinicId,
    day_of_week: row.day_of_week,
    is_open: row.is_open,
    opens_at: row.is_open ? row.opens_at : null,
    closes_at: row.is_open ? row.closes_at : null,
  }));

  const { error } = await supabase.from('clinic_opening_hours').upsert(payload, { onConflict: 'clinic_id,day_of_week' });
  if (error) throw error;
}
