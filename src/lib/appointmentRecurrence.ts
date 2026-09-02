import { supabase } from './supabaseClient';

export interface RecurrencePreviewSlot {
  data: string;
  inicio: string;
  fim: string;
  available: boolean;
  conflictKind: 'professional' | 'room' | 'patient' | null;
  conflictDetail: string | null;
}

export interface RecurrenceInput {
  pacienteId: string;
  fisioId: string;
  roomId: string;
  tipo: string;
  diasSemana: number[];
  hora: string;
  duracaoMin: number;
  dataInicio: string;
  dataFim: string;
  valor: number;
}

export interface AppointmentSeriesSummary {
  id: string;
  pacienteId: string;
  fisioId: string;
  roomId: string;
  tipo: string;
  diasSemana: number[];
  hora: string;
  duracaoMin: number;
  dataInicio: string;
  dataFim: string;
  valor: number;
  status: 'ativa' | 'cancelada' | 'concluida';
}

const params = (input: RecurrenceInput) => ({
  p_paciente_id: input.pacienteId,
  p_fisio_id: input.fisioId,
  p_room_id: input.roomId,
  p_dias_semana: input.diasSemana,
  p_hora: input.hora,
  p_duracao_min: input.duracaoMin,
  p_data_inicio: input.dataInicio,
  p_data_fim: input.dataFim,
});

export async function previewAppointmentSeries(input: RecurrenceInput): Promise<RecurrencePreviewSlot[]> {
  const { data, error } = await (supabase.rpc as Function)('preview_appointment_series', params(input));
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    data: String(row.data),
    inicio: String(row.inicio).slice(0, 5),
    fim: String(row.fim).slice(0, 5),
    available: Boolean(row.available),
    conflictKind: (row.conflict_kind as RecurrencePreviewSlot['conflictKind']) ?? null,
    conflictDetail: row.conflict_detail ? String(row.conflict_detail) : null,
  }));
}

export async function createAppointmentSeries(input: RecurrenceInput, skipConflicts = true): Promise<{ seriesId: string; created: number; skipped: number }> {
  const { data, error } = await (supabase.rpc as Function)('create_appointment_series', {
    ...params(input),
    p_tipo: input.tipo,
    p_valor: input.valor,
    p_skip_conflicts: skipConflicts,
  });
  if (error) throw error;
  const result = data as Record<string, unknown>;
  return {
    seriesId: String(result.series_id),
    created: Number(result.created ?? 0),
    skipped: Number(result.skipped ?? 0),
  };
}

export async function listAppointmentSeries(): Promise<AppointmentSeriesSummary[]> {
  const { data, error } = await (supabase.from as Function)('appointment_series')
    .select('id,paciente_id,fisio_id,room_id,tipo,dias_semana,hora,duracao_min,data_inicio,data_fim,valor,status')
    .order('data_inicio', { ascending: false })
    .limit(50);
  if (error) throw error;
  return ((data ?? []) as Record<string, unknown>[]).map((row) => ({
    id: String(row.id),
    pacienteId: String(row.paciente_id),
    fisioId: String(row.fisio_id),
    roomId: row.room_id ? String(row.room_id) : '',
    tipo: String(row.tipo),
    diasSemana: (row.dias_semana as number[]) ?? [],
    hora: String(row.hora).slice(0, 5),
    duracaoMin: Number(row.duracao_min),
    dataInicio: String(row.data_inicio),
    dataFim: String(row.data_fim),
    valor: Number(row.valor),
    status: row.status as AppointmentSeriesSummary['status'],
  }));
}

export async function cancelAppointmentSeries(seriesId: string, reason: string): Promise<number> {
  const { data, error } = await (supabase.rpc as Function)('cancel_appointment_series', {
    p_series_id: seriesId,
    p_reason: reason,
  });
  if (error) throw error;
  return Number((data as Record<string, unknown>)?.cancelled_appointments ?? 0);
}
