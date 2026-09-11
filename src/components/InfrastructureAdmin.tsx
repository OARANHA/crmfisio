import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { useToast } from '../lib/toastContext';
import { useInfrastructure } from '../lib/infrastructureContext';
import {
  insertRoom,
  insertUnit,
  loadInfrastructureAdmin,
  setRoomActive,
  setUnitActive,
  updateRoom,
  updateUnit,
  type RoomAdminRow,
  type UnitAdminRow,
} from '../lib/infrastructure';
import { resolveClinicId } from '../lib/repository';
import type { Room } from '../lib/types';
import { Btn, Card, CardHead, Field, Input, Select } from '../lib/ui';

export type InfrastructureAdminMode = 'all' | 'units' | 'rooms';

type InfrastructureAdminProps = {
  mode?: InfrastructureAdminMode;
  readOnly?: boolean;
};

export function InfrastructureAdmin({ mode = 'all', readOnly = false }: InfrastructureAdminProps) {
  const { user } = useCurrentUserAccess();
  const { toast } = useToast();
  const { refreshInfrastructure: refreshAppInfrastructure } = useInfrastructure();
  const [clinicId, setClinicId] = useState('');
  const [units, setUnits] = useState<UnitAdminRow[]>([]);
  const [rooms, setRooms] = useState<RoomAdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [unitName, setUnitName] = useState('');
  const [unitAddress, setUnitAddress] = useState('');
  const [roomUnitId, setRoomUnitId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<Room['tipo']>('sala');

  const showUnits = mode === 'all' || mode === 'units';
  const showRooms = mode === 'all' || mode === 'rooms';

  const refresh = useCallback(async (cid: string) => {
    const data = await loadInfrastructureAdmin(cid);
    setUnits(data.units);
    setRooms(data.rooms);
    const firstActiveUnitId = data.units.find((unit) => unit.ativo)?.id ?? '';
    setRoomUnitId((current) => current || firstActiveUnitId);
  }, []);

  useEffect(() => {
    let active = true;
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    resolveClinicId(user.id)
      .then(async (cid) => {
        if (!active) return;
        setClinicId(cid);
        await refresh(cid);
      })
      .catch((error) => {
        console.error('[MedicsPro] infraestrutura:', error);
        toast('Não foi possível carregar unidades e salas.', 'warn');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [user?.id, refresh, toast]);

  const roomsByUnit = useMemo(() => {
    const grouped = new Map<string, RoomAdminRow[]>();
    for (const room of rooms) grouped.set(room.unit_id, [...(grouped.get(room.unit_id) ?? []), room]);
    return grouped;
  }, [rooms]);

  const resetUnit = () => {
    setEditingUnitId(null);
    setUnitName('');
    setUnitAddress('');
  };

  const resetRoom = () => {
    setEditingRoomId(null);
    setRoomName('');
    setRoomType('sala');
  };

  const saveUnit = async () => {
    if (readOnly || !clinicId || !unitName.trim()) return;
    setSaving(true);
    try {
      if (editingUnitId) {
        await updateUnit(clinicId, editingUnitId, { nome: unitName, endereco: unitAddress });
        toast('Unidade atualizada.');
      } else {
        await insertUnit(clinicId, { nome: unitName, endereco: unitAddress });
        toast('Unidade cadastrada.');
      }
      resetUnit();
      await refresh(clinicId);
      await refreshAppInfrastructure();
    } catch (error) {
      console.error('[MedicsPro] salvar unidade:', error);
      toast('Falha ao salvar unidade.', 'warn');
    } finally {
      setSaving(false);
    }
  };

  const saveRoom = async () => {
    if (readOnly || !clinicId || !roomUnitId || !roomName.trim()) return;
    setSaving(true);
    try {
      if (editingRoomId) {
        await updateRoom(clinicId, editingRoomId, { unidadeId: roomUnitId, nome: roomName, tipo: roomType });
        toast('Sala/recurso atualizado.');
      } else {
        await insertRoom(clinicId, { unidadeId: roomUnitId, nome: roomName, tipo: roomType });
        toast(roomType === 'sala' ? 'Sala cadastrada.' : 'Recurso cadastrado.');
      }
      resetRoom();
      await refresh(clinicId);
      await refreshAppInfrastructure();
    } catch (error) {
      console.error('[MedicsPro] salvar sala:', error);
      toast('Falha ao salvar sala/recurso.', 'warn');
    } finally {
      setSaving(false);
    }
  };

  const editUnit = (unit: UnitAdminRow) => {
    if (readOnly) return;
    setEditingUnitId(unit.id);
    setUnitName(unit.nome);
    setUnitAddress(unit.endereco ?? '');
  };

  const editRoom = (room: RoomAdminRow) => {
    if (readOnly) return;
    setEditingRoomId(room.id);
    setRoomUnitId(room.unit_id);
    setRoomName(room.nome);
    setRoomType(room.tipo);
  };

  const toggleUnit = async (unit: UnitAdminRow) => {
    if (readOnly) return;
    if (unit.ativo && (roomsByUnit.get(unit.id) ?? []).some((room) => room.ativo)) {
      toast('Desative primeiro as salas e recursos ativos desta unidade.', 'warn');
      return;
    }
    try {
      await setUnitActive(clinicId, unit.id, !unit.ativo);
      await refresh(clinicId);
      await refreshAppInfrastructure();
      toast(unit.ativo ? 'Unidade desativada.' : 'Unidade reativada.');
    } catch (error) {
      console.error('[MedicsPro] status unidade:', error);
      toast('Não foi possível alterar a unidade.', 'warn');
    }
  };

  const toggleRoom = async (room: RoomAdminRow) => {
    if (readOnly) return;
    try {
      await setRoomActive(clinicId, room.id, !room.ativo);
      await refresh(clinicId);
      await refreshAppInfrastructure();
      toast(room.ativo ? 'Sala/recurso desativado.' : 'Sala/recurso reativado.');
    } catch (error) {
      console.error('[MedicsPro] status sala:', error);
      toast('Não foi possível alterar a sala/recurso.', 'warn');
    }
  };

  const title = mode === 'units' ? 'Unidades da clínica' : mode === 'rooms' ? 'Salas & recursos' : 'Estrutura da clínica';
  const subtitle = mode === 'units'
    ? 'sedes, filiais e locais de atendimento usados pela operação'
    : mode === 'rooms'
      ? 'salas e equipamentos vinculados às unidades da clínica'
      : 'cadastre, edite e desative unidades, salas e equipamentos usados pela agenda';

  return (
    <Card>
      <CardHead title={title} sub={subtitle} />
      {loading ? (
        <div className="p-5 font-mono text-[11px] text-fog">Carregando estrutura…</div>
      ) : (
        <div className="space-y-6 p-5">
          {!readOnly && (
            <div className={`grid gap-4 ${showUnits && showRooms ? 'lg:grid-cols-2' : ''}`}>
              {showUnits && (
                <div className="space-y-3 border border-line bg-deep p-4">
                  <div>
                    <p className="font-display text-[14px] font-semibold">{editingUnitId ? 'Editar unidade' : 'Cadastrar unidade'}</p>
                    <p className="mt-1 text-[11.5px] text-fog">Sede, filial ou local de atendimento.</p>
                  </div>
                  <Field label="Nome da unidade"><Input value={unitName} onChange={(event) => setUnitName(event.target.value)} placeholder="Ex.: Unidade Centro" /></Field>
                  <Field label="Endereço"><Input value={unitAddress} onChange={(event) => setUnitAddress(event.target.value)} placeholder="Rua, número, cidade" /></Field>
                  <div className="flex flex-wrap gap-2">
                    <Btn onClick={saveUnit} disabled={saving || !unitName.trim()}>{editingUnitId ? 'Salvar alterações' : 'Cadastrar unidade'}</Btn>
                    {editingUnitId && <Btn variant="ghost" onClick={resetUnit}>Cancelar</Btn>}
                  </div>
                </div>
              )}

              {showRooms && (
                <div className="space-y-3 border border-line bg-deep p-4">
                  <div>
                    <p className="font-display text-[14px] font-semibold">{editingRoomId ? 'Editar sala ou equipamento' : 'Cadastrar sala ou equipamento'}</p>
                    <p className="mt-1 text-[11.5px] text-fog">Recurso físico reservado em cada sessão.</p>
                  </div>
                  <Field label="Unidade">
                    <Select value={roomUnitId} onChange={(event) => setRoomUnitId(event.target.value)}>
                      <option value="">Selecionar…</option>
                      {units.filter((unit) => unit.ativo || unit.id === roomUnitId).map((unit) => <option key={unit.id} value={unit.id}>{unit.nome}{unit.ativo ? '' : ' (inativa)'}</option>)}
                    </Select>
                  </Field>
                  <Field label="Nome"><Input value={roomName} onChange={(event) => setRoomName(event.target.value)} placeholder="Ex.: Sala 1 — Cinesioterapia" /></Field>
                  <Field label="Tipo">
                    <Select value={roomType} onChange={(event) => setRoomType(event.target.value as Room['tipo'])}>
                      <option value="sala">Sala</option>
                      <option value="equipamento">Equipamento / recurso</option>
                    </Select>
                  </Field>
                  <div className="flex flex-wrap gap-2">
                    <Btn onClick={saveRoom} disabled={saving || !roomUnitId || !roomName.trim()}>{editingRoomId ? 'Salvar alterações' : 'Cadastrar recurso'}</Btn>
                    {editingRoomId && <Btn variant="ghost" onClick={resetRoom}>Cancelar</Btn>}
                  </div>
                </div>
              )}
            </div>
          )}

          {showUnits && (
            <div>
              <p className="font-display text-[14px] font-semibold">Unidades cadastradas</p>
              {units.length === 0 ? (
                <div className="mt-3 border border-amber/35 bg-amber/[0.04] p-4 text-[12px] text-amber">Nenhuma unidade cadastrada.</div>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {units.map((unit) => (
                    <div key={unit.id} className={`border p-4 ${unit.ativo ? 'border-line bg-deep' : 'border-line/50 bg-deep/40 opacity-70'}`}>
                      <p className="font-display text-[13.5px] font-semibold">{unit.nome}</p>
                      <p className="mt-1 font-mono text-[10px] text-fog">{unit.endereco || 'Endereço não informado'}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <span className={`font-mono text-[9px] ${unit.ativo ? 'text-mint' : 'text-fog'}`}>{unit.ativo ? 'ativa' : 'inativa'} · {(roomsByUnit.get(unit.id) ?? []).length} recurso(s)</span>
                        {!readOnly && <div className="flex gap-2"><Btn variant="ghost" onClick={() => editUnit(unit)}>Editar</Btn><Btn variant="ghost" onClick={() => toggleUnit(unit)}>{unit.ativo ? 'Desativar' : 'Reativar'}</Btn></div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {showRooms && (
            <div>
              <p className="font-display text-[14px] font-semibold">Salas e recursos cadastrados</p>
              {units.length === 0 ? (
                <div className="mt-3 border border-amber/35 bg-amber/[0.04] p-4 text-[12px] text-amber">Cadastre uma unidade em Geral antes de incluir salas ou recursos.</div>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {units.map((unit) => (
                    <div key={unit.id} className="border border-line bg-deep p-4">
                      <p className="font-display text-[13.5px] font-semibold">{unit.nome}</p>
                      <div className="mt-3 space-y-1.5">
                        {(roomsByUnit.get(unit.id) ?? []).length === 0 ? (
                          <p className="font-mono text-[10px] text-fog">Nenhuma sala/recurso cadastrado</p>
                        ) : (roomsByUnit.get(unit.id) ?? []).map((room) => (
                          <div key={room.id} className={`border px-2.5 py-2 ${room.ativo ? 'border-line/70' : 'border-line/40 opacity-60'}`}>
                            <div className="flex items-center gap-2">
                              <span className="min-w-0 flex-1 truncate text-[11.5px]">{room.nome}</span>
                              <span className="font-mono text-[9px] uppercase text-fog">{room.tipo}</span>
                            </div>
                            {!readOnly && <div className="mt-2 flex flex-wrap gap-2"><Btn variant="ghost" onClick={() => editRoom(room)}>Editar</Btn><Btn variant="ghost" onClick={() => toggleRoom(room)}>{room.ativo ? 'Desativar' : 'Reativar'}</Btn></div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
