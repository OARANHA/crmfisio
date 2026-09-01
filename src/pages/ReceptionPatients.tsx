import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '../lib/store';
import { ageFrom, maskCpf, STAGE_META, type FunilStage } from '../lib/types';
import {
  Btn, Card, Chip, Empty, Field, IconChevronL, IconMail, IconPhone,
  IconPlus, IconSearch, Input, Modal, Select,
} from '../lib/ui';
import { IconLock } from '../components/icons';
import { Reveal } from '../components/Reveal';
import { PatientJourneyControl } from '../components/PatientJourneyControl';
import { PatientOperationalActions } from '../components/PatientOperationalActions';

export function ReceptionPatients() {
  const { id } = useParams();
  return id ? <ReceptionPatientDetail id={id} /> : <ReceptionPatientList />;
}

function ReceptionPatientList() {
  const { patients } = useApp();
  const nav = useNavigate();
  const [query, setQuery] = useState('');
  const [stage, setStage] = useState<'all' | FunilStage>('all');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return patients.filter((patient) => {
      if (patient.anonimizado || (stage !== 'all' && patient.funilStage !== stage)) return false;
      if (!normalized) return true;
      return [patient.nome, patient.telefone, patient.email]
        .some((value) => value?.toLowerCase().includes(normalized));
    });
  }, [patients, query, stage]);

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Pacientes</h1>
            <p className="text-fog text-[13px] mt-0.5">cadastro, contato, agenda e documentação — conteúdo clínico protegido</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fog" />
              <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nome, telefone ou e-mail…" className="!pl-9 !w-64" />
            </div>
            <Select value={stage} onChange={(event) => setStage(event.target.value as 'all' | FunilStage)} className="!w-auto !py-2">
              <option value="all">Toda a jornada</option>
              {(Object.keys(STAGE_META) as FunilStage[]).map((item) => <option key={item} value={item}>{STAGE_META[item].label}</option>)}
            </Select>
            <Btn onClick={() => setCreating(true)}><IconPlus className="w-4 h-4" /> Novo paciente</Btn>
          </div>
        </div>
      </Reveal>

      <Reveal delay={80}>
        {filtered.length === 0 ? (
          <Empty title="Nenhum paciente encontrado" sub="Cadastre um paciente ou ajuste os filtros." />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="bg-deep border-b border-line font-mono text-[10.5px] uppercase tracking-[0.12em] text-fog">
                  <th className="text-left px-4 py-3 font-medium">Paciente</th>
                  <th className="text-left px-4 py-3 font-medium">Contato</th>
                  <th className="text-left px-4 py-3 font-medium">Jornada</th>
                  <th className="text-left px-4 py-3 font-medium">Última visita</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((patient) => {
                  const stageMeta = STAGE_META[patient.funilStage];
                  return (
                    <tr key={patient.id} onClick={() => nav(`/pacientes/${patient.id}`)} className="border-b border-line/60 last:border-0 hover:bg-raise/50 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-display font-semibold text-[13.5px]">{patient.nome}</p>
                        <p className="font-mono text-[10.5px] text-fog mt-0.5">{ageFrom(patient.nascimento)} anos · {maskCpf(patient.cpf)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-paper/90">{patient.telefone || 'Sem telefone'}</p>
                        <p className="font-mono text-[10.5px] text-fog mt-0.5">{patient.email || 'Sem e-mail'}</p>
                      </td>
                      <td className="px-4 py-3"><Chip className={stageMeta.chip}>{stageMeta.label}</Chip></td>
                      <td className="px-4 py-3 font-mono text-[11.5px] text-fog">
                        {patient.ultimaVisita ? format(new Date(`${patient.ultimaVisita}T12:00`), 'dd/MM/yy', { locale: ptBR }) : '—'}
                      </td>
                      <td className="px-4 py-3"><span className={`font-mono text-[11px] ${patient.status === 'ativo' ? 'text-mint' : patient.status === 'alta' ? 'text-aqua' : 'text-pulse'}`}>{patient.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </Reveal>

      <ReceptionNewPatientModal open={creating} onClose={() => setCreating(false)} />
    </div>
  );
}

function ReceptionNewPatientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addPatient, toast } = useApp();
  const [nome, setNome] = useState('');
  const [nascimento, setNascimento] = useState('1990-01-01');
  const [telefone, setTelefone] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [optIn, setOptIn] = useState(true);

  const save = () => {
    if (!nome.trim()) return;
    addPatient({
      nome: nome.trim(), nascimento, telefone, email, cpf: cpf || '000.000.000-00', convenio: null,
      queixaPrincipal: '', cid10: [], funilStage: 'lead', status: 'ativo', ultimaVisita: null, optInWhats: optIn,
    });
    toast(`${nome.trim()} enviado para cadastro operacional.`, 'info');
    setNome(''); setTelefone(''); setEmail(''); setCpf('');
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo paciente" wide>
      <div className="border border-aqua/25 bg-aqua/5 px-4 py-3 mb-4 text-[12px] text-fog">
        A recepção cadastra dados administrativos. Queixa, CID-10, avaliação e evolução pertencem ao prontuário clínico.
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome completo"><Input value={nome} onChange={(event) => setNome(event.target.value)} placeholder="Maria da Silva" /></Field>
        <Field label="Nascimento"><Input type="date" value={nascimento} onChange={(event) => setNascimento(event.target.value)} /></Field>
        <Field label="Telefone / WhatsApp"><Input value={telefone} onChange={(event) => setTelefone(event.target.value)} placeholder="(51) 9…" /></Field>
        <Field label="E-mail"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} /></Field>
        <Field label="CPF" hint="exibido mascarado na interface"><Input value={cpf} onChange={(event) => setCpf(event.target.value)} placeholder="000.000.000-00" /></Field>
      </div>
      <label className="flex items-center gap-2.5 mt-4 cursor-pointer">
        <input type="checkbox" checked={optIn} onChange={(event) => setOptIn(event.target.checked)} className="accent-[#4fd1a5] w-4 h-4" />
        <span className="text-[13px]">Paciente autoriza comunicações via WhatsApp <span className="font-mono text-[10.5px] text-fog">(opt-in)</span></span>
      </label>
      <div className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={save} disabled={!nome.trim()}><IconPlus className="w-4 h-4" /> Cadastrar</Btn>
      </div>
    </Modal>
  );
}

function ReceptionPatientDetail({ id }: { id: string }) {
  const { patients } = useApp();
  const patient = patients.find((item) => item.id === id);
  if (!patient) return <Empty title="Paciente não encontrado" action={<Link to="/pacientes"><Btn variant="ghost">Voltar</Btn></Link>} />;
  const stage = STAGE_META[patient.funilStage];

  return (
    <div className="space-y-4">
      <Reveal>
        <Link to="/pacientes" className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-fog hover:text-mint transition-colors">
          <IconChevronL className="w-3.5 h-3.5" /> pacientes
        </Link>
        <Card className="mt-2">
          <div className="px-5 py-4 flex flex-wrap items-start gap-4">
            <span className="w-12 h-12 rounded-full grid place-items-center font-display font-bold text-lg text-ink bg-mint">
              {patient.nome.split(' ').map((word) => word[0]).slice(0, 2).join('')}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl font-bold tracking-tight">{patient.nome}</h1>
                <Chip className={stage.chip}>{stage.label}</Chip>
              </div>
              <p className="font-mono text-[11.5px] text-fog mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>{ageFrom(patient.nascimento)} anos</span>
                <span className="inline-flex items-center gap-1.5"><IconLock className="w-3 h-3 text-pulse" />{maskCpf(patient.cpf)}</span>
                {patient.telefone && <span className="inline-flex items-center gap-1.5"><IconPhone className="w-3 h-3" />{patient.telefone}</span>}
                {patient.email && <span className="inline-flex items-center gap-1.5"><IconMail className="w-3 h-3" />{patient.email}</span>}
                <span className={patient.optInWhats ? 'text-mint' : 'text-fog/60'}>WhatsApp: {patient.optInWhats ? 'opt-in ✓' : 'sem opt-in'}</span>
              </p>
            </div>
            <PatientJourneyControl patient={patient} />
          </div>
        </Card>
      </Reveal>

      <Reveal delay={60}>
        <div className="border border-aqua/25 bg-aqua/5 px-4 py-3 font-mono text-[10.5px] text-aqua">
          Visão operacional · dados clínicos, avaliação e evoluções ficam restritos aos profissionais autorizados.
        </div>
      </Reveal>

      <Reveal delay={90}>
        <PatientOperationalActions patient={patient} />
      </Reveal>
    </div>
  );
}
