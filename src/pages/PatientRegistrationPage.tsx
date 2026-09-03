import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CID10_CATALOG, type PatientGuardianInput } from '../lib/types';
import { createPatientRegistry, isMinorBirthDate, uploadPatientAvatar } from '../lib/patientRegistry';
import { useApp } from '../lib/store';
import { Btn, Card, Field, Input, Select, Textarea, IconChevronL, IconPlus } from '../lib/ui';
import { Reveal } from '../components/Reveal';

const emptyGuardian = (): PatientGuardianInput => ({
  name: '',
  relationship: '',
  cpf: '',
  phone: '',
  email: '',
  isLegalGuardian: true,
  isFinancialResponsible: false,
  isPrimaryContact: true,
});

export function PatientRegistrationPage() {
  const { user, refreshClinicData, toast } = useApp();
  const nav = useNavigate();
  const [name, setName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [cpf, setCpf] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [addressLine, setAddressLine] = useState('');
  const [insurance, setInsurance] = useState('');
  const [insuranceNumber, setInsuranceNumber] = useState('');
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [cid, setCid] = useState('');
  const [administrativeNotes, setAdministrativeNotes] = useState('');
  const [whatsappOptIn, setWhatsappOptIn] = useState(true);
  const [dependent, setDependent] = useState(false);
  const [guardians, setGuardians] = useState<PatientGuardianInput[]>([]);
  const [avatar, setAvatar] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const minor = useMemo(() => isMinorBirthDate(birthDate), [birthDate]);
  const needsGuardian = minor || dependent;
  const avatarPreview = useMemo(() => avatar ? URL.createObjectURL(avatar) : '', [avatar]);

  useEffect(() => () => { if (avatarPreview) URL.revokeObjectURL(avatarPreview); }, [avatarPreview]);

  useEffect(() => {
    if (needsGuardian && guardians.length === 0) setGuardians([emptyGuardian()]);
  }, [needsGuardian, guardians.length]);

  const updateGuardian = (index: number, patch: Partial<PatientGuardianInput>) => {
    setGuardians((current) => current.map((guardian, i) => i === index ? { ...guardian, ...patch } : guardian));
  };

  const removeGuardian = (index: number) => {
    setGuardians((current) => current.filter((_, i) => i !== index));
  };

  const save = async () => {
    setError('');
    if (!user?.id) return setError('Sessão sem usuário autenticado.');
    if (!name.trim()) return setError('Informe o nome completo do paciente.');
    if (!birthDate) return setError('Informe a data de nascimento.');
    if (needsGuardian && guardians.length === 0) return setError('Informe ao menos um responsável.');
    if (needsGuardian && guardians.some((guardian) => !guardian.name?.trim() || !guardian.relationship?.trim())) {
      return setError('Nome e vínculo são obrigatórios para cada responsável.');
    }

    setBusy(true);
    try {
      const patientId = await createPatientRegistry({
        name,
        preferredName,
        birthDate,
        cpf,
        phone,
        email,
        addressLine,
        insurance,
        insuranceNumber,
        chiefComplaint,
        cid10: cid ? [cid] : [],
        administrativeNotes,
        whatsappOptIn,
        guardians: needsGuardian ? guardians : [],
      });

      if (avatar) {
        try {
          await uploadPatientAvatar(user.id, patientId, avatar);
        } catch (avatarError) {
          console.error('[MedicsPro] avatar do paciente:', avatarError);
          toast('Paciente salvo. A foto não pôde ser enviada e pode ser adicionada depois.', 'warn');
        }
      }

      await refreshClinicData();
      toast('Paciente cadastrado com segurança.');
      nav(`/pacientes/${patientId}`);
    } catch (saveError) {
      console.error('[MedicsPro] cadastro v2 do paciente:', saveError);
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível cadastrar o paciente.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1120px] space-y-5 pb-12">
      <Reveal>
        <Link to="/pacientes" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fog transition-colors hover:text-mint">
          <IconChevronL className="h-4 w-4" /> Pacientes
        </Link>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-mint">Cadastro de paciente</p>
            <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">Novo paciente</h1>
            <p className="mt-1 max-w-2xl text-[14px] text-fog">Comece com o essencial. Responsáveis e dados complementares aparecem somente quando fizerem sentido.</p>
          </div>
          <div className="flex gap-2">
            <Link to="/pacientes"><Btn variant="ghost">Cancelar</Btn></Link>
            <Btn onClick={() => void save()} disabled={busy}>{busy ? 'Salvando…' : 'Cadastrar paciente'}</Btn>
          </div>
        </div>
      </Reveal>

      {error && <div className="rounded-xl border border-pulse/30 bg-pulse/[0.06] px-4 py-3 text-[13.5px] text-pulse">{error}</div>}

      <Reveal delay={40}>
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Identificação</h2>
            <p className="mt-0.5 text-[13px] text-fog">Dados usados em agenda, prontuário e documentos.</p>
          </div>
          <div className="grid gap-6 p-5 md:grid-cols-[180px_1fr]">
            <div>
              <div className="grid aspect-square w-[148px] place-items-center overflow-hidden rounded-3xl border border-line bg-deep text-center">
                {avatarPreview ? <img src={avatarPreview} alt="Prévia da foto do paciente" className="h-full w-full object-cover" /> : (
                  <div className="px-4">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-mint/10 text-xl font-semibold text-mint">{name.trim() ? name.trim()[0]?.toUpperCase() : '+'}</div>
                    <p className="mt-3 text-[12.5px] text-fog">Foto opcional</p>
                  </div>
                )}
              </div>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-[13px] font-semibold text-mint hover:underline">
                Escolher foto
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => setAvatar(event.target.files?.[0] ?? null)} />
              </label>
              <p className="mt-1 text-[11.5px] text-fog">JPG, PNG ou WEBP · até 5 MB</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2"><Field label="Nome completo"><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome conforme documento" autoFocus /></Field></div>
              <Field label="Nome social / preferido" hint="opcional"><Input value={preferredName} onChange={(event) => setPreferredName(event.target.value)} /></Field>
              <Field label="Data de nascimento"><Input type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} /></Field>
              <Field label="CPF" hint="pode ser completado depois"><Input value={cpf} onChange={(event) => setCpf(event.target.value)} placeholder="000.000.000-00" /></Field>
              <div className="flex items-end pb-2">
                {birthDate && <span className={`rounded-full px-3 py-1.5 text-[12px] font-semibold ${minor ? 'bg-amber/10 text-amber' : 'bg-mint/10 text-mint'}`}>{minor ? 'Menor de idade · responsável obrigatório' : 'Paciente adulto'}</span>}
              </div>
            </div>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={60}>
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-line px-5 py-4"><h2 className="font-display text-lg font-semibold">Contato</h2><p className="mt-0.5 text-[13px] text-fog">Informações operacionais de comunicação.</p></div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Telefone / WhatsApp"><Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(51) 9…" /></Field>
            <Field label="E-mail"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
            <div className="sm:col-span-2"><Field label="Endereço" hint="opcional nesta etapa"><Input value={addressLine} onChange={(event) => setAddressLine(event.target.value)} placeholder="Rua, número, complemento, cidade" /></Field></div>
            <label className="sm:col-span-2 flex cursor-pointer items-start gap-3 rounded-xl bg-deep/60 p-3">
              <input type="checkbox" checked={whatsappOptIn} onChange={(event) => setWhatsappOptIn(event.target.checked)} className="mt-1 h-4 w-4 accent-[#157d68]" />
              <span><strong className="block text-[13.5px]">Autoriza comunicação via WhatsApp</strong><span className="text-[12.5px] text-fog">Consentimento operacional para confirmações, lembretes e mensagens permitidas pela clínica.</span></span>
            </label>
          </div>
        </Card>
      </Reveal>

      <Reveal delay={80}>
        <Card className="!p-0 overflow-hidden">
          <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
            <div><h2 className="font-display text-lg font-semibold">Responsáveis</h2><p className="mt-0.5 text-[13px] text-fog">Obrigatório para menores; opcional para adultos dependentes.</p></div>
            {!minor && <label className="ml-auto flex cursor-pointer items-center gap-2 text-[13px] font-medium"><input type="checkbox" checked={dependent} onChange={(event) => setDependent(event.target.checked)} className="accent-[#157d68]" /> Adulto possui responsável/dependente</label>}
          </div>

          {needsGuardian ? (
            <div className="space-y-4 p-5">
              {guardians.map((guardian, index) => (
                <div key={index} className="rounded-2xl border border-line bg-deep/40 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3"><h3 className="font-semibold">Responsável {index + 1}</h3>{guardians.length > 1 && <button onClick={() => removeGuardian(index)} className="text-[12.5px] font-semibold text-pulse">Remover</button>}</div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="lg:col-span-2"><Field label="Nome completo"><Input value={guardian.name} onChange={(event) => updateGuardian(index, { name: event.target.value })} /></Field></div>
                    <Field label="Vínculo / parentesco"><Input value={guardian.relationship} onChange={(event) => updateGuardian(index, { relationship: event.target.value })} placeholder="Mãe, pai, tutor…" /></Field>
                    <Field label="CPF"><Input value={guardian.cpf ?? ''} onChange={(event) => updateGuardian(index, { cpf: event.target.value })} /></Field>
                    <Field label="Telefone"><Input value={guardian.phone ?? ''} onChange={(event) => updateGuardian(index, { phone: event.target.value })} /></Field>
                    <Field label="E-mail"><Input type="email" value={guardian.email ?? ''} onChange={(event) => updateGuardian(index, { email: event.target.value })} /></Field>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-[12.5px]">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={guardian.isLegalGuardian ?? false} onChange={(event) => updateGuardian(index, { isLegalGuardian: event.target.checked })} /> Responsável legal</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={guardian.isFinancialResponsible ?? false} onChange={(event) => updateGuardian(index, { isFinancialResponsible: event.target.checked })} /> Responsável financeiro</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={guardian.isPrimaryContact ?? false} onChange={(event) => updateGuardian(index, { isPrimaryContact: event.target.checked })} /> Contato principal</label>
                  </div>
                </div>
              ))}
              <Btn variant="ghost" onClick={() => setGuardians((current) => [...current, emptyGuardian()])}><IconPlus className="h-4 w-4" /> Adicionar outro responsável</Btn>
            </div>
          ) : <div className="p-5 text-[13px] text-fog">Nenhum responsável é necessário para este cadastro. Você pode ativar essa seção quando houver dependência legal, operacional ou financeira.</div>}
        </Card>
      </Reveal>

      <Reveal delay={100}>
        <Card className="!p-0 overflow-hidden">
          <div className="border-b border-line px-5 py-4"><h2 className="font-display text-lg font-semibold">Convênio e contexto inicial</h2><p className="mt-0.5 text-[13px] text-fog">Pode ser completado agora ou durante o primeiro atendimento.</p></div>
          <div className="grid gap-4 p-5 sm:grid-cols-2">
            <Field label="Convênio"><Input value={insurance} onChange={(event) => setInsurance(event.target.value)} placeholder="Particular ou operadora" /></Field>
            <Field label="Carteirinha"><Input value={insuranceNumber} onChange={(event) => setInsuranceNumber(event.target.value)} /></Field>
            <Field label="CID-10 inicial" hint="opcional; não substitui avaliação clínica"><Select value={cid} onChange={(event) => setCid(event.target.value)}><option value="">Sem CID nesta etapa</option>{CID10_CATALOG.map((item) => <option key={item.code} value={item.code}>{item.code} — {item.desc}</option>)}</Select></Field>
            <div className="sm:col-span-2"><Field label="Queixa principal"><Textarea value={chiefComplaint} onChange={(event) => setChiefComplaint(event.target.value)} placeholder="Motivo principal da procura pelo atendimento." /></Field></div>
            <div className="sm:col-span-2"><Field label="Observações administrativas" hint="não use para evolução clínica"><Textarea value={administrativeNotes} onChange={(event) => setAdministrativeNotes(event.target.value)} placeholder="Preferências de contato, orientações administrativas, informações de recepção…" /></Field></div>
          </div>
        </Card>
      </Reveal>

      <div className="flex justify-end gap-2 border-t border-line pt-5">
        <Link to="/pacientes"><Btn variant="ghost">Cancelar</Btn></Link>
        <Btn onClick={() => void save()} disabled={busy}>{busy ? 'Salvando…' : 'Cadastrar paciente'}</Btn>
      </div>
    </div>
  );
}
