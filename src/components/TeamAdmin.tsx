import { useEffect, useMemo, useState } from 'react';
import { resolveClinicId } from '../lib/repository';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../lib/store';
import { Btn, Card, CardHead, Field, Input, Select } from '../lib/ui';

type TeamMember = {
  id: string;
  nome: string;
  email: string;
  role: string;
  registro: string | null;
  cor: string | null;
  ativo: boolean;
  telefone: string | null;
  professional_type: string | null;
  council_type: string | null;
  council_state: string | null;
  especialidade: string | null;
};

type Unit = { id: string; nome: string; ativo: boolean };

type MemberType = 'fisioterapeuta' | 'medico' | 'recepcionista' | 'financeiro' | 'administrador';

const TYPE_META: Record<MemberType, { label: string; role: string; council?: string }> = {
  fisioterapeuta: { label: 'Fisioterapeuta', role: 'fisio', council: 'CREFITO' },
  medico: { label: 'Médico', role: 'fisio', council: 'CRM' },
  recepcionista: { label: 'Recepcionista', role: 'recep' },
  financeiro: { label: 'Financeiro', role: 'financeiro' },
  administrador: { label: 'Administrador', role: 'admin' },
};

const memberTypeFrom = (member: TeamMember): MemberType => {
  if (member.professional_type === 'medico') return 'medico';
  if (member.professional_type === 'fisioterapeuta' || member.role === 'fisio') return 'fisioterapeuta';
  if (member.role === 'recep') return 'recepcionista';
  if (member.role === 'financeiro') return 'financeiro';
  return 'administrador';
};

export function TeamAdmin() {
  const { user, toast } = useApp();
  const db = supabase as any;
  const [clinicId, setClinicId] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [memberUnits, setMemberUnits] = useState<Record<string, string[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [type, setType] = useState<MemberType>('fisioterapeuta');
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [password, setPassword] = useState('');
  const [registro, setRegistro] = useState('');
  const [councilState, setCouncilState] = useState('');
  const [especialidade, setEspecialidade] = useState('');
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);

  const resetForm = () => {
    setEditingId(null);
    setType('fisioterapeuta');
    setNome('');
    setEmail('');
    setTelefone('');
    setPassword('');
    setRegistro('');
    setCouncilState('');
    setEspecialidade('');
    setSelectedUnits([]);
  };

  const load = async (cid: string) => {
    const [profiles, unitsResult, links] = await Promise.all([
      db.from('profiles').select('id,nome,email,role,registro,cor,ativo,telefone,professional_type,council_type,council_state,especialidade').eq('clinic_id', cid).order('ativo', { ascending: false }).order('nome'),
      db.from('units').select('id,nome,ativo').eq('clinic_id', cid).eq('ativo', true).order('nome'),
      db.from('profile_units').select('profile_id,unit_id').eq('clinic_id', cid),
    ]);
    if (profiles.error) throw profiles.error;
    if (unitsResult.error) throw unitsResult.error;
    if (links.error) throw links.error;
    setMembers(profiles.data ?? []);
    setUnits(unitsResult.data ?? []);
    const map: Record<string, string[]> = {};
    for (const link of links.data ?? []) map[link.profile_id] = [...(map[link.profile_id] ?? []), link.unit_id];
    setMemberUnits(map);
  };

  useEffect(() => {
    if (!user?.id) return;
    resolveClinicId(user.id)
      .then(async (cid) => { setClinicId(cid); await load(cid); })
      .catch((error) => {
        console.error('[MedicsPro] equipe:', error);
        toast('Não foi possível carregar a equipe.', 'warn');
      });
  }, [user?.id]);

  const currentMeta = TYPE_META[type];
  const clinical = type === 'fisioterapeuta' || type === 'medico';

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('admin-team', { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const save = async () => {
    if (!nome.trim() || (!editingId && (!email.trim() || password.length < 8))) return;
    setBusy(true);
    try {
      const body = {
        nome: nome.trim(),
        role: currentMeta.role,
        telefone: telefone.trim(),
        professional_type: clinical ? type : type,
        council_type: clinical ? currentMeta.council : '',
        council_state: clinical ? councilState.trim().toUpperCase() : '',
        registro: clinical ? registro.trim() : '',
        especialidade: clinical ? especialidade.trim() : '',
        unit_ids: selectedUnits,
      };
      if (editingId) {
        await invoke({ action: 'update', id: editingId, ...body });
        toast('Cadastro da equipe atualizado.');
      } else {
        await invoke({ action: 'create', email: email.trim().toLowerCase(), password, ...body });
        toast('Usuário criado. A senha inicial deve ser trocada no primeiro acesso.');
      }
      await load(clinicId);
      resetForm();
    } catch (error) {
      console.error('[MedicsPro] salvar equipe:', error);
      toast(error instanceof Error ? error.message : 'Falha ao salvar usuário.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const edit = (member: TeamMember) => {
    const inferred = memberTypeFrom(member);
    setEditingId(member.id);
    setType(inferred);
    setNome(member.nome);
    setEmail(member.email);
    setTelefone(member.telefone ?? '');
    setPassword('');
    setRegistro(member.registro ?? '');
    setCouncilState(member.council_state ?? '');
    setEspecialidade(member.especialidade ?? '');
    setSelectedUnits(memberUnits[member.id] ?? []);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const toggleActive = async (member: TeamMember) => {
    if (!window.confirm(`${member.ativo ? 'Desativar' : 'Reativar'} ${member.nome}?`)) return;
    setBusy(true);
    try {
      await invoke({ action: 'set_active', id: member.id, ativo: !member.ativo });
      await load(clinicId);
      toast(member.ativo ? 'Usuário desativado.' : 'Usuário reativado.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível alterar o usuário.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async (member: TeamMember) => {
    const next = window.prompt(`Nova senha temporária para ${member.nome} (mínimo 8 caracteres):`);
    if (!next) return;
    if (next.length < 8) { toast('A senha deve ter ao menos 8 caracteres.', 'warn'); return; }
    setBusy(true);
    try {
      await invoke({ action: 'reset_password', id: member.id, password: next });
      toast('Senha temporária atualizada. O usuário deverá trocá-la no primeiro acesso.');
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível redefinir a senha.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const unitNames = useMemo(() => Object.fromEntries(units.map((u) => [u.id, u.nome])), [units]);

  return (
    <Card>
      <CardHead title="Equipe & acessos" sub="cadastro seguro de profissionais e funcionários, sem expor a service_role no navegador" />
      <div className="p-5 space-y-6">
        <div className="grid xl:grid-cols-[0.95fr_1.35fr] gap-4 items-start">
          <div className="border border-line bg-deep p-4 space-y-3">
            <div>
              <p className="font-display font-semibold text-[14px]">{editingId ? 'Editar integrante' : 'Adicionar integrante'}</p>
              <p className="text-[11px] text-fog mt-1">A conta é criada pelo backend privilegiado. A chave administrativa nunca vai para o browser.</p>
            </div>
            <Field label="Tipo de integrante">
              <Select value={type} onChange={(e) => setType(e.target.value as MemberType)}>
                {(Object.keys(TYPE_META) as MemberType[]).map((key) => <option key={key} value={key}>{TYPE_META[key].label}</option>)}
              </Select>
            </Field>
            <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" /></Field>
            <Field label="E-mail"><Input value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!editingId} placeholder="profissional@clinica.com.br" /></Field>
            <Field label="Telefone"><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Field>
            {!editingId && <Field label="Senha inicial"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 8 caracteres" /></Field>}
            {clinical && (
              <div className="grid sm:grid-cols-2 gap-3">
                <Field label={currentMeta.council ?? 'Conselho'}><Input value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder="número do registro" /></Field>
                <Field label="UF do conselho"><Input value={councilState} onChange={(e) => setCouncilState(e.target.value)} maxLength={2} placeholder="MG" /></Field>
                <div className="sm:col-span-2"><Field label="Especialidade"><Input value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} placeholder="Ex.: Traumato-ortopedia" /></Field></div>
              </div>
            )}
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-fog mb-2">Unidades de atuação</p>
              <div className="space-y-1.5">
                {units.length === 0 ? <p className="text-[11px] text-amber">Cadastre ao menos uma unidade primeiro.</p> : units.map((unit) => (
                  <label key={unit.id} className="flex items-center gap-2 border border-line/70 px-3 py-2 text-[11.5px] cursor-pointer">
                    <input type="checkbox" checked={selectedUnits.includes(unit.id)} onChange={(e) => setSelectedUnits((prev) => e.target.checked ? [...prev, unit.id] : prev.filter((id) => id !== unit.id))} />
                    {unit.nome}
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Btn onClick={save} disabled={busy || !nome.trim() || (!editingId && (!email.trim() || password.length < 8))}>{busy ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Criar usuário'}</Btn>
              {editingId && <Btn variant="ghost" onClick={resetForm}>Cancelar</Btn>}
            </div>
            {type === 'medico' && <p className="text-[10.5px] text-amber">Médicos usam temporariamente o papel clínico interno enquanto o RBAC clínico é generalizado; o cadastro profissional já fica identificado como CRM.</p>}
          </div>

          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-display font-semibold text-[14px]">Equipe da clínica</p>
                <p className="text-[11px] text-fog mt-1">Perfis ativos e inativos permanecem auditáveis; desligamento não apaga histórico.</p>
              </div>
              <span className="font-mono text-[10px] text-fog">{members.filter((m) => m.ativo).length} ativos</span>
            </div>
            <div className="mt-3 space-y-2">
              {members.map((member) => {
                const mt = memberTypeFrom(member);
                return (
                  <div key={member.id} className={`border p-3 ${member.ativo ? 'border-line bg-deep' : 'border-line/50 bg-deep/40 opacity-70'}`}>
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="flex-1 min-w-[220px]">
                        <p className="font-display font-semibold text-[13.5px]">{member.nome}</p>
                        <p className="font-mono text-[10px] text-fog mt-0.5">{member.email}</p>
                        <p className="text-[10.5px] text-fog mt-1">{TYPE_META[mt].label}{member.registro ? ` · ${member.council_type || ''} ${member.registro}` : ''}{member.especialidade ? ` · ${member.especialidade}` : ''}</p>
                        <p className="font-mono text-[9.5px] text-fog mt-1">{(memberUnits[member.id] ?? []).map((id) => unitNames[id]).filter(Boolean).join(' · ') || 'Sem unidade vinculada'}</p>
                      </div>
                      <span className={`font-mono text-[9.5px] px-2 py-1 border ${member.ativo ? 'border-mint/35 text-mint' : 'border-fog/30 text-fog'}`}>{member.ativo ? 'ativo' : 'inativo'}</span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Btn variant="ghost" onClick={() => edit(member)} disabled={busy}>Editar</Btn>
                      <Btn variant="ghost" onClick={() => resetPassword(member)} disabled={busy}>Redefinir senha</Btn>
                      <Btn variant="ghost" onClick={() => toggleActive(member)} disabled={busy || member.id === user?.id}>{member.ativo ? 'Desativar' : 'Reativar'}</Btn>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
}
