import { supabase } from './supabaseClient';
import type { Room, Unidade } from './types';

type UnitRow = {
  id: string;
  clinic_id: string;
  nome: string;
  endereco: string | null;
  ativo: boolean;
};

type RoomRow = {
  id: string;
  clinic_id: string;
  unit_id: string;
  nome: string;
  tipo: 'sala' | 'equipamento';
  ativo: boolean;
};

const mapUnit = (row: UnitRow): Unidade => ({
  id: row.id,
  nome: row.nome,
  endereco: row.endereco ?? '',
});

const mapRoom = (row: RoomRow): Room => ({
  id: row.id,
  nome: row.nome,
  tipo: row.tipo,
  unidadeId: row.unit_id,
});

export async function loadInfrastructure(clinicId: string): Promise<{ unidades: Unidade[]; rooms: Room[] }> {
  const [unitsResult, roomsResult] = await Promise.all([
    supabase.from('units').select('id,clinic_id,nome,endereco,ativo').eq('clinic_id', clinicId).eq('ativo', true).order('nome'),
    supabase.from('rooms').select('id,clinic_id,unit_id,nome,tipo,ativo').eq('clinic_id', clinicId).eq('ativo', true).order('nome'),
  ]);

  if (unitsResult.error) throw unitsResult.error;
  if (roomsResult.error) throw roomsResult.error;

  return {
    unidades: ((unitsResult.data ?? []) as UnitRow[]).map(mapUnit),
    rooms: ((roomsResult.data ?? []) as RoomRow[]).map(mapRoom),
  };
}

export async function insertUnit(clinicId: string, input: { nome: string; endereco: string }): Promise<Unidade> {
  const { data, error } = await supabase
    .from('units')
    .insert({ clinic_id: clinicId, nome: input.nome.trim(), endereco: input.endereco.trim() || null })
    .select('id,clinic_id,nome,endereco,ativo')
    .single();

  if (error || !data) throw error ?? new Error('Falha ao cadastrar unidade');
  return mapUnit(data as UnitRow);
}

export async function insertRoom(clinicId: string, input: { unidadeId: string; nome: string; tipo: Room['tipo'] }): Promise<Room> {
  const { data, error } = await supabase
    .from('rooms')
    .insert({ clinic_id: clinicId, unit_id: input.unidadeId, nome: input.nome.trim(), tipo: input.tipo })
    .select('id,clinic_id,unit_id,nome,tipo,ativo')
    .single();

  if (error || !data) throw error ?? new Error('Falha ao cadastrar sala/recurso');
  return mapRoom(data as RoomRow);
}
