import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store';
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

export function InfrastructureAdmin() {
  const { user, toast, refreshInfrastructure: refreshAppInfrastructure } = useApp();
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

  const refresh = async (cid: string) => {
    const data = await loadInfrastructureAdmin(cid);
    setUnits(data.units);
    setRooms(data.rooms);
    if (!roomUnitId && data.units.find((u) => u.ativo)) setRoomUnitId(data.units.find((u) => u.ativo)!.id);
  };

  useEffect(() => {
    let active = true;
    if (!user?.id) return;
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
  }, [user?.id]);

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
    if (!clinicId || !unitName.trim()) return;
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
    if (!clinicId || !roomUnitId || !roomName.trim()) return;
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
    setEditingUnitId(unit.id);
    setUnitName(unit.nome);
    setUnitAddress(unit.endereco ?? '');
  };

  const editRoom = (room: RoomAdminRow) => {
    setEditingRoomId(room.id);
    setRoomUnitId(room.unit_id);
    setRoomName(room.nome);
    setRoomType(room.tipo);
  };

  const toggleUnit = async (unit: UnitAdminRow) => {
    if (unit.ativo && (roomsByUnit.get(unit.id) ?? []).some((r) => r.ativo)) {
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

  return (
    <Card>
      <CardHead title="Estrutura da clínica" sub="cadastre, edite e desative unidades, salas e equipamentos usados pela agenda" />
      {loading ? (
        <div className="p-5 font-mono text-[11px] text-fog">Carregando estrutura…</div>
      ) : (
        <div className="p-5 space-y-6">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="border border-line bg-deep p-4 space-y-3">
              <div>
                <p className="font-display font-semibold text-[14px]">{editingUnitId ? 'Editar unidade' : 'Cadastrar unidade'}</p>
                <p className="text-[11.5px] text-fog mt-1">Sede, filial ou local de atendimento.</p>
              </div>
              <Field label="Nome da unidade"><Input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="Ex.: Unidade Centro" /></Field>
              <Field label="Endereço"><Input value={unitAddress} onChange={(e) => setUnitAddress(e.target.value)} placeholder="Rua, número, cidade" /></Field>
              <div className="flex flex-wrap gap-2">
                <Btn onClick={saveUnit} disabled={saving || !unitName.trim()}>{editingUnitId ? 'Salvar alterações' : 'Cadastrar unidade'}</Btn>
                {editingUnitId && <Btn variant="ghost" onClick={resetUnit}>Cancelar</Btn>}
              </div>
            </div>

            <div className="border border-line bg-deep p-4 space-y-3">
              <div>
                <p className="font-display font-semibold text-[14px]">{editingRoomId ? 'Editar sala ou equipamento' : 'Cadastrar sala ou equipamento'}</p>
                <p className="text-[11.5px] text-fog mt-1">Recurso físico reservado em cada sessão.</p>
              </div>
              <Field label="Unidade">
                <Select value={roomUnitId} onChange={(e) => setRoomUnitId(e.target.value)}>
                  <option value="">Selecionar…</option>
                  {units.filter((u) => u.ativo || u.id === roomUnitId).map((u) => <option key={u.id} value={u.id}>{u.nome}{u.ativo ? '' : ' (inativa)'}</option>)}
                </Select>
              </Field>
              <Field label="Nome"><Input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Ex.: Sala 1 — Cinesioterapia" /></Field>
              <Field label="Tipo">
                <Select value={roomType} onChange={(e) => setRoomType(e.target.value as Room['tipo'])}>
                  <option value="sala">Sala</option>
                  <option value="equipamento">Equipamento / recurso</option>
                </Select>
              </Field>
              <div className="flex flex-wrap gap-2">
                <Btn onClick={saveRoom} disabled={saving || !roomUnitId || !roomName.trim()}>{editingRoomId ? 'Salvar alterações' : 'Cadastrar recurso'}</Btn>
                {editingRoomId && <Btn variant="ghost" onClick={resetRoom}>Cancelar</Btn>}
              </div>
            </div>
          </div>

          <div>
            <p className="font-display font-semibold text-[14px]">Estrutura cadastrada</p>
            {units.length === 0 ? (
              <div className="mt-3 border border-amber/35 bg-amber/[0.04] p-4 text-[12px] text-amber">Cadastre a primeira unidade e ao menos uma sala para liberar agendamentos.</div>
            ) : (
              <div className="mt-3 grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {units.map((unit) => (
                  <div key={unit.id} className={`border p-4 ${unit.ativo ? 'border-line bg-deep' : 'border-line/50 bg-deep/40 opacity-70'}`}>
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-display font-semibold text-[13.5px]">{unit.nome}</p>
                        <p className="font-mono text-[10px] text-fog mt-1">{unit.endereco || 'Endereço não informado'}</p>
                        <p className={`font-mono text-[9px] mt-1 ${unit.ativo ? 'text-mint' : 'text-fog'}`}>{unit.ativo ? 'ativa' : 'inativa'}</p>
                      </div>
                      <Btn variant="ghost" onClick={() => editUnit(unit)}>Editar</Btn>
                      <Btn variant="ghost" onClick={() => toggleUnit(unit)}>{unit.ativo ? 'Desativar' : 'Reativar'}</Btn>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      {(roomsByUnit.get(unit.id) ?? []).length === 0 ? (
                        <p className="font-mono text-[10px] text-amber">Nenhuma sala/recurso cadastrado</p>
                      ) : (roomsByUnit.get(unit.id) ?? []).map((room) => (
                        <div key={room.id} className={`border px-2.5 py-2 ${room.ativo ? 'border-line/70' : 'border-line/40 opacity-60'}`}>
                          <div className="flex items-center gap-2">
                            <span className="text-[11.5px] min-w-0 flex-1 truncate">{room.nome}</span>
                            <span className="font-mono text-[9px] text-fog uppercase">{room.tipo}</span>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            <Btn variant="ghost" onClick={() => editRoom(room)}>Editar</Btn>
                            <Btn variant="ghost" onClick={() => toggleRoom(room)}>{room.ativo ? 'Desativar' : 'Reativar'}</Btn>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
