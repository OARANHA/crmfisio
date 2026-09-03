import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CID10_CATALOG, type Patient, type PatientGuardianInput } from '../lib/types';
import {
  createPatientRegistry,
  isMinorBirthDate,
  loadPatientRegistryExtras,
  removePatientAvatar,
  updatePatientRegistry,
  uploadPatientAvatar,
} from '../lib/patientRegistry';
import { useApp } from '../lib/store';
import { Btn, Card, Field, Input, Select, Textarea, IconChevronL, IconPlus } from '../lib/ui';
import { Reveal } from './Reveal';

const emptyContact = (): PatientGuardianInput => ({
  name: '', relationship: '', cpf: '', phone: '', email: '',
  isLegalGuardian: false, isFinancialResponsible: false, isPrimaryContact: true, isEmergencyContact: false,
});

type Props = { patient?: Patient };

export function PatientRegistryForm({ patient }: Props) {
  const editing = Boolean(patient);
  const { user, refreshClinicData, toast } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState(patient?.nome ?? '');
  const [preferredName, setPreferredName] = useState(patient?.preferredName ?? '');
  const [birthDate, setBirthDate] = useState(patient?.nascimento ?? '');
  const [cpf, setCpf] = useState(patient?.cpf ?? '');
  const [phone, setPhone] = useState(patient?.telefone ?? '');
  const [email, setEmail] = useState(patient?.email ?? '');
  const [addressLine, setAddressLine] = useState(patient?.addressLine ?? '');
  const [insurance, setInsurance] = useState(patient?.convenio ?? '');
  const [insuranceNumber, setInsuranceNumber] = useState(patient?.insuranceNumber ?? '');
  const [chiefComplaint, setChiefComplaint] = useState(patient?.queixaPrincipal ?? '');
  const [cid, setCid] = useState(patient?.cid10?.[0] ?? '');
  const [administrativeNotes, setAdministrativeNotes] = useState(patient?.administrativeNotes ?? '');
  const [whatsappOptIn, setWhatsappOptIn] = useState(patient?.optInWhats ?? true);
  const [contactsEnabled, setContactsEnabled] = useState(false);
  const [guardians, setGuardians] = useState<PatientGuardianInput[]>([]);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [storedAvatarUrl, setStoredAvatarUrl] = useState('');
  const [storedAvatarPath, setStoredAvatarPath] = useState<string | null>(patient?.avatarPath ?? null);
  const [removeStoredAvatar, setRemoveStoredAvatar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(editing);
  const [error, setError] = useState('');

  const minor = useMemo(() => isMinorBirthDate(birthDate), [birthDate]);
  const needsContacts = minor || contactsEnabled;
  const localPreview = useMemo(() => avatar ? URL.createObjectURL(avatar) : '', [avatar]);
  const avatarPreview = localPreview || (!removeStoredAvatar ? storedAvatarUrl : '');

  useEffect(() => () => { if (localPreview) URL.revokeObjectURL(localPreview); }, [localPreview]);

  useEffect(() => {
    if (!patient) return;
    let active = true;
    loadPatientRegistryExtras(patient.id)
      .then((extras) => {
        if (!active) return;
        setPreferredName(extras.preferredName || patient.preferredName || '');
        setAddressLine(extras.addressLine || patient.addressLine || '');
        setInsuranceNumber(extras.insuranceNumber || patient.insuranceNumber || '');
        setAdministrativeNotes(extras.administrativeNotes || patient.administrativeNotes || '');
        setStoredAvatarUrl(extras.avatarUrl ?? '');
        setStoredAvatarPath(extras.avatarPath ?? null);
        const mapped = extras.guardians.map((item) => ({
          name: item.name, relationship: item.relationship, cpf: item.cpf, phone: item.phone, email: item.email,
          isLegalGuardian: item.isLegalGuardian, isFinancialResponsible: item.isFinancialResponsible,
          isPrimaryContact: item.isPrimaryContact, isEmergencyContact: item.isEmergencyContact,
        }));
        setGuardians(mapped);
        setContactsEnabled(mapped.length > 0);
      })
      .catch((loadError) => {
        console.warn('[MedicsPro] edição cadastral:', loadError);
        setError('Alguns dados complementares não puderam ser carregados.');
      })
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [patient]);

  useEffect(() => {
    if (minor && guardians.length === 0) {
      setContactsEnabled(true);
      setGuardians([{ ...emptyContact(), isLegalGuardian: true, isPrimaryContact: true }]);
    }
  }, [minor, guardians.length]);

  const updateContact = (index: number, patch: Partial<PatientGuardianInput>) => {
    setGuardians((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  };

  const toggleContacts = () => {
    setContactsEnabled((current) => {
      const next = !current;
      if (next && guardians.length === 0) setGuardians([emptyContact()]);
      return next;
    });
  };

  const chooseAvatar = (file: File | null) => {
    setAvatar(file);
    if (file) setRemoveStoredAvatar(false);
  };

  const clearAvatar = () => {
    setAvatar(null);
    if (storedAvatarPath) setRemoveStoredAvatar(true);
  };

  const save = async () => {
    setError('');
    if (!user?.id) return setError('Sessão sem usuário autenticado.');
    if (!name.trim()) return setError('Informe o nome completo do paciente.');
    if (!birthDate) return setError('Informe a data de nascimento.');
    const activeContacts = needsContacts ? guardians : [];
    if (minor && activeContacts.length === 0) return setError('Paciente menor de idade exige ao menos um responsável.');
    if (activeContacts.some((item) => !item.name?.trim() || !item.relationship?.trim())) return setError('Nome e vínculo são obrigatórios para cada responsável ou contato.');

    setBusy(true);
    try {
      const payload = {
        name, preferredName, birthDate, cpf, phone, email, addressLine, insurance, insuranceNumber,
        chiefComplaint, cid10: cid ? [cid] : [], administrativeNotes, whatsappOptIn, guardians: activeContacts,
      };
      const patientId = patient?.id ?? await createPatientRegistry(payload);
      if (patient) await updatePatientRegistry(patient.id, payload);

      if (removeStoredAvatar && !avatar) await removePatientAvatar(patientId, storedAvatarPath);
      if (avatar) await uploadPatientAvatar(user.id, patientId, avatar);

      await refreshClinicData();
      toast(editing ? 'Cadastro do paciente atualizado.' : 'Paciente cadastrado com segurança.');
      nav(`/pacientes/${patientId}`);
    } catch (saveError) {
      console.error('[MedicsPro] cadastro do paciente:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o cadastro.');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="py-20 text-center text-fog">Carregando cadastro…</div>;

  return (
    <div className="mx-auto max-w-[1280px] space-y-6 pb-14">
      <Reveal>
        <Link to={patient ? `/pacientes/${patient.id}` : '/pacientes'} className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fog transition-colors hover:text-mint">
          <IconChevronL className="h-4 w-4" /> {patient ? 'Voltar ao prontuário' : 'Pacientes'}
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-mint">Cadastro de paciente</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{editing ? 'Editar cadastro' : 'Novo paciente'}</h1>
            <p className="mt-1 max-w-3xl text-[14px] text-fog">Informação suficiente para operar com segurança, sem transformar o cadastro em burocracia.</p>
          </div>
          <div className="flex gap-2"><Link to={patient ? `/pacientes/${patient.id}` : '/pacientes'}><Btn variant="ghost">Cancelar</Btn></Link><Btn onClick={() => void save()} disabled={busy}>{busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar paciente'}</Btn></div>
        </div>
      </Reveal>

      {error && <div className="rounded-xl border border-pulse/30 bg-pulse/[0.06] px-4 py-3 text-[13.5px] text-pulse">{error}</div>}

      <Reveal delay={40}>
        <Card className="overflow-hidden !p-0">
          <div className="border-b border-line px-6 py-4"><h2 className="font-display text-xl font-semibold">Identificação e contato</h2><p className="mt-1 text-[13px] text-fog">O que recepção, agenda e prontuário realmente precisam no dia a dia.</p></div>
          <div className="grid gap-7 p-6 lg:grid-cols-[210px_1fr]">
            <div>
              <div className="grid aspect-square w-[176px] place-items-center overflow-hidden rounded-[28px] border border-line bg-deep">
                {avatarPreview ? <img src={avatarPreview} alt="Prévia da foto do paciente" className="h-full w-full object-cover" /> : <div className="grid h-16 w-16 place-items-center rounded-full bg-mint/10 text-2xl font-semibold text-mint">{name.trim()?.[0]?.toUpperCase() || '+'}</div>}
              </div>
              <div className="mt-3 flex flex-wrap gap-3 text-[13px] font-semibold"><label className="cursor-pointer text-mint hover:underline">{avatarPreview ? 'Trocar foto' : 'Adicionar foto'}<input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => chooseAvatar(e.target.files?.[0] ?? null)} /></label>{avatarPreview && <button type="button" onClick={clearAvatar} className="text-pulse hover:underline">Remover</button>}</div>
              <p className="mt-1 text-[11.5px] text-fog">Privada · JPG, PNG ou WEBP · até 5 MB</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="sm:col-span-2 xl:col-span-2"><Field label="Nome completo"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome conforme documento" autoFocus={!editing} /></Field></div>
              <Field label="Data de nascimento"><Input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} /></Field>
              <Field label="Nome social / preferido" hint="opcional"><Input value={preferredName} onChange={(e) => setPreferredName(e.target.value)} /></Field>
              <Field label="CPF" hint="pode ser completado depois"><Input value={cpf} onChange={(e) => setCpf(e.target.value)} /></Field>
              <div className="flex items-end pb-2">{birthDate && <span className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${minor ? 'bg-amber/10 text-amber' : 'bg-mint/10 text-mint'}`}>{minor ? 'Menor · responsável obrigatório' : 'Paciente adulto'}</span>}</div>
              <Field label="Telefone / WhatsApp"><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></Field>
              <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
              <div className="sm:col-span-2 xl:col-span-3"><Field label="Endereço" hint="opcional"><Input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} placeholder="Rua, número, complemento, cidade" /></Field></div>
              <label className="sm:col-span-2 xl:col-span-3 flex cursor-pointer items-start gap-3 rounded-xl bg-deep/60 p-3"><input type="checkbox" checked={whatsappOptIn} onChange={(e) => setWhatsappOptIn(e.target.checked)} className="mt-1 h-4 w-4 accent-[#157d68]" /><span><strong className="block text-[13.5px]">Autoriza comunicação via WhatsApp</strong><span className="text-[12.5px] text-fog">Confirmações, lembretes e comunicações operacionais permitidas.</span></span></label>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={70}>
        <Card className={`overflow-hidden !p-0 ${minor ? 'ring-1 ring-amber/30' : ''}`}>
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-6 py-4"><div><h2 className="font-display text-xl font-semibold">Responsáveis e contatos</h2><p className="mt-1 text-[13px] text-fog">Responsável legal, financeiro, contato principal ou contato de emergência.</p></div>{!minor && <Btn variant="ghost" className="ml-auto" onClick={toggleContacts}>{needsContacts ? 'Ocultar contatos' : 'Adicionar responsável ou contato de apoio'}</Btn>}</div>
          {needsContacts ? <div className="space-y-4 p-6">{guardians.map((item, index) => (
            <div key={index} className="rounded-2xl border border-line bg-deep/35 p-4">
              <div className="mb-4 flex items-center justify-between"><h3 className="font-semibold">Contato {index + 1}</h3>{(!minor || guardians.length > 1) && <button type="button" onClick={() => setGuardians((current) => current.filter((_, i) => i !== index))} className="text-[12.5px] font-semibold text-pulse">Remover</button>}</div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><div className="lg:col-span-2"><Field label="Nome completo"><Input value={item.name} onChange={(e) => updateContact(index, { name: e.target.value })} /></Field></div><Field label="Vínculo"><Input value={item.relationship} onChange={(e) => updateContact(index, { relationship: e.target.value })} placeholder="Mãe, pai, tutor, cuidador…" /></Field><Field label="CPF"><Input value={item.cpf ?? ''} onChange={(e) => updateContact(index, { cpf: e.target.value })} /></Field><Field label="Telefone"><Input value={item.phone ?? ''} onChange={(e) => updateContact(index, { phone: e.target.value })} /></Field><Field label="E-mail"><Input value={item.email ?? ''} onChange={(e) => updateContact(index, { email: e.target.value })} /></Field></div>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px]"><label className="flex items-center gap-2"><input type="checkbox" checked={item.isLegalGuardian ?? false} onChange={(e) => updateContact(index, { isLegalGuardian: e.target.checked })} /> Responsável legal</label><label className="flex items-center gap-2"><input type="checkbox" checked={item.isFinancialResponsible ?? false} onChange={(e) => updateContact(index, { isFinancialResponsible: e.target.checked })} /> Financeiro</label><label className="flex items-center gap-2"><input type="checkbox" checked={item.isPrimaryContact ?? false} onChange={(e) => updateContact(index, { isPrimaryContact: e.target.checked })} /> Contato principal</label><label className="flex items-center gap-2"><input type="checkbox" checked={item.isEmergencyContact ?? false} onChange={(e) => updateContact(index, { isEmergencyContact: e.target.checked })} /> Emergência</label></div>
            </div>
          ))}<Btn variant="ghost" onClick={() => setGuardians((current) => [...current, emptyContact()])}><IconPlus className="h-4 w-4" /> Adicionar outro contato</Btn></div> : <div className="p-6 text-[13px] text-fog">Nenhum responsável é necessário. Para adultos, adicione apenas quando houver apoio, dependência, contato financeiro ou emergência.</div>}
        </Card>
      </Reveal>

      <Reveal delay={100}>
        <Card className="overflow-hidden !p-0"><div className="border-b border-line px-6 py-4"><h2 className="font-display text-xl font-semibold">Informações complementares</h2><p className="mt-1 text-[13px] text-fog">Convênio e motivo inicial podem ser completados agora ou no primeiro atendimento.</p></div><div className="grid gap-5 p-6 lg:grid-cols-2"><div className="space-y-4 rounded-2xl bg-deep/35 p-4"><h3 className="font-semibold">Convênio</h3><Field label="Convênio"><Input value={insurance} onChange={(e) => setInsurance(e.target.value)} placeholder="Particular ou operadora" /></Field><Field label="Carteirinha"><Input value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)} /></Field></div><div className="space-y-4 rounded-2xl bg-deep/35 p-4"><h3 className="font-semibold">Motivo do atendimento</h3><Field label="CID-10 inicial" hint="opcional"><Select value={cid} onChange={(e) => setCid(e.target.value)}><option value="">Sem CID nesta etapa</option>{CID10_CATALOG.map((item) => <option key={item.code} value={item.code}>{item.code} — {item.desc}</option>)}</Select></Field><Field label="Queixa principal"><Textarea value={chiefComplaint} onChange={(e) => setChiefComplaint(e.target.value)} /></Field></div><div className="lg:col-span-2"><Field label="Observações administrativas" hint="não use para evolução clínica"><Textarea value={administrativeNotes} onChange={(e) => setAdministrativeNotes(e.target.value)} /></Field></div></div></Card>
      </Reveal>

      <div className="flex justify-end gap-2 border-t border-line pt-5"><Link to={patient ? `/pacientes/${patient.id}` : '/pacientes'}><Btn variant="ghost">Cancelar</Btn></Link><Btn onClick={() => void save()} disabled={busy}>{busy ? 'Salvando…' : editing ? 'Salvar alterações' : 'Cadastrar paciente'}</Btn></div>
    </div>
  );
}
