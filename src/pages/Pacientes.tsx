import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '../lib/store';
import {
  STAGE_META, CID10_CATALOG, maskCpf, ageFrom,
  type FunilStage,
} from '../lib/types';
import {
  Card, Btn, Modal, Field, Input, Select, Textarea, Chip, Empty,
  IconSearch, IconPlus, IconPhone, IconMail, IconChevronL,
} from '../lib/ui';
import { IconLock } from '../components/icons';
import { Reveal } from '../components/Reveal';
import { ClinicalWorkspace } from '../components/ClinicalWorkspace';
import { PatientJourneyControl } from '../components/PatientJourneyControl';
import { PatientOperationalActions } from '../components/PatientOperationalActions';

export function Pacientes() {
  const { id } = useParams();
  return id ? <Pep id={id} /> : <Lista />;
}

function Lista() {
  const { patients } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<'all' | FunilStage>('all');
  const [novo, setNovo] = useState(false);

  const filtered = useMemo(
    () => patients.filter((p) =>
      !p.anonimizado &&
      (stage === 'all' || p.funilStage === stage) &&
      (p.nome.toLowerCase().includes(q.toLowerCase()) || p.queixaPrincipal.toLowerCase().includes(q.toLowerCase()))
    ),
    [patients, q, stage],
  );

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Pacientes · PEP</h1>
            <p className="text-fog text-[13px] mt-0.5">{patients.filter((p) => !p.anonimizado).length} cadastrados · jornada clínica protegida por perfil e LGPD</p>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <div className="relative">
              <IconSearch className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-fog" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou queixa…" className="!pl-9 !w-64" />
            </div>
            <Select value={stage} onChange={(e) => setStage(e.target.value as 'all' | FunilStage)} className="!w-auto !py-2">
              <option value="all">Todo o funil</option>
              {(Object.keys(STAGE_META) as FunilStage[]).map((s) => <option key={s} value={s}>{STAGE_META[s].label}</option>)}
            </Select>
            <Btn onClick={() => setNovo(true)}><IconPlus className="w-4 h-4" /> Novo paciente</Btn>
          </div>
        </div>
      </Reveal>

      <Reveal delay={100}>
        {filtered.length === 0 ? (
          <Empty title="Nenhum paciente encontrado" sub="Cadastre o primeiro paciente ou ajuste os filtros." />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className="bg-deep border-b border-line font-mono text-[10.5px] uppercase tracking-[0.12em] text-fog">
                  <th className="text-left px-4 py-3 font-medium">Paciente</th>
                  <th className="text-left px-4 py-3 font-medium">Queixa principal · CID-10</th>
                  <th className="text-left px-4 py-3 font-medium">Jornada</th>
                  <th className="text-left px-4 py-3 font-medium">Última visita</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const sm = STAGE_META[p.funilStage];
                  return (
                    <tr key={p.id} onClick={() => nav(`/pacientes/${p.id}`)} className="border-b border-line/60 last:border-0 hover:bg-raise/50 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-display font-semibold text-[13.5px]">{p.nome}</p>
                        <p className="font-mono text-[10.5px] text-fog mt-0.5">{ageFrom(p.nascimento)} anos · {maskCpf(p.cpf)}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <p className="truncate text-paper/90">{p.queixaPrincipal}</p>
                        <p className="font-mono text-[10.5px] text-amber mt-0.5">{p.cid10.join(' · ')}</p>
                      </td>
                      <td className="px-4 py-3"><Chip className={sm.chip}>{sm.label}</Chip></td>
                      <td className="px-4 py-3 font-mono text-[11.5px] text-fog">{p.ultimaVisita ? format(new Date(`${p.ultimaVisita}T12:00`), 'dd/MM/yy', { locale: ptBR }) : '—'}</td>
                      <td className="px-4 py-3"><span className={`font-mono text-[11px] ${p.status === 'ativo' ? 'text-mint' : p.status === 'alta' ? 'text-aqua' : 'text-pulse'}`}>{p.status}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        )}
      </Reveal>

      <NewPatientModal open={novo} onClose={() => setNovo(false)} />
    </div>
  );
}

function NewPatientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addPatient, toast } = useApp();
  const [nome, setNome] = useState('');
  const [nasc, setNasc] = useState('1990-01-01');
  const [tel, setTel] = useState('');
  const [email, setEmail] = useState('');
  const [cpf, setCpf] = useState('');
  const [queixa, setQueixa] = useState('');
  const [cid, setCid] = useState(CID10_CATALOG[0].code);
  const [optIn, setOptIn] = useState(true);

  const save = () => {
    if (!nome.trim() || !queixa.trim()) return;
    addPatient({
      nome: nome.trim(),
      nascimento: nasc,
      telefone: tel,
      email,
      cpf: cpf || '000.000.000-00',
      convenio: null,
      queixaPrincipal: queixa.trim(),
      cid10: [cid],
      funilStage: 'lead',
      status: 'ativo',
      ultimaVisita: null,
      optInWhats: optIn,
    });
    toast(`${nome} enviado para cadastro — dados protegidos (LGPD)`, 'info');
    onClose();
    setNome(''); setTel(''); setEmail(''); setCpf(''); setQueixa('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo paciente" wide>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome completo"><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Maria da Silva" /></Field>
        <Field label="Nascimento"><Input type="date" value={nasc} onChange={(e) => setNasc(e.target.value)} /></Field>
        <Field label="Telefone / WhatsApp"><Input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="(51) 9…" /></Field>
        <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="CPF" hint="exibido mascarado na interface"><Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" /></Field>
        <Field label="CID-10 principal">
          <Select value={cid} onChange={(e) => setCid(e.target.value)}>{CID10_CATALOG.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.desc}</option>)}</Select>
        </Field>
        <div className="sm:col-span-2"><Field label="Queixa principal"><Textarea value={queixa} onChange={(e) => setQueixa(e.target.value)} placeholder="Motivo principal da procura pelo atendimento." /></Field></div>
      </div>
      <label className="flex items-center gap-2.5 mt-4 cursor-pointer">
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="accent-[#4fd1a5] w-4 h-4" />
        <span className="text-[13px]">Paciente autoriza comunicações via WhatsApp <span className="font-mono text-[10.5px] text-fog">(opt-in)</span></span>
      </label>
      <div className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={save} disabled={!nome.trim() || !queixa.trim()}><IconPlus className="w-4 h-4" /> Cadastrar</Btn>
      </div>
    </Modal>
  );
}

function Pep({ id }: { id: string }) {
  const { patients } = useApp();
  const p = patients.find((x) => x.id === id);
  if (!p) return <Empty title="Paciente não encontrado" action={<Link to="/pacientes"><Btn variant="ghost">Voltar</Btn></Link>} />;

  const sm = STAGE_META[p.funilStage];

  return (
    <div className="space-y-4">
      <Reveal>
        <Link to="/pacientes" className="inline-flex items-center gap-1.5 font-mono text-[11.5px] text-fog hover:text-mint transition-colors">
          <IconChevronL className="w-3.5 h-3.5" /> pacientes
        </Link>
        <Card className="mt-2">
          <div className="px-5 py-4 flex flex-wrap items-start gap-4">
            <span className="w-12 h-12 rounded-full grid place-items-center font-display font-bold text-lg text-ink" style={{ background: '#4fd1a5' }}>
              {p.nome.split(' ').map((w) => w[0]).slice(0, 2).join('')}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl font-bold tracking-tight">{p.nome}</h1>
                <Chip className={sm.chip}>{sm.label}</Chip>
                {p.status === 'inativo' && <Chip className="border-pulse/40 text-pulse">inativo · oportunidade de reativação</Chip>}
                {p.status === 'alta' && <Chip className="border-aqua/40 text-aqua">alta registrada · histórico preservado</Chip>}
              </div>
              <p className="font-mono text-[11.5px] text-fog mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>{ageFrom(p.nascimento)} anos</span>
                <span className="inline-flex items-center gap-1.5"><IconLock className="w-3 h-3 text-pulse" />{maskCpf(p.cpf)}</span>
                {p.telefone && <span className="inline-flex items-center gap-1.5"><IconPhone className="w-3 h-3" />{p.telefone}</span>}
                {p.email && <span className="inline-flex items-center gap-1.5"><IconMail className="w-3 h-3" />{p.email}</span>}
                <span className={p.optInWhats ? 'text-mint' : 'text-fog/60'}>WhatsApp: {p.optInWhats ? 'opt-in ✓' : 'sem opt-in'}</span>
              </p>
            </div>
            <PatientJourneyControl patient={p} />
          </div>
        </Card>
      </Reveal>

      <Reveal delay={60}>
        <PatientOperationalActions patient={p} />
      </Reveal>

      <Reveal delay={80}>
        <ClinicalWorkspace patient={p} />
      </Reveal>
    </div>
  );
}
