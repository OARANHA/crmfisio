import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabaseClient';
import { useApp, userName } from '../lib/store';
import { STATUS_META, dayOf, fmtBRL, type Appointment, type Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip, Empty, Field, Input, Select, Textarea } from '../lib/ui';
import { IconLock } from './icons';
import { isClinicManager } from '../lib/permissions';
import { ClinicalAssessmentRunner } from './ClinicalAssessmentRunner';

type ClinicalEvaluation = {
  id: string;
  patientId: string;
  professionalId: string;
  data: string;
  anamnese: {
    historia: string;
    cirurgias: string;
    medicamentos: string;
    alergias: string;
    exameFisico: string;
    eva: string;
    observacoes: string;
  };
  objetivos: string;
  planoTerapeutico: string;
};

type ClinicalEvolution = {
  id: string;
  patientId: string;
  professionalId: string;
  sessionId: string | null;
  texto: string;
  crefito: string;
  createdAt: string;
};

type Tab = 'resumo' | 'avaliacao' | 'evolucoes' | 'sessoes' | 'documentos';

const emptyEvaluation = (): Omit<ClinicalEvaluation, 'id' | 'patientId' | 'professionalId' | 'data'> => ({
  anamnese: {
    historia: '',
    cirurgias: '',
    medicamentos: '',
    alergias: '',
    exameFisico: '',
    eva: '',
    observacoes: '',
  },
  objetivos: '',
  planoTerapeutico: '',
});

const normalizeAnamnese = (value: unknown): ClinicalEvaluation['anamnese'] => {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return {
    historia: String(raw.historia ?? raw.hma ?? ''),
    cirurgias: String(raw.cirurgias ?? ''),
    medicamentos: String(raw.medicamentos ?? ''),
    alergias: String(raw.alergias ?? ''),
    exameFisico: String(raw.exameFisico ?? raw.exame_fisico ?? ''),
    eva: String(raw.eva ?? ''),
    observacoes: String(raw.observacoes ?? ''),
  };
};

export function ClinicalWorkspace({ patient }: { patient: Patient }) {
  const { user, users, appointments, consents, setAppointmentStatus, signConsent, toast } = useApp();
  const [tab, setTab] = useState<Tab>('resumo');
  const [evaluations, setEvaluations] = useState<ClinicalEvaluation[]>([]);
  const [evolutions, setEvolutions] = useState<ClinicalEvolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [evaluationDraft, setEvaluationDraft] = useState(emptyEvaluation());
  const [evolutionText, setEvolutionText] = useState('');
  const [sessionId, setSessionId] = useState('');

  const clinicalWrite = user?.role === 'fisio';
  const clinicalRead = user?.role === 'fisio' || isClinicManager(user?.role);
  const documentWrite = user?.role === 'fisio' || isClinicManager(user?.role) || user?.role === 'recep';

  const sessions = useMemo(
    () => appointments
      .filter((a) => a.pacienteId === patient.id)
      .sort((a, b) => `${b.data}${b.inicio}`.localeCompare(`${a.data}${a.inicio}`)),
    [appointments, patient.id],
  );

  const patientConsents = useMemo(
    () => consents.filter((c) => c.pacienteId === patient.id),
    [consents, patient.id],
  );

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!clinicalRead) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [evalResult, evoResult] = await Promise.all([
        supabase
          .from('physiotherapy_evaluations')
          .select('*')
          .eq('patient_id', patient.id)
          .order('data', { ascending: false }),
        supabase
          .from('physiotherapy_evolutions')
          .select('*')
          .eq('patient_id', patient.id)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (evalResult.error) console.error('[MedicsPro] avaliações:', evalResult.error);
      if (evoResult.error) console.error('[MedicsPro] evoluções:', evoResult.error);
      const mappedEvaluations = (evalResult.data ?? []).map((row) => ({
        id: row.id,
        patientId: row.patient_id,
        professionalId: row.professional_id,
        data: row.data,
        anamnese: normalizeAnamnese(row.anamnese),
        objetivos: row.objetivos ?? '',
        planoTerapeutico: row.plano_terapeutico ?? '',
      }));
      const mappedEvolutions = (evoResult.data ?? []).map((row) => ({
        id: row.id,
        patientId: row.patient_id,
        professionalId: row.professional_id,
        sessionId: row.session_id,
        texto: row.texto,
        crefito: row.crefito ?? '',
        createdAt: row.created_at,
      }));
      setEvaluations(mappedEvaluations);
      setEvolutions(mappedEvolutions);
      const latest = mappedEvaluations[0];
      if (latest) {
        setEvaluationDraft({ anamnese: latest.anamnese, objetivos: latest.objetivos, planoTerapeutico: latest.planoTerapeutico });
      }
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [patient.id, clinicalRead]);

  const latestEvaluation = evaluations[0] ?? null;
  const nextSession = [...sessions]
    .filter((s) => !['finalizado', 'faltou', 'cancelado'].includes(s.status) && `${s.data}T${s.inicio}` >= format(new Date(), "yyyy-MM-dd'T'HH:mm"))
    .sort((a, b) => `${a.data}${a.inicio}`.localeCompare(`${b.data}${b.inicio}`))[0];
  const lastSession = sessions.find((s) => s.status === 'finalizado');
  const activeSession = sessions.find((s) => s.status === 'em_atendimento');

  const saveEvaluation = async () => {
    if (!user || !clinicalWrite) return;
    setSaving(true);
    const payload = {
      patient_id: patient.id,
      professional_id: user.id,
      anamnese: evaluationDraft.anamnese,
      objetivos: evaluationDraft.objetivos || null,
      plano_terapeutico: evaluationDraft.planoTerapeutico || null,
    };
    const { data, error } = await supabase
      .from('physiotherapy_evaluations')
      .insert(payload)
      .select('*')
      .single();
    setSaving(false);
    if (error || !data) {
      console.error('[MedicsPro] salvar avaliação:', error);
      toast('Não foi possível salvar a avaliação clínica.', 'warn');
      return;
    }
    setEvaluations((prev) => [{
      id: data.id,
      patientId: data.patient_id,
      professionalId: data.professional_id,
      data: data.data,
      anamnese: normalizeAnamnese(data.anamnese),
      objetivos: data.objetivos ?? '',
      planoTerapeutico: data.plano_terapeutico ?? '',
    }, ...prev]);
    toast('Avaliação clínica registrada no prontuário.');
  };

  const registerEvolution = async () => {
    if (!user || !clinicalWrite || !sessionId || !evolutionText.trim()) return;
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return;
    setSaving(true);
    const { data, error } = await supabase
      .from('physiotherapy_evolutions')
      .insert({
        patient_id: patient.id,
        professional_id: user.id,
        session_id: session.id,
        texto: evolutionText.trim(),
        crefito: user.registro || null,
        anexos: [],
      })
      .select('*')
      .single();
    setSaving(false);
    if (error || !data) {
      console.error('[MedicsPro] registrar evolução:', error);
      toast('Não foi possível registrar a evolução.', 'warn');
      return;
    }
    setEvolutions((prev) => [{
      id: data.id,
      patientId: data.patient_id,
      professionalId: data.professional_id,
      sessionId: data.session_id,
      texto: data.texto,
      crefito: data.crefito ?? '',
      createdAt: data.created_at,
    }, ...prev]);
    setEvolutionText('');
    toast('Evolução vinculada à sessão.');
  };

  const startSession = (session: Appointment) => {
    if (!clinicalWrite) return;
    setAppointmentStatus(session.id, 'em_atendimento');
    setSessionId(session.id);
    setTab('evolucoes');
    toast('Atendimento iniciado. Registre a evolução antes de finalizar.', 'info');
  };

  const finishSession = (session: Appointment) => {
    if (!clinicalWrite) return;
    const hasEvolution = evolutions.some((e) => e.sessionId === session.id);
    if (!hasEvolution) {
      toast('Registre a evolução desta sessão antes de finalizar.', 'warn');
      setSessionId(session.id);
      setTab('evolucoes');
      return;
    }
    setAppointmentStatus(session.id, 'finalizado');
    toast('Sessão finalizada com prontuário vinculado.');
  };

  const tabs: { key: Tab; label: string; locked?: boolean }[] = [
    { key: 'resumo', label: 'Resumo clínico' },
    { key: 'avaliacao', label: `Avaliações${evaluations.length ? ` (${evaluations.length} legado)` : ''}`, locked: !clinicalRead },
    { key: 'evolucoes', label: `Evoluções (${evolutions.length})`, locked: !clinicalRead },
    { key: 'sessoes', label: `Sessões (${sessions.length})` },
    { key: 'documentos', label: `Documentos (${patientConsents.length})` },
  ];

  return (
    <div className="space-y-4">
      <div className="flex border border-line bg-panel overflow-x-auto">
        {tabs.map((item) => (
          <button
            key={item.key}
            disabled={item.locked}
            onClick={() => !item.locked && setTab(item.key)}
            className={`px-4 py-3 font-display font-semibold text-[13px] border-b-2 whitespace-nowrap transition-colors ${
              item.locked ? 'text-fog/35 cursor-not-allowed' : tab === item.key ? 'border-mint text-mint bg-mint/5' : 'border-transparent text-fog hover:text-paper'
            }`}
          >
            {item.locked && <IconLock className="w-3 h-3 inline mr-1.5 -mt-0.5" />}
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'resumo' && (
        <div className="grid lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2">
            <CardHead title="Visão clínica" sub="o que o profissional precisa saber antes de atender" />
            <div className="p-5 grid sm:grid-cols-2 gap-4 text-[13.5px]">
              <Info label="Queixa principal" value={patient.queixaPrincipal || '—'} />
              <Info label="CID-10" value={patient.cid10.join(' · ') || '—'} />
              <Info label="Objetivo terapêutico" value={latestEvaluation?.objetivos || patient.anamnese.objetivo || 'Ainda não definido'} />
              <Info label="Plano terapêutico" value={latestEvaluation?.planoTerapeutico || 'Ainda não definido'} />
              <Info label="Última sessão" value={lastSession ? `${format(new Date(`${lastSession.data}T12:00`), 'dd/MM/yyyy', { locale: ptBR })} · ${lastSession.tipo}` : 'Nenhuma sessão finalizada'} />
              <Info label="Próxima sessão" value={nextSession ? `${format(new Date(`${nextSession.data}T12:00`), 'dd/MM/yyyy', { locale: ptBR })} às ${nextSession.inicio}` : 'Sem próxima sessão'} alert={!nextSession} />
            </div>
          </Card>
          <Card>
            <CardHead title="Prontidão do tratamento" sub="sinais operacionais" />
            <div className="p-5 space-y-3">
              <StatusLine label="Avaliação clínica" ok={Boolean(latestEvaluation)} />
              <StatusLine label="Plano terapêutico" ok={Boolean(latestEvaluation?.planoTerapeutico)} />
              <StatusLine label="Próxima sessão" ok={Boolean(nextSession)} />
              <StatusLine label="Consentimento" ok={patientConsents.some((c) => c.assinado)} />
              {activeSession && <div className="border border-amber/40 bg-amber/5 p-3 text-[12px] text-amber">Atendimento em andamento às {activeSession.inicio}. Finalize somente após registrar a evolução.</div>}
            </div>
          </Card>
        </div>
      )}

      {tab === 'avaliacao' && clinicalRead && (
        <div className="space-y-4">
          <ClinicalAssessmentRunner patient={patient} />

          <Card>
            <CardHead title="Avaliação anterior · compatibilidade" sub={clinicalWrite ? 'fluxo legado preservado durante a transição para modelos versionados' : 'visualização do histórico clínico anterior'} />
            {loading ? <div className="p-6 font-mono text-[12px] text-fog">Carregando prontuário anterior…</div> : (
              <div className="p-5 space-y-5">
                <div className="border border-amber/30 bg-amber/[0.04] rounded-xl p-3 text-[11px] text-amber">
                  Este formulário permanece disponível temporariamente para não interromper o prontuário existente. Novas avaliações devem preferir os modelos estruturados acima após a migration do Assessment Engine ser validada em staging.
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <Field label="História da condição atual"><Textarea disabled={!clinicalWrite} value={evaluationDraft.anamnese.historia} onChange={(e) => setEvaluationDraft((d) => ({ ...d, anamnese: { ...d.anamnese, historia: e.target.value } }))} /></Field>
                  <Field label="Exame físico / achados"><Textarea disabled={!clinicalWrite} value={evaluationDraft.anamnese.exameFisico} onChange={(e) => setEvaluationDraft((d) => ({ ...d, anamnese: { ...d.anamnese, exameFisico: e.target.value } }))} /></Field>
                  <Field label="Cirurgias prévias"><Textarea disabled={!clinicalWrite} value={evaluationDraft.anamnese.cirurgias} onChange={(e) => setEvaluationDraft((d) => ({ ...d, anamnese: { ...d.anamnese, cirurgias: e.target.value } }))} /></Field>
                  <Field label="Medicamentos em uso"><Textarea disabled={!clinicalWrite} value={evaluationDraft.anamnese.medicamentos} onChange={(e) => setEvaluationDraft((d) => ({ ...d, anamnese: { ...d.anamnese, medicamentos: e.target.value } }))} /></Field>
                  <Field label="Alergias"><Input disabled={!clinicalWrite} value={evaluationDraft.anamnese.alergias} onChange={(e) => setEvaluationDraft((d) => ({ ...d, anamnese: { ...d.anamnese, alergias: e.target.value } }))} /></Field>
                  <Field label="Dor / EVA (0–10)"><Input disabled={!clinicalWrite} value={evaluationDraft.anamnese.eva} onChange={(e) => setEvaluationDraft((d) => ({ ...d, anamnese: { ...d.anamnese, eva: e.target.value } }))} placeholder="Ex.: 6/10" /></Field>
                </div>
                <Field label="Objetivos terapêuticos"><Textarea disabled={!clinicalWrite} value={evaluationDraft.objetivos} onChange={(e) => setEvaluationDraft((d) => ({ ...d, objetivos: e.target.value }))} placeholder="Resultados clínicos esperados e critérios de sucesso." /></Field>
                <Field label="Plano terapêutico"><Textarea disabled={!clinicalWrite} value={evaluationDraft.planoTerapeutico} onChange={(e) => setEvaluationDraft((d) => ({ ...d, planoTerapeutico: e.target.value }))} placeholder="Frequência, condutas, progressão, reavaliação e critérios de alta." /></Field>
                <Field label="Observações clínicas"><Textarea disabled={!clinicalWrite} value={evaluationDraft.anamnese.observacoes} onChange={(e) => setEvaluationDraft((d) => ({ ...d, anamnese: { ...d.anamnese, observacoes: e.target.value } }))} /></Field>
                <div className="flex items-center justify-between border-t border-line pt-4">
                  <p className="font-mono text-[10.5px] text-fog">Compatibilidade: cada salvamento continua criando uma nova avaliação no modelo anterior.</p>
                  {clinicalWrite && <Btn variant="ghost" onClick={saveEvaluation} disabled={saving}>{saving ? 'Salvando…' : 'Registrar no modelo anterior'}</Btn>}
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === 'evolucoes' && clinicalRead && (
        <div className="space-y-4">
          {clinicalWrite && (
            <Card>
              <CardHead title="Evolução da sessão" sub="registro clínico vinculado ao atendimento — base segura para sumarização por IA" />
              <div className="p-5 space-y-4">
                <Field label="Sessão atendida">
                  <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)}>
                    <option value="">Selecione a sessão…</option>
                    {sessions.filter((s) => !['faltou', 'cancelado'].includes(s.status)).map((s) => (
                      <option key={s.id} value={s.id}>{format(new Date(`${s.data}T12:00`), 'dd/MM/yyyy')} · {s.inicio} · {s.tipo} · {STATUS_META[s.status].label}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Evolução clínica"><Textarea value={evolutionText} onChange={(e) => setEvolutionText(e.target.value)} placeholder="Resposta ao tratamento, achados, conduta realizada, intercorrências, orientação e plano para a próxima sessão." /></Field>
                <div className="flex justify-end"><Btn onClick={registerEvolution} disabled={saving || !sessionId || !evolutionText.trim()}>{saving ? 'Salvando…' : 'Registrar evolução'}</Btn></div>
              </div>
            </Card>
          )}
          <Card>
            <CardHead title="Linha do tempo clínica" sub="evoluções em ordem cronológica reversa" />
            {evolutions.length === 0 ? <Empty title="Nenhuma evolução registrada" sub="A evolução nasce de uma sessão e fica ligada ao atendimento que a originou." /> : (
              <ul className="divide-y divide-line/70">
                {evolutions.map((e) => {
                  const session = sessions.find((s) => s.id === e.sessionId);
                  return (
                    <li key={e.id} className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <span className="font-mono text-[11px] text-mint">{format(new Date(e.createdAt), "dd MMM yyyy '·' HH:mm", { locale: ptBR })}</span>
                        <span className="font-mono text-[10.5px] text-fog">por {userName(users, e.professionalId)}</span>
                        {e.crefito && <Chip className="border-line text-fog">{e.crefito}</Chip>}
                        {session && <Chip className="border-aqua/40 text-aqua">sessão {session.data} · {session.inicio}</Chip>}
                      </div>
                      <p className="text-[13px] text-paper/90 leading-relaxed mt-2 whitespace-pre-wrap">{e.texto}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>
      )}

      {tab === 'sessoes' && (
        <Card>
          <CardHead title="Jornada de sessões" sub="agenda, atendimento e prontuário no mesmo fluxo" />
          {sessions.length === 0 ? <Empty title="Nenhuma sessão agendada" sub="Agende a primeira avaliação para iniciar a jornada clínica." /> : (
            <ul className="divide-y divide-line/70">
              {sessions.map((session) => {
                const meta = STATUS_META[session.status];
                const hasEvolution = evolutions.some((e) => e.sessionId === session.id);
                return (
                  <li key={session.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                    <span className="w-2 h-2 rounded-full" style={{ background: meta.dot }} />
                    <div className="min-w-[150px]">
                      <p className="font-mono text-[11.5px] text-paper">{format(new Date(`${session.data}T12:00`), 'dd/MM/yyyy')} · {session.inicio}</p>
                      <p className="text-[12px] text-fog mt-0.5">{session.tipo}</p>
                    </div>
                    <Chip className={meta.chip}>{meta.label}</Chip>
                    {hasEvolution && <Chip className="border-mint/40 text-mint">prontuário ✓</Chip>}
                    <span className="font-mono text-[11.5px] text-mint ml-auto">{fmtBRL(session.valor)}</span>
                    {clinicalWrite && ['agendado', 'confirmado'].includes(session.status) && <Btn variant="subtle" onClick={() => startSession(session)}>Iniciar atendimento</Btn>}
                    {clinicalWrite && session.status === 'em_atendimento' && <Btn onClick={() => finishSession(session)}>Finalizar sessão</Btn>}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === 'documentos' && (
        <Card>
          <CardHead title="Documentos & consentimentos" sub="operacional separado do conteúdo clínico: recepção pode coletar sem abrir anamnese" />
          {patientConsents.length === 0 ? <Empty title="Nenhum documento vinculado" sub="Os próximos fluxos criarão termos por clínica e assinatura digital versionada." /> : (
            <ul className="divide-y divide-line/70">
              {patientConsents.map((term) => (
                <li key={term.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1">
                    <p className="font-display font-semibold text-[13.5px]">{term.nome}</p>
                    <p className="font-mono text-[10.5px] text-fog mt-0.5">versão {term.versao}{term.dataAssinatura ? ` · ${format(new Date(term.dataAssinatura), 'dd/MM/yyyy HH:mm')}` : ''}</p>
                  </div>
                  <Chip className={term.assinado ? 'border-mint/40 text-mint' : 'border-amber/40 text-amber'}>{term.assinado ? 'assinado ✓' : 'pendente'}</Chip>
                  {!term.assinado && documentWrite && <Btn variant="subtle" onClick={() => signConsent(term.id)}>Coletar aceite</Btn>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}

function Info({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="border border-line bg-deep px-4 py-3">
      <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-fog">{label}</p>
      <p className={`mt-1.5 leading-relaxed ${alert ? 'text-amber' : 'text-paper/90'}`}>{value}</p>
    </div>
  );
}

function StatusLine({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between border-b border-line/60 pb-2 last:border-0">
      <span className="text-[12.5px] text-paper/90">{label}</span>
      <span className={`font-mono text-[10.5px] ${ok ? 'text-mint' : 'text-amber'}`}>{ok ? 'pronto ✓' : 'pendente'}</span>
    </div>
  );
}
