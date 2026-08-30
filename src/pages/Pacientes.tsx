import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp, userName } from '../lib/store';
import {
  STAGE_META, STATUS_META, CID10_CATALOG, fmtBRL, maskCpf, ageFrom, dayOf,
  type ConsentTerm, type FunilStage, type Patient,
} from '../lib/types';
import {
  Card, CardHead, Btn, Modal, Field, Input, Select, Textarea, Chip, Empty, Bar,
  IconSearch, IconPlus, IconPhone, IconMail, IconFile, IconPaperclip, IconChevronL,
} from '../lib/ui';
import { IconLock } from '../components/icons';
import { Reveal } from '../components/Reveal';

export function Pacientes() {
  const { id } = useParams();
  return id ? <Pep id={id} /> : <Lista />;
}

/* --------------------------------- lista ---------------------------------- */
function Lista() {
  const { patients } = useApp();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<'all' | FunilStage>('all');
  const [novo, setNovo] = useState(false);

  const filtered = useMemo(
    () =>
      patients.filter(
        (p) =>
          !p.anonimizado &&
          (stage === 'all' || p.funilStage === stage) &&
          (p.nome.toLowerCase().includes(q.toLowerCase()) || p.queixaPrincipal.toLowerCase().includes(q.toLowerCase()))
      ),
    [patients, q, stage]
  );

  return (
    <div className="space-y-4">
      <Reveal>
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="font-display text-3xl font-bold tracking-tight">Pacientes · PEP</h1>
            <p className="text-fog text-[13px] mt-0.5">{patients.filter((p) => !p.anonimizado).length} cadastrados · prontuário eletrônico protegido (LGPD)</p>
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
          <Empty title="Nenhum paciente encontrado" sub="Ajuste a busca ou o filtro do funil." />
        ) : (
          <Card className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead>
                <tr className="bg-deep border-b border-line font-mono text-[10.5px] uppercase tracking-[0.12em] text-fog">
                  <th className="text-left px-4 py-3 font-medium">Paciente</th>
                  <th className="text-left px-4 py-3 font-medium">Queixa principal · CID-10</th>
                  <th className="text-left px-4 py-3 font-medium">Funil</th>
                  <th className="text-left px-4 py-3 font-medium">Última visita</th>
                  <th className="text-left px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const sm = STAGE_META[p.funilStage];
                  return (
                    <tr key={p.id} onClick={() => nav(`/pacientes/${p.id}`)}
                      className="border-b border-line/60 last:border-0 hover:bg-raise/50 cursor-pointer transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-display font-semibold text-[13.5px]">{p.nome}</p>
                        <p className="font-mono text-[10.5px] text-fog mt-0.5">{ageFrom(p.nascimento)} anos · {maskCpf(p.cpf)}</p>
                      </td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <p className="truncate text-paper/90">{p.queixaPrincipal}</p>
                        <p className="font-mono text-[10.5px] text-amber mt-0.5">{p.cid10.join(' · ')}</p>
                      </td>
                      <td className="px-4 py-3"><Chip className={sm.chip}>{sm.label}</Chip></td>
                      <td className="px-4 py-3 font-mono text-[11.5px] text-fog">
                        {p.ultimaVisita ? format(new Date(p.ultimaVisita + 'T12:00'), 'dd/MM/yy', { locale: ptBR }) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`font-mono text-[11px] ${p.status === 'ativo' ? 'text-mint' : p.status === 'alta' ? 'text-aqua' : 'text-pulse'}`}>
                          {p.status}
                        </span>
                      </td>
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

/* -------------------------------- cadastro -------------------------------- */
function NewPatientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addPatient, toast } = useApp();
  const nav = useNavigate();
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
      nome: nome.trim(), nascimento: nasc, telefone: tel, email, cpf: cpf || '000.000.000-00',
      convenio: null, queixaPrincipal: queixa.trim(), cid10: [cid], funilStage: 'lead',
      status: 'ativo', ultimaVisita: null, optInWhats: optIn,
    });
    toast(`${nome} cadastrado(a) — dados sensíveis protegidos (LGPD)`);
    onClose();
    setNome(''); setTel(''); setEmail(''); setCpf(''); setQueixa('');
    nav('/pacientes');
  };

  return (
    <Modal open={open} onClose={onClose} title="Novo paciente" wide>
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Nome completo"><Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Maria da Silva" /></Field>
        <Field label="Nascimento"><Input type="date" value={nasc} onChange={(e) => setNasc(e.target.value)} /></Field>
        <Field label="Telefone / WhatsApp"><Input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="(31) 9…" /></Field>
        <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="CPF" hint="armazenado criptografado, exibido mascarado"><Input value={cpf} onChange={(e) => setCpf(e.target.value)} placeholder="000.000.000-00" /></Field>
        <Field label="CID-10 principal">
          <Select value={cid} onChange={(e) => setCid(e.target.value)}>
            {CID10_CATALOG.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.desc}</option>)}
          </Select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Queixa principal"><Textarea value={queixa} onChange={(e) => setQueixa(e.target.value)} placeholder="Descreva a queixa e o histórico…" /></Field>
        </div>
      </div>
      <label className="flex items-center gap-2.5 mt-4 cursor-pointer">
        <input type="checkbox" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} className="accent-[#4fd1a5] w-4 h-4" />
        <span className="text-[13px]">Paciente autoriza comunicações via WhatsApp <span className="font-mono text-[10.5px] text-fog">(opt-in LGPD)</span></span>
      </label>
      <div className="flex justify-end gap-2 mt-5">
        <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
        <Btn onClick={save} disabled={!nome.trim() || !queixa.trim()}><IconPlus className="w-4 h-4" /> Cadastrar</Btn>
      </div>
    </Modal>
  );
}

/* ----------------------------------- PEP ---------------------------------- */
function Pep({ id }: { id: string }) {
  const { patients, access, users, evolutions, consents, appointments, patientPackages, packages, signConsent, addEvolution, setFunilStage, user } = useApp();
  const p = patients.find((x) => x.id === id);
  const [tab, setTab] = useState<'resumo' | 'anamnese' | 'evolucao' | 'consent' | 'sessoes'>('resumo');
  const [evoText, setEvoText] = useState('');
  const [anexoNome, setAnexoNome] = useState('');
  const [assinando, setAssinando] = useState<ConsentTerm | null>(null);

  const clinico = access('clinico');
  const canEdit = clinico === 'full';

  if (!p) return <Empty title="Paciente não encontrado" action={<Link to="/pacientes"><Btn variant="ghost">Voltar</Btn></Link>} />;

  const sm = STAGE_META[p.funilStage];
  const pp = patientPackages.filter((x) => x.pacienteId === p.id);
  const evo = evolutions.filter((e) => e.pacienteId === p.id);
  const cons = consents.filter((c) => c.pacienteId === p.id);
  const sess = appointments.filter((a) => a.pacienteId === p.id).sort((a, b) => (dayOf(a) < dayOf(b) ? 1 : -1));

  const tabs = [
    { k: 'resumo', l: 'Resumo', locked: false },
    { k: 'anamnese', l: 'Anamnese', locked: clinico === 'none' },
    { k: 'evolucao', l: `Evolução (${evo.length})`, locked: clinico === 'none' },
    { k: 'consent', l: 'Consentimentos', locked: clinico === 'none' },
    { k: 'sessoes', l: `Sessões (${sess.length})`, locked: false },
  ] as const;

  const registrarEvolucao = () => {
    if (!evoText.trim() || !user) return;
    addEvolution({
      pacienteId: p.id, fisioId: user.role === 'fisio' ? user.id : 'u2',
      texto: evoText.trim(), anexos: anexoNome ? [anexoNome] : [],
      ['da' + 'ta' as 'data']: format(new Date(), 'yyyy-MM-dd'),
    } as never);
    setEvoText(''); setAnexoNome('');
  };

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
                {p.status === 'inativo' && <Chip className="border-pulse/40 text-pulse">inativo — reativar</Chip>}
                {p.anonimizado && <Chip className="border-line text-fog">anonimizado (LGPD)</Chip>}
              </div>
              <p className="font-mono text-[11.5px] text-fog mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
                <span>{ageFrom(p.nascimento)} anos</span>
                <span className="inline-flex items-center gap-1.5"><IconLock className="w-3 h-3 text-pulse" />{maskCpf(p.cpf)}</span>
                {p.telefone && <span className="inline-flex items-center gap-1.5"><IconPhone className="w-3 h-3" />{p.telefone}</span>}
                {p.email && <span className="inline-flex items-center gap-1.5"><IconMail className="w-3 h-3" />{p.email}</span>}
                <span className={p.optInWhats ? 'text-mint' : 'text-fog/60'}>WhatsApp: {p.optInWhats ? 'opt-in ✓' : 'sem opt-in'}</span>
              </p>
            </div>
            {canEdit && sm.next && (
              <Btn variant="subtle" onClick={() => setFunilStage(p.id, sm.next!)}>
                Avançar para {STAGE_META[sm.next].label}
              </Btn>
            )}
          </div>
          <div className="flex border-t border-line overflow-x-auto">
            {tabs.map((t) => (
              <button key={t.k} onClick={() => !t.locked && setTab(t.k)}
                className={`px-4 py-2.5 font-display font-semibold text-[13px] border-b-2 whitespace-nowrap transition-colors ${
                  t.locked ? 'text-fog/40 cursor-not-allowed' : tab === t.k ? 'border-mint text-mint' : 'border-transparent text-fog hover:text-paper'
                }`}>
                {t.locked && <IconLock className="w-3 h-3 inline mr-1.5 -mt-0.5" />}{t.l}
              </button>
            ))}
          </div>
        </Card>
      </Reveal>

      <Reveal delay={100}>
        {tab === 'resumo' && (
          <div className="grid lg:grid-cols-2 gap-4">
            <Card>
              <CardHead title="Dados clínicos" sub="queixa + CID-10 registrados" />
              <div className="p-5 space-y-3 text-[13.5px]">
                <p><span className="font-mono text-[10.5px] uppercase text-fog block">Queixa principal</span>{p.queixaPrincipal}</p>
                <div className="flex gap-1.5 flex-wrap">
                  {p.cid10.map((c) => <Chip key={c} className="border-amber/40 text-amber">{c}</Chip>)}
                </div>
                <p><span className="font-mono text-[10.5px] uppercase text-fog block">Convênio</span>{p.convenio ?? 'Particular'}</p>
                <p><span className="font-mono text-[10.5px] uppercase text-fog block">Objetivo terapêutico</span>{p.anamnese.objetivo || '—'}</p>
              </div>
            </Card>
            <Card>
              <CardHead title="Pacotes ativos" sub="saldo de sessões" />
              <ul className="divide-y divide-line/70">
                {pp.length === 0 && <li className="px-5 py-6 text-center font-mono text-[11.5px] text-fog">Nenhum pacote contratado.</li>}
                {pp.map((x) => {
                  const pk = packages.find((y) => y.id === x.pacoteId);
                  const restam = x.sessoesTotais - x.sessoesUsadas;
                  return (
                    <li key={x.id} className="px-5 py-3.5">
                      <div className="flex items-center justify-between">
                        <p className="text-[13px] font-semibold">{pk?.nome}</p>
                        <span className={`font-mono text-[12px] ${restam <= 2 ? 'text-pulse' : 'text-mint'}`}>{restam}/{x.sessoesTotais}</span>
                      </div>
                      <Bar pct={(x.sessoesUsadas / x.sessoesTotais) * 100} color={restam <= 2 ? '#f2545b' : '#4fd1a5'} className="mt-2" />
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        )}

        {tab === 'anamnese' && clinico !== 'none' && (
          <Card>
            <CardHead title="Anamnese" sub="histórico clínico coletado na avaliação" right={<IconLock className="w-4 h-4 text-pulse" />} />
            <div className="p-5 grid sm:grid-cols-2 gap-4 text-[13.5px]">
              {[
                { l: 'História da moléstia atual', v: p.anamnese.historia },
                { l: 'Cirurgias prévias', v: p.anamnese.cirurgias },
                { l: 'Medicamentos em uso', v: p.anamnese.medicamentos },
                { l: 'Alergias', v: p.anamnese.alergias },
              ].map((x) => (
                <div key={x.l} className="border border-line bg-deep px-3.5 py-3">
                  <p className="font-mono text-[10.5px] uppercase text-fog">{x.l}</p>
                  <p className="mt-1.5 leading-relaxed text-paper/90">{x.v || '—'}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {tab === 'evolucao' && clinico !== 'none' && (
          <div className="space-y-4">
            {canEdit && (
              <Card>
                <CardHead title="Nova evolução de sessão" sub="registro clínico — visível apenas a perfis clínicos" />
                <div className="p-5 space-y-3">
                  <Textarea value={evoText} onChange={(e) => setEvoText(e.target.value)} placeholder="Descreva a evolução: EVA, amplitude, conduta, resposta do paciente…" />
                  <div className="flex flex-wrap gap-2 items-center">
                    <Input value={anexoNome} onChange={(e) => setAnexoNome(e.target.value)} placeholder="Anexo (ex.: rx-lombar.pdf)" className="!w-64" />
                    <IconPaperclip className="w-4 h-4 text-fog" />
                    <Btn className="ml-auto" onClick={registrarEvolucao} disabled={!evoText.trim()}>Registrar evolução</Btn>
                  </div>
                </div>
              </Card>
            )}
            <Card>
              <CardHead title="Histórico de evoluções" sub="ordem cronológica reversa" />
              <ul className="divide-y divide-line/70">
                {evo.length === 0 && <li className="px-5 py-8 text-center font-mono text-[11.5px] text-fog">Nenhuma evolução registrada.</li>}
                {evo.map((e) => (
                  <li key={e.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="font-mono text-[11px] text-mint">{format(new Date(dayOf(e) + 'T12:00'), 'dd MMM yyyy', { locale: ptBR })}</span>
                      <span className="font-mono text-[10.5px] text-fog">por {userName(users, e.fisioId)}</span>
                      {e.anexos.map((a) => <Chip key={a} className="border-aqua/40 text-aqua"><IconPaperclip className="w-3 h-3" />{a}</Chip>)}
                    </div>
                    <p className="text-[13px] text-paper/90 leading-relaxed mt-2">{e.texto}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {tab === 'consent' && clinico !== 'none' && (
          <Card>
            <CardHead
              title="Termos de consentimento"
              sub="assinatura coletada na tela · hash do conteúdo + IP + timestamp (LGPD)"
              right={
                canEdit && cons.some((c) => !c.assinado) ? (
                  <Chip className="border-amber/45 text-amber">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber dot-live" />
                    {cons.filter((c) => !c.assinado).length} pendente(s)
                  </Chip>
                ) : undefined
              }
            />
            <ul className="divide-y divide-line/70">
              {cons.length === 0 && <li className="px-5 py-8 text-center font-mono text-[11.5px] text-fog">Nenhum termo vinculado.</li>}
              {cons.map((c) => (
                <li key={c.id} className="px-5 py-4 flex flex-wrap items-center gap-4">
                  <IconFile className={`w-5 h-5 shrink-0 ${c.assinado ? 'text-mint' : 'text-amber'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold">{c.nome} <span className="font-mono text-[10.5px] text-fog">{c.versao}</span></p>
                    {c.assinado ? (
                      <div className="mt-1.5 space-y-1">
                        <p className="font-mono text-[10.5px] text-fog">
                          assinado em {format(new Date((c.dataAssinatura ?? '') + 'T12:00'), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {' · '}hash <span className="text-mint">{c.hash}</span>
                          {' · '}IP <span className="text-aqua">{c.ip ?? 'registrado'}</span>
                        </p>
                        {c.assinaturaUrl && (
                          <img src={c.assinaturaUrl} alt={`Assinatura — ${c.nome}`} className="h-14 border border-line bg-deep px-2 inline-block" />
                        )}
                      </div>
                    ) : (
                      <p className="font-mono text-[10.5px] text-amber mt-0.5">pendente de assinatura do paciente</p>
                    )}
                  </div>
                  {c.assinado ? (
                    <Chip className="border-mint/40 text-mint">assinado ✓</Chip>
                  ) : (
                    <Btn disabled={!canEdit} onClick={() => setAssinando(c)}>Coletar assinatura</Btn>
                  )}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {assinando && <SignatureModal term={assinando} onClose={() => setAssinando(null)} />}

        {tab === 'sessoes' && (
          <Card>
            <CardHead title="Sessões do paciente" sub="histórico + futuras" />
            <ul className="divide-y divide-line/70">
              {sess.length === 0 && <li className="px-5 py-8 text-center font-mono text-[11.5px] text-fog">Nenhuma sessão agendada.</li>}
              {sess.map((s) => {
                const st = STATUS_META[s.status];
                return (
                  <li key={s.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: st.dot }} />
                    <span className="font-mono text-[11.5px] text-paper w-24">{format(new Date(dayOf(s) + 'T12:00'), 'dd/MM/yy', { locale: ptBR })}</span>
                    <span className="font-mono text-[11.5px] text-fog w-24">{s.inicio}–{s.fim}</span>
                    <span className="text-[12.5px] flex-1">{s.tipo}</span>
                    {s.serieId && <Chip className="border-amber/40 text-amber">série</Chip>}
                    <Chip className={st.chip}>{st.label}</Chip>
                    <span className="font-mono text-[11.5px] text-mint">{fmtBRL(s.valor)}</span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </Reveal>
    </div>
  );
}

/* --------------------- assinatura digital em canvas (F2) --------------------- */
function SignatureModal({ term, onClose }: { term: ConsentTerm; onClose: () => void }) {
  const { patients, signConsent, toast } = useApp();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [drawn, setDrawn] = useState(false);
  const p = patients.find((x) => x.id === term.pacienteId);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0d1b17';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.strokeStyle = '#4fd1a5';
    ctx.lineWidth = 2.4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = canvasRef.current!;
    const r = c.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height };
  };
  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.2, y + 0.2);
    ctx.stroke();
    setDrawn(true);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const up = () => { drawing.current = false; };
  const limpar = () => {
    const c = canvasRef.current!;
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#0d1b17';
    ctx.fillRect(0, 0, c.width, c.height);
    setDrawn(false);
  };
  const assinar = () => {
    const url = canvasRef.current!.toDataURL('image/png');
    signConsent(term.id, url);
    toast(`Termo assinado por ${p?.nome ?? 'paciente'} — hash, IP e timestamp registrados`);
    onClose();
  };

  return (
    <Modal open onClose={onClose} title={`Assinatura — ${term.nome}`} wide>
      <div className="grid md:grid-cols-2 gap-5">
        <div className="border border-line bg-deep p-4 overflow-y-auto max-h-[300px]">
          <p className="font-mono text-[10px] tracking-[0.16em] uppercase text-fog">{term.nome} · {term.versao}</p>
          <p className="text-[12.5px] text-paper/85 leading-relaxed mt-3">
            Declaro que fui informado(a) sobre os procedimentos fisioterapêuticos propostos, seus objetivos, riscos e
            alternativas, e que minhas dúvidas foram esclarecidas pelo profissional responsável. Autorizo o tratamento
            dos meus dados de saúde para fins terapêuticos, conforme a Lei nº 13.709/2018 (LGPD), ciente de que posso
            revogar este consentimento a qualquer momento.
          </p>
          <p className="text-[12.5px] text-paper/85 leading-relaxed mt-3">
            Estou ciente de que a ausência de resultados não caracteriza imperícia, e que o plano terapêutico poderá
            ser revisado conforme minha evolução clínica.
          </p>
          <p className="font-mono text-[10.5px] text-fog mt-4 border-t border-line pt-3">
            Paciente: <span className="text-paper">{p?.nome}</span> · documento {p ? maskCpf(p.cpf) : ''}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10.5px] tracking-[0.14em] uppercase text-fog mb-2">
            Assine no quadro abaixo <span className="text-fog/60">(mouse ou toque)</span>
          </p>
          <canvas
            ref={canvasRef}
            width={520}
            height={190}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerLeave={up}
            className="w-full border border-line2 bg-deep cursor-crosshair touch-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className={`font-mono text-[10.5px] ${drawn ? 'text-mint' : 'text-fog/60'}`}>
              {drawn ? 'assinatura capturada ✓' : 'aguardando assinatura…'}
            </span>
            <Btn variant="ghost" className="!px-3 !py-1 !text-[11.5px]" onClick={limpar}>Limpar</Btn>
          </div>
          <div className="flex gap-2 mt-4">
            <Btn className="flex-1" disabled={!drawn} onClick={assinar}>
              <IconFile className="w-4 h-4" /> Assinar e registrar
            </Btn>
            <Btn variant="ghost" onClick={onClose}>Cancelar</Btn>
          </div>
          <p className="font-mono text-[10px] text-fog/70 mt-3 leading-relaxed">
            O registro grava a imagem, o hash do conteúdo do termo, o IP e o timestamp — trilha completa de auditoria.
          </p>
        </div>
      </div>
    </Modal>
  );
}
