import { useCallback, useEffect, useMemo, useState } from 'react';
import { resolveClinicId } from '../lib/repository';
import { supabase } from '../lib/supabaseClient';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import {
  CLINICAL_CAPABILITIES,
  DEFAULT_CLINICAL_CAPABILITIES,
  PROFESSIONAL_META,
  isProfessionalType,
  professionalIdentityLabel,
  type ClinicalCapabilityKey,
  type ProfessionalType,
} from '../lib/professionalIdentity';
import { useToast } from '../lib/toastContext';
import { Btn, Card, CardHead, Field, Input, Select } from '../lib/ui';

type ManagedRole = 'admin' | 'professional' | 'recep' | 'financeiro';
type TeamRole = 'owner' | ManagedRole;

type TeamMember = {
  id: string;
  nome: string;
  email: string;
  role: TeamRole;
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

type CapabilityRow = {
  professional_id: string;
  capability_key: string;
  granted: boolean;
};

const ROLE_OPTIONS: Array<{ value: ManagedRole; label: string; description: string }> = [
  { value: 'professional', label: 'Profissional clínico', description: 'Atende pacientes; a profissão é definida separadamente abaixo.' },
  { value: 'admin', label: 'Administrador', description: 'Opera a clínica e pode também ter identidade clínica própria.' },
  { value: 'recep', label: 'Recepção', description: 'Agenda, cadastro e operação de recepção, sem autoria clínica.' },
  { value: 'financeiro', label: 'Financeiro', description: 'Cobranças, recebimentos e relatórios financeiros.' },
];

const db = supabase as any;

export function TeamAdmin() {
  const { user } = useCurrentUserAccess();
  const { toast } = useToast();
  const [clinicId, setClinicId] = useState('');
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [memberUnits, setMemberUnits] = useState<Record<string, string[]>>({});
  const [memberCapabilities, setMemberCapabilities] = useState<Record<string, ClinicalCapabilityKey[]>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingRole, setEditingRole] = useState<TeamRole | null>(null);
  const [busy, setBusy] = useState(false);

  const [role, setRole] = useState<ManagedRole>('professional');
  const [profession, setProfession] = useState<ProfessionalType>('fisioterapeuta');
  const [hasClinicalIdentity, setHasClinicalIdentity] = useState(true);
  const [clinicalCapabilities, setClinicalCapabilities] = useState<ClinicalCapabilityKey[]>(DEFAULT_CLINICAL_CAPABILITIES.fisioterapeuta);
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
    setEditingRole(null);
    setRole('professional');
    setProfession('fisioterapeuta');
    setHasClinicalIdentity(true);
    setClinicalCapabilities(DEFAULT_CLINICAL_CAPABILITIES.fisioterapeuta);
    setNome('');
    setEmail('');
    setTelefone('');
    setPassword('');
    setRegistro('');
    setCouncilState('');
    setEspecialidade('');
    setSelectedUnits([]);
  };

  const load = useCallback(async (cid: string) => {
    const [profiles, unitsResult, links, capabilities] = await Promise.all([
      db.from('profiles').select('id,nome,email,role,registro,cor,ativo,telefone,professional_type,council_type,council_state,especialidade').eq('clinic_id', cid).order('ativo', { ascending: false }).order('nome'),
      db.from('units').select('id,nome,ativo').eq('clinic_id', cid).eq('ativo', true).order('nome'),
      db.from('profile_units').select('profile_id,unit_id').eq('clinic_id', cid),
      db.from('professional_capabilities').select('professional_id,capability_key,granted').eq('clinic_id', cid),
    ]);
    if (profiles.error) throw profiles.error;
    if (unitsResult.error) throw unitsResult.error;
    if (links.error) throw links.error;
    if (capabilities.error) throw capabilities.error;
    setMembers(profiles.data ?? []);
    setUnits(unitsResult.data ?? []);

    const unitMap: Record<string, string[]> = {};
    for (const link of links.data ?? []) unitMap[link.profile_id] = [...(unitMap[link.profile_id] ?? []), link.unit_id];
    setMemberUnits(unitMap);

    const capabilityMap: Record<string, ClinicalCapabilityKey[]> = {};
    for (const item of (capabilities.data ?? []) as CapabilityRow[]) {
      if (!item.granted || !CLINICAL_CAPABILITIES.some((entry) => entry.key === item.capability_key)) continue;
      capabilityMap[item.professional_id] = [...(capabilityMap[item.professional_id] ?? []), item.capability_key as ClinicalCapabilityKey];
    }
    setMemberCapabilities(capabilityMap);
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    resolveClinicId(user.id)
      .then(async (cid) => { setClinicId(cid); await load(cid); })
      .catch((error) => {
        console.error('[MedicsPro] equipe:', error);
        toast('Não foi possível carregar a equipe.', 'warn');
      });
  }, [user?.id, load, toast]);

  const currentProfessionalMeta = PROFESSIONAL_META[profession];
  const ownerEditing = editingRole === 'owner';
  const roleAllowsClinicalIdentity = ownerEditing || role === 'admin' || role === 'professional';
  const clinical = roleAllowsClinicalIdentity && hasClinicalIdentity;

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke('admin-team', { body });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  };

  const chooseProfession = (next: ProfessionalType) => {
    setProfession(next);
    setClinicalCapabilities(DEFAULT_CLINICAL_CAPABILITIES[next]);
    setRegistro('');
    setCouncilState('');
  };

  const toggleCapability = (key: ClinicalCapabilityKey, checked: boolean) => {
    setClinicalCapabilities((previous) => checked ? [...new Set([...previous, key])] : previous.filter((item) => item !== key));
  };

  const save = async () => {
    if (!nome.trim() || (!editingId && (!email.trim() || password.length < 8))) return;
    if (clinical && currentProfessionalMeta.councilRequired && (!registro.trim() || councilState.trim().length !== 2)) {
      toast(`Informe ${currentProfessionalMeta.councilLabel}, número e UF para habilitar atuação clínica.`, 'warn');
      return;
    }
    setBusy(true);
    try {
      const body: Record<string, unknown> = {
        nome: nome.trim(),
        telefone: telefone.trim(),
        professional_type: clinical ? profession : '',
        council_type: clinical ? currentProfessionalMeta.councilType : '',
        council_state: clinical ? councilState.trim().toUpperCase() : '',
        registro: clinical ? registro.trim() : '',
        especialidade: clinical ? especialidade.trim() : '',
        capability_keys: clinical ? clinicalCapabilities : [],
      };
      if (!ownerEditing) {
        body.role = role;
        body.unit_ids = selectedUnits;
      }
      if (editingId) {
        await invoke({ action: 'update', id: editingId, ...body });
        toast('Cadastro, identidade profissional e atuação clínica atualizados.');
      } else {
        await invoke({ action: 'create', email: email.trim().toLowerCase(), password, ...body, unit_ids: selectedUnits });
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
    const inferredProfessional = isProfessionalType(member.professional_type) ? member.professional_type : 'fisioterapeuta';
    const identityPresent = Boolean(member.professional_type) || member.role === 'professional';
    setEditingId(member.id);
    setEditingRole(member.role);
    if (member.role !== 'owner') setRole(member.role);
    setProfession(inferredProfessional);
    setHasClinicalIdentity(identityPresent);
    setClinicalCapabilities(memberCapabilities[member.id]?.length ? memberCapabilities[member.id] : identityPresent ? DEFAULT_CLINICAL_CAPABILITIES[inferredProfessional] : []);
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
      <CardHead title="Equipe & profissionais" sub="função na clínica, identidade profissional e atuação clínica são configuradas separadamente" />
      <div className="p-5 space-y-6">
        <div className="grid xl:grid-cols-[0.95fr_1.35fr] gap-4 items-start">
          <div className="rounded-2xl border border-line bg-deep p-4 space-y-4">
            <div>
              <p className="font-display font-semibold text-[14px]">{editingId ? 'Editar integrante' : 'Adicionar integrante'}</p>
              <p className="text-[11px] text-fog mt-1">A função operacional não define a profissão. Proprietários e administradores também podem atender com a mesma conta quando possuem identidade clínica válida.</p>
            </div>

            <div className="rounded-xl border border-line/70 bg-panel/55 p-3 space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-fog">1 · Função na clínica</p>
              {ownerEditing ? (
                <div className="rounded-lg border border-pulse/25 bg-pulse/[0.04] px-3 py-2.5">
                  <p className="font-display text-[12.5px] font-semibold text-pulse">Proprietário</p>
                  <p className="mt-1 text-[10.5px] text-fog">Função fixa. A atuação clínica pode ser configurada abaixo sem alterar a propriedade da clínica.</p>
                </div>
              ) : (
                <Field label="Função operacional">
                  <Select value={role} onChange={(e) => {
                    const next = e.target.value as ManagedRole;
                    setRole(next);
                    if (next === 'professional') setHasClinicalIdentity(true);
                    if (next === 'recep' || next === 'financeiro') setHasClinicalIdentity(false);
                  }}>
                    {ROLE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
                  </Select>
                </Field>
              )}
              {!ownerEditing && <p className="text-[10.5px] text-fog">{ROLE_OPTIONS.find((item) => item.value === role)?.description}</p>}
            </div>

            <div className="space-y-3">
              <Field label="Nome"><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo" /></Field>
              <Field label="E-mail"><Input value={email} onChange={(e) => setEmail(e.target.value)} disabled={!!editingId} placeholder="profissional@clinica.com.br" /></Field>
              <Field label="Telefone"><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} /></Field>
              {!editingId && <Field label="Senha inicial"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="mínimo 8 caracteres" /></Field>}
            </div>

            {roleAllowsClinicalIdentity && (
              <div className="rounded-xl border border-aqua/20 bg-aqua/[0.035] p-3 space-y-3">
                <div className="flex items-start gap-2">
                  <input id="clinical-identity" type="checkbox" checked={hasClinicalIdentity} disabled={role === 'professional' && !ownerEditing} onChange={(e) => setHasClinicalIdentity(e.target.checked)} className="mt-0.5" />
                  <label htmlFor="clinical-identity" className="cursor-pointer">
                    <p className="font-display text-[12.5px] font-semibold">Também atua clinicamente</p>
                    <p className="mt-0.5 text-[10.5px] text-fog">Habilita identidade profissional. As permissões abaixo continuam validadas pelo backend.</p>
                  </label>
                </div>

                {clinical && <>
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-fog">2 · Identidade profissional</p>
                  <Field label="Profissão">
                    <Select value={profession} onChange={(e) => chooseProfession(e.target.value as ProfessionalType)}>
                      {(Object.keys(PROFESSIONAL_META) as ProfessionalType[]).map((key) => <option key={key} value={key}>{PROFESSIONAL_META[key].label}</option>)}
                    </Select>
                  </Field>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <Field label={currentProfessionalMeta.councilLabel}><Input value={registro} onChange={(e) => setRegistro(e.target.value)} placeholder={currentProfessionalMeta.councilRequired ? 'número do registro' : 'opcional'} /></Field>
                    <Field label="UF do registro"><Input value={councilState} onChange={(e) => setCouncilState(e.target.value)} maxLength={2} placeholder={currentProfessionalMeta.councilRequired ? 'RS' : 'opcional'} /></Field>
                    <div className="sm:col-span-2"><Field label="Especialidade"><Input value={especialidade} onChange={(e) => setEspecialidade(e.target.value)} placeholder={currentProfessionalMeta.specialtyPlaceholder} /></Field></div>
                  </div>

                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-fog">3 · Atuação clínica</p>
                    <p className="mt-1 text-[10.5px] text-fog">O plano da clínica define quais recursos existem; estas opções definem o que este profissional pode executar.</p>
                    <div className="mt-2 space-y-1.5">
                      {CLINICAL_CAPABILITIES.map((item) => (
                        <label key={item.key} className="flex items-start gap-2 rounded-lg border border-line/70 bg-deep/50 px-3 py-2.5 cursor-pointer">
                          <input type="checkbox" className="mt-0.5" checked={clinicalCapabilities.includes(item.key)} onChange={(e) => toggleCapability(item.key, e.target.checked)} />
                          <span><span className="block text-[11.5px] font-semibold text-paper">{item.label}</span><span className="block mt-0.5 text-[10px] leading-relaxed text-fog">{item.description}</span></span>
                        </label>
                      ))}
                    </div>
                  </div>
                </>}
              </div>
            )}

            {!ownerEditing && <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-fog mb-2">4 · Unidades de atuação</p>
              <div className="space-y-1.5">
                {units.length === 0 ? <p className="text-[11px] text-amber">Cadastre ao menos uma unidade primeiro.</p> : units.map((unit) => (
                  <label key={unit.id} className="flex items-center gap-2 rounded-lg border border-line/70 px-3 py-2 text-[11.5px] cursor-pointer">
                    <input type="checkbox" checked={selectedUnits.includes(unit.id)} onChange={(e) => setSelectedUnits((prev) => e.target.checked ? [...new Set([...prev, unit.id])] : prev.filter((id) => id !== unit.id))} />
                    {unit.nome}
                  </label>
                ))}
              </div>
            </div>}

            <div className="flex flex-wrap gap-2">
              <Btn onClick={save} disabled={busy || !nome.trim() || (!editingId && (!email.trim() || password.length < 8))}>{busy ? 'Salvando…' : editingId ? 'Salvar alterações' : 'Criar usuário'}</Btn>
              {editingId && <Btn variant="ghost" onClick={resetForm}>Cancelar</Btn>}
            </div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="font-display font-semibold text-[14px]">Equipe da clínica</p>
                <p className="text-[11px] text-fog mt-1">Função, profissão e capacidades permanecem separadas. Desligamento não apaga histórico.</p>
              </div>
              <span className="font-mono text-[10px] text-fog">{members.filter((m) => m.ativo).length} ativos</span>
            </div>
            <div className="mt-3 space-y-2">
              {members.map((member) => {
                const identity = member.professional_type ? professionalIdentityLabel({ professionalType: member.professional_type, specialty: member.especialidade, councilType: member.council_type }) : null;
                const roleLabel = member.role === 'owner' ? 'Proprietário' : member.role === 'admin' ? 'Administrador' : member.role === 'recep' ? 'Recepção' : member.role === 'financeiro' ? 'Financeiro' : 'Profissional clínico';
                const granted = memberCapabilities[member.id] ?? [];
                return (
                  <div key={member.id} className={`rounded-xl border p-3 ${member.ativo ? 'border-line bg-deep' : 'border-line/50 bg-deep/40 opacity-70'}`}>
                    <div className="flex flex-wrap items-start gap-2">
                      <div className="flex-1 min-w-[220px]">
                        <p className="font-display font-semibold text-[13.5px]">{member.nome}</p>
                        <p className="font-mono text-[10px] text-fog mt-0.5">{member.email}</p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <span className="rounded-full border border-line px-2 py-0.5 text-[9.5px] text-fog">{roleLabel}</span>
                          {identity && <span className="rounded-full border border-aqua/30 px-2 py-0.5 text-[9.5px] text-aqua">{identity}</span>}
                          {granted.length > 0 && <span className="rounded-full border border-mint/30 px-2 py-0.5 text-[9.5px] text-mint">{granted.length} permissões clínicas</span>}
                        </div>
                        {member.registro && <p className="text-[10.5px] text-fog mt-1.5">{member.council_type || 'Registro'} {member.registro}{member.council_state ? `/${member.council_state}` : ''}{member.especialidade ? ` · ${member.especialidade}` : ''}</p>}
                        <p className="font-mono text-[9.5px] text-fog mt-1">{(memberUnits[member.id] ?? []).map((id) => unitNames[id]).filter(Boolean).join(' · ') || (member.role === 'owner' ? 'Proprietário da clínica' : 'Sem unidade vinculada')}</p>
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
