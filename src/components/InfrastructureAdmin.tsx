import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../lib/store';
import { insertRoom, insertUnit, loadInfrastructure } from '../lib/infrastructure';
import { resolveClinicId } from '../lib/repository';
import type { Room, Unidade } from '../lib/types';
import { Btn, Card, CardHead, Field, Input, Select } from '../lib/ui';

export function InfrastructureAdmin() {
  const { user, toast } = useApp();
  const [clinicId, setClinicId] = useState('');
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unitName, setUnitName] = useState('');
  const [unitAddress, setUnitAddress] = useState('');
  const [roomUnitId, setRoomUnitId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [roomType, setRoomType] = useState<Room['tipo']>('sala');

  const refresh = async (cid: string) => {
    const data = await loadInfrastructure(cid);
    setUnidades(data.unidades);
    setRooms(data.rooms);
    if (!roomUnitId && data.unidades[0]) setRoomUnitId(data.unidades[0].id);
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
    const grouped = new Map<string, Room[]>();
    for (const room of rooms) grouped.set(room.unidadeId, [...(grouped.get(room.unidadeId) ?? []), room]);
    return grouped;
  }, [rooms]);

  const saveUnit = async () => {
    if (!clinicId || !unitName.trim()) return;
    setSaving(true);
    try {
      const unit = await insertUnit(clinicId, { nome: unitName, endereco: unitAddress });
      setUnidades((prev) => [...prev, unit].sort((a, b) => a.nome.localeCompare(b.nome)));
      if (!roomUnitId) setRoomUnitId(unit.id);
      setUnitName('');
      setUnitAddress('');
      toast('Unidade cadastrada.');
    } catch (error) {
      console.error('[MedicsPro] cadastrar unidade:', error);
      toast('Falha ao cadastrar unidade.', 'warn');
    } finally {
      setSaving(false);
    }
  };

  const saveRoom = async () => {
    if (!clinicId || !roomUnitId || !roomName.trim()) return;
    setSaving(true);
    try {
      const room = await insertRoom(clinicId, { unidadeId: roomUnitId, nome: roomName, tipo: roomType });
      setRooms((prev) => [...prev, room].sort((a, b) => a.nome.localeCompare(b.nome)));
      setRoomName('');
      toast(roomType === 'sala' ? 'Sala cadastrada.' : 'Recurso cadastrado.');
    } catch (error) {
      console.error('[MedicsPro] cadastrar sala:', error);
      toast('Falha ao cadastrar sala/recurso.', 'warn');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card>
      <CardHead
        title="Estrutura da clínica"
        sub="unidades, salas e equipamentos usados pela agenda real"
      />
      {loading ? (
        <div className="p-5 font-mono text-[11px] text-fog">Carregando estrutura…</div>
      ) : (
        <div className="p-5 space-y-6">
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="border border-line bg-deep p-4 space-y-3">
              <div>
                <p className="font-display font-semibold text-[14px]">Cadastrar unidade</p>
                <p className="text-[11.5px] text-fog mt-1">Sede, filial ou local de atendimento.</p>
              </div>
              <Field label="Nome da unidade"><Input value={unitName} onChange={(e) => setUnitName(e.target.value)} placeholder="Ex.: Unidade Centro" /></Field>
              <Field label="Endereço"><Input value={unitAddress} onChange={(e) => setUnitAddress(e.target.value)} placeholder="Rua, número, cidade" /></Field>
              <Btn onClick={saveUnit} disabled={saving || !unitName.trim()}>Cadastrar unidade</Btn>
            </div>

            <div className="border border-line bg-deep p-4 space-y-3">
              <div>
                <p className="font-display font-semibold text-[14px]">Cadastrar sala ou equipamento</p>
                <p className="text-[11.5px] text-fog mt-1">Recurso físico reservado em cada sessão.</p>
              </div>
              <Field label="Unidade">
                <Select value={roomUnitId} onChange={(e) => setRoomUnitId(e.target.value)}>
                  <option value="">Selecionar…</option>
                  {unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </Select>
              </Field>
              <Field label="Nome"><Input value={roomName} onChange={(e) => setRoomName(e.target.value)} placeholder="Ex.: Sala 1 — Cinesioterapia" /></Field>
              <Field label="Tipo">
                <Select value={roomType} onChange={(e) => setRoomType(e.target.value as Room['tipo'])}>
                  <option value="sala">Sala</option>
                  <option value="equipamento">Equipamento / recurso</option>
                </Select>
              </Field>
              <Btn onClick={saveRoom} disabled={saving || !roomUnitId || !roomName.trim()}>Cadastrar recurso</Btn>
            </div>
          </div>

          <div>
            <p className="font-display font-semibold text-[14px]">Estrutura ativa</p>
            {unidades.length === 0 ? (
              <div className="mt-3 border border-amber/35 bg-amber/[0.04] p-4 text-[12px] text-amber">
                Cadastre a primeira unidade e ao menos uma sala para liberar agendamentos.
              </div>
            ) : (
              <div className="mt-3 grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                {unidades.map((u) => (
                  <div key={u.id} className="border border-line bg-deep p-4">
                    <p className="font-display font-semibold text-[13.5px]">{u.nome}</p>
                    <p className="font-mono text-[10px] text-fog mt-1">{u.endereco || 'Endereço não informado'}</p>
                    <div className="mt-3 space-y-1.5">
                      {(roomsByUnit.get(u.id) ?? []).length === 0 ? (
                        <p className="font-mono text-[10px] text-amber">Nenhuma sala/recurso cadastrado</p>
                      ) : (roomsByUnit.get(u.id) ?? []).map((r) => (
                        <div key={r.id} className="flex items-center justify-between border border-line/70 px-2.5 py-2 text-[11.5px]">
                          <span>{r.nome}</span>
                          <span className="font-mono text-[9.5px] text-fog uppercase">{r.tipo}</span>
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
