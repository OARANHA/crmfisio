import { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '../lib/supabaseClient';
import { useClinicalCapability } from '../hooks/useClinicalCapability';
import { resolveOwnActiveEncounter } from '../lib/activeClinicalEncounter';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { userName } from '../lib/displayNames';
import { useToast } from '../lib/toastContext';
import { useAgenda } from '../lib/agendaContext';
import { useClinicDirectory } from '../lib/clinicDirectoryContext';
import { useFinance } from '../lib/financeContext';
import { usePackages } from '../lib/packageContext';
import { useClinical } from '../lib/clinicalContext';
import { professionalIdOf } from '../lib/professionalReference';
import { STATUS_META, fmtBRL, type Appointment, type AppointmentStatus, type Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip, Empty, Field, Input, Select, Textarea } from '../lib/ui';
import { IconLock } from './icons';
import { ClinicalAssessmentRunner } from './ClinicalAssessmentRunner';
import { ClinicalAssessmentHistory } from './ClinicalAssessmentHistory';
import { ClinicalSummaryMvd } from './ClinicalSummaryMvd';

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
  professionalRegistration: string;
  createdAt: string;
};

type Tab = 'resumo' | 'avaliacao' | 'evolucoes' | 'sessoes' | 'documentos';
type AssessmentTab = 'atual' | 'historico' | 'legado';

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

export function ClinicalWorkspace({ patient, initialSessionId = null }: { patient: Patient; initialSessionId?: string | null }) {
  const { user } = useCurrentUserAccess();
  const { toast } = useToast();
  const { users } = useClinicDirectory();
  const { consents, signConsent, refreshClinical } = useClinical();
  const { appointments, refreshAgenda } = useAgenda();
  const { refreshFinance } = useFinance();
  const { refreshPackages } = usePackages();
  const timelineCapability = useClinicalCapability('clinical.timeline.read', user?.id);
  const attendCapability = useClinicalCapability('clinical.attend', user?.id);
  const evolutionCapability = useClinicalCapability('clinical.evolution.write', user?.id);
  const assessmentCapability = useClinicalCapability('clinical.assessment.apply', user?.id);
  const canReadTimeline = timelineCapability.allowed;
  const canAttend = attendCapability.allowed;
  const canWriteEvolution = evolutionCapability.allowed;
  const canApplyAssessment = assessmentCapability.allowed;
  const capabilityCheckError = [timelineCapability, attendCapability, evolutionCapability, assessmentCapability]
    .some((capability) => capability.error);
  const [tab, setTab] = useState<Tab>('resumo');
  const [assessmentTab, setAssessmentTab] = useState<AssessmentTab>('atual');
  const [evaluations, setEvaluations] = useState<ClinicalEvaluation[]>([]);
  const [evolutions, setEvolutions] = useState<ClinicalEvolution[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [transitioningSessionId, setTransitioningSessionId] = useState<string | null>(null);
  const [evaluationDraft, setEvaluationDraft] = useState(emptyEvaluation());
  const [evolutionText, setEvolutionText] = useState('');
  const [sessionId, setSessionId] = useState('');
  const focusedSessionRef = useRef<string | null>(null);

  const clinicalRead = canReadTimeline;
  const canCollectConsent = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'recep';
  const canTransitionSession = (session: Appointment) => Boolean(canAttend && user?.id && user.id === professionalIdOf(session));

  const sessions = useMemo(
    () => appointments
      .filter((a) => a.pacienteId === patient.id)
      .sort((a, b) => `${b.data}${b.inicio}`.localeCompare(`${a.data}${a.inicio}`)),
    [appointments, patient.id],
  );
  const activeSession = useMemo(
    () => resolveOwnActiveEncounter(appointments, patient.id, user?.id),
    [appointments, patient.id, user?.id],
  );

  const patientConsents = useMemo(
    () => consents.filter((c) => c.pacienteId === patient.id),
    [consents, patient.id],
  );

  useEffect(() => {
    focusedSessionRef.current = null;
    setSessionId('');
    setEvolutionText('');
  }, [patient.id, user?.id]);

  useEffect(() => {
    if (!initialSessionId || focusedSessionRef.current === initialSessionId) return;
    const session = sessions.find((item) => item.id === initialSessionId);
    if (!session) return;
    focusedSessionRef.current = initialSessionId;
    if (canAttend && user?.id === professionalIdOf(session) && session.status === 'em_atendimento' && activeSession?.id === session.id) {
      setSessionId(session.id);
      setTab('evolucoes');
      return;
    }
    setTab('sessoes');
  }, [initialSessionId, sessions, user?.id, canAttend, activeSession?.id]);

  useEffect(() => {
    if (activeSession) {
      setSessionId(activeSession.id);
      return;
    }
    setSessionId((current) => sessions.some((session) => (
      session.id === current
      && canAttend
      && Boolean(user?.id)
      && user?.id === professionalIdOf(session)
      && session.status === 'em_atendimento'
    )) ? current : '');
  }, [activeSession, sessions, canAttend, user?.id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!clinicalRead) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const [evalResult, evoResult] = await Promise.all([
        supabase.from('physiotherapy_evaluations').select('*').eq('patient_id', patient.id).order('data', { ascending: false }),
        supabase.from('physiotherapy_evolutions').select('*').eq('patient_id', patient.id).is('deleted_at', null).order('created_at', { ascending: false }),
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
        professionalRegistration: row.crefito ?? '',
        createdAt: row.created_at,
      }));
      setEvaluations(mappedEvaluations);
      setEvolutions(mappedEvolutions);
      const latest = mappedEvaluations[0];
      if (latest) setEvaluationDraft({ anamnese: latest.anamnese, objetivos: latest.objetivos, planoTerapeutico: latest.planoTerapeutico });
      setLoading(false);
    }
    void load();
    return () => { cancelled = true; };
  }, [patient.id, clinicalRead]);

  const latestEvaluation = evaluations[0] ?? null;
  const nextSession = [...sessions].filter((s) => !['finalizado', 'faltou', 'cancelado'].includes(s.status) && `${s.data}T${s.inicio}` >= format(new Date(), "yyyy-MM-dd'T'HH:mm")).sort((a, b) => `${a.data}${a.inicio}`.localeCompare(`${b.data}${b.inicio}`))[0];
  const lastSession = sessions.find((s) => s.status === 'finalizado');

  const saveEvaluation = async () => {
    if (!user || !canApplyAssessment) return;
    setSaving(true);
    const payload = { patient_id: patient.id, professional_id: user.id, anamnese: evaluationDraft.anamnese, objetivos: evaluationDraft.objetivos || null, plano_terapeutico: evaluationDraft.planoTerapeutico || null };
    const { data, error } = await supabase.from('physiotherapy_evaluations').insert(payload).select('*').single();
    setSaving(false);
    if (error || !data) { console.error('[MedicsPro] salvar avaliação:', error); toast('Não foi possível salvar a avaliação clínica.', 'warn'); return; }
    setEvaluations((prev) => [{ id: data.id, patientId: data.patient_id, professionalId: data.professional_id, data: data.data, anamnese: normalizeAnamnese(data.anamnese), objetivos: data.objetivos ?? '', planoTerapeutico: data.plano_terapeutico ?? '' }, ...prev]);
    toast('Avaliação clínica registrada no prontuário.');
  };

  const registerEvolution = async () => {
    if (!user || !canWriteEvolution || !sessionId || !evolutionText.trim()) return;
    const session = sessions.find((s) => s.id === sessionId);
    if (!session || professionalIdOf(session) !== user.id || session.status !== 'em_atendimento' || activeSession?.id !== session.id) return;
    setSaving(true);
    const { data, error } = await supabase.from('physiotherapy_evolutions').insert({ patient_id: patient.id, professional_id: user.id, session_id: session.id, texto: evolutionText.trim(), crefito: user.registro || null, anexos: [] }).select('*').single();
    setSaving(false);
    if (error || !data) { console.error('[MedicsPro] registrar evolução:', error); toast('Não foi possível registrar a evolução.', 'warn'); return; }
    setEvolutions((prev) => [{ id: data.id, patientId: data.patient_id, professionalId: data.professional_id, sessionId: data.session_id, texto: data.texto, professionalRegistration: data.crefito ?? '', createdAt: data.created_at }, ...prev]);
    setEvolutionText('');
    void refreshClinical().catch((refreshError) => console.error('[MedicsPro] atualizar contexto clínico após evolução:', refreshError));
    toast('Evolução vinculada ao atendimento.');
  };

  const transitionSession = async (session: Appointment, status: AppointmentStatus) => {
    if (!canTransitionSession(session) || transitioningSessionId) return false;
    setTransitioningSessionId(session.id);
    try {
      const { error } = await supabase.from('appointments').update({ status }).eq('id', session.id);
      if (error) {
        console.error('[MedicsPro] transição de atendimento:', error);
        const message = error.code === '23505' ? 'Já existe outro atendimento em andamento para este profissional ou paciente.' : 'O atendimento não pôde mudar de status. Verifique as regras clínicas e tente novamente.';
        toast(message, 'warn');
        return false;
      }
      try {
        const refreshes: Promise<void>[] = [refreshAgenda()];
        if (status === 'finalizado') refreshes.push(refreshFinance(), refreshPackages());
        await Promise.all(refreshes);
      } catch (refreshError) {
        console.error('[MedicsPro] recarregar atendimento após transição:', refreshError);
        toast('A transição foi registrada, mas os dados não puderam ser atualizados agora.', 'warn');
      }
      return true;
    } finally { setTransitioningSessionId(null); }
  };

  const startSession = async (session: Appointment) => {
    if (!canTransitionSession(session)) return;
    const accepted = await transitionSession(session, 'em_atendimento');
    if (!accepted) return;
    setSessionId(session.id); setTab('evolucoes'); toast('Atendimento iniciado. Registre a evolução antes de finalizar.', 'info');
  };

  const finishSession = async (session: Appointment) => {
    if (!canTransitionSession(session) || activeSession?.id !== session.id) return;
    const hasEvolution = evolutions.some((e) => e.sessionId === session.id);
    if (!hasEvolution) { toast('Registre a evolução deste atendimento antes de finalizar.', 'warn'); setSessionId(session.id); setTab('evolucoes'); return; }
    const accepted = await transitionSession(session, 'finalizado');
    if (!accepted) return;
    toast('Atendimento finalizado com prontuário vinculado.');
  };

  const tabs: { key: Tab; label: string; locked?: boolean }[] = [
    { key: 'resumo', label: 'Resumo clínico' },
    { key: 'avaliacao', label: 'Avaliações', locked: !clinicalRead },
    { key: 'evolucoes', label: `Evoluções (${evolutions.length})`, locked: !clinicalRead },
    { key: 'sessoes', label: `Atendimentos (${sessions.length})` },
    { key: 'documentos', label: `Documentos (${patientConsents.length})` },
  ];
  const assessmentTabs: { key: AssessmentTab; label: string; badge?: number }[] = [
    { key: 'atual', label: 'Atual' }, { key: 'historico', label: 'Histórico' }, { key: 'legado', label: 'Legado', badge: evaluations.length || undefined },
  ];

  return (
    <div className="space-y-4">
      {capabilityCheckError && <div className="rounded-xl border border-amber/25 bg-amber/[0.04] px-4 py-3 text-[12px] text-fog">Não foi possível verificar suas permissões clínicas.</div>}
      <div className="flex border-b border-line overflow-x-auto">{tabs.map((item) => <button key={item.key} disabled={item.locked} onClick={() => !item.locked && setTab(item.key)} className={`px-4 py-3 font-display font-semibold text-[13px] border-b-2 whitespace-nowrap transition-colors ${item.locked ? 'text-fog/35 cursor-not-allowed' : tab === item.key ? 'border-mint text-mint' : 'border-transparent text-fog hover:text-paper'}`}>{item.locked && <IconLock className="w-3 h-3 inline mr-1.5 -mt-0.5" />}{item.label}</button>)}</div>
      {tab === 'resumo' && <ClinicalSummaryMvd complaint={patient.queixaPrincipal || 'Sem queixa principal registrada'} cid={patient.cid10.join(' · ') || 'Sem CID-10 registrado'} objective={latestEvaluation?.objetivos || patient.anamnese.objetivo || 'Ainda não definido'} plan={latestEvaluation?.planoTerapeutico || 'Ainda não definido'} lastSession={lastSession ? `${format(new Date(`${lastSession.data}T12:00`), 'dd/MM/yyyy', { locale: ptBR })} · ${lastSession.tipo}` : 'Nenhum atendimento finalizado'} nextSession={nextSession ? `${format(new Date(`${nextSession.data}T12:00`), 'dd/MM/yyyy', { locale: ptBR })} às ${nextSession.inicio}` : 'Sem próximo atendimento'} hasNextSession={Boolean(nextSession)} readiness={[{ label: 'Avaliação', ok: Boolean(latestEvaluation) }, { label: 'Plano', ok: Boolean(latestEvaluation?.planoTerapeutico) }, { label: 'Agenda', ok: Boolean(nextSession) }, { label: 'Consentimento', ok: patientConsents.some((c) => c.assinado) }]} activeSessionTime={activeSession?.inicio} />}
      {tab === 'avaliacao' && clinicalRead && <div className="space-y-4"><div className="flex items-center gap-1 rounded-xl border border-line bg-panel p-1 overflow-x-auto">{assessmentTabs.map((item) => <button key={item.key} type="button" onClick={() => setAssessmentTab(item.key)} className={`rounded-lg px-3 py-2 text-[11.5px] font-semibold whitespace-nowrap transition-colors ${assessmentTab === item.key ? 'bg-mint text-on-accent' : 'text-fog hover:text-paper hover:bg-deep'}`}>{item.label}{item.badge ? ` (${item.badge})` : ''}</button>)}</div>{assessmentTab === 'atual' && <ClinicalAssessmentRunner patient={patient} />}{assessmentTab === 'historico' && <ClinicalAssessmentHistory patient={patient} />}{assessmentTab === 'legado' && <Card><CardHead title="Avaliações legadas" sub={canApplyAssessment ? 'compatibilidade temporária com o modelo anterior' : 'visualização do prontuário clínico anterior'} />{loading ? <div className="p-6 font-mono text-[12px] text-fog">Carregando prontuário anterior…</div> : <div className="p-5 space-y-5"><div className="border border-amber/30 bg-amber/[0.04] rounded-xl p-3 text-[11px] text-amber">Esta área existe apenas para manter compatibilidade com registros antigos. Para novos atendimentos, use a aba Atual com modelos versionados.</div>{evaluations.length > 0 && <div className="rounded-xl border border-line bg-deep p-3"><p className="font-display font-semibold text-[12.5px]">{evaluations.length} registro(s) no modelo anterior</p><p className="font-mono text-[10px] text-fog mt-1">Último registro: {format(new Date(evaluations[0].data), 'dd/MM/yyyy', { locale: ptBR })}</p></div>}<div className="grid sm:grid-cols-2 gap-4"><Field label="História da condição atual"><Textarea disabled={!canApplyAssessment} value={evaluationDraft.anamnese.historia} onChange={(e) => setEvaluationDraft((d) => ({ ...d, anamnese: { ...d.anamnese, historia: e.target.value } }))} /></Field><Field label="Exame físico / achados"><Textarea disabled={!canApplyAssessment} value={evaluationDraft.anamnese.exameFisico} onChange={(e) => setEvaluationDraft((d) => ({ ...d, anamnese: { ...d.anamnese, exameFisico: e.target.value } }))} /></Field><Field label="Cirurgias prévias"><Textarea disabled={!canApplyAssessment} value={evaluationDraft.anamnese.cirurgias} onChange={(e) => setEvaluationDraft((d) => ({ ...d, anamnese: { ...d.anamnese, cirurgias: e.target.value } }))} /></Field><Field label="Medicamentos em uso"><Textarea disabled={!canApplyAssessment} value={evaluationDraft.anamnese.medicamentos} onChange={(e) => setEvaluationDraft((d) => ({ ...d, anamnese: { ...d.anamnese, medicamentos: e.target.value } }))} /></Field><Field label="Alergias"><Input disabled={!canApplyAssessment} value={evaluationDraft.anamnese.alergias} onChange={(e) => setEvaluationDraft((d) => ({ ...d, anamnese: { ...d.anamnese, alergias: e.target.value } }))} /></Field><Field label="Dor / escala (0–10)"><Input disabled={!canApplyAssessment} value={evaluationDraft.anamnese.eva} onChange={(e) => setEvaluationDraft((d) => ({ ...d, anamnese: { ...d.anamnese, eva: e.target.value } }))} placeholder="Ex.: 6/10" /></Field></div><Field label="Objetivos terapêuticos"><Textarea disabled={!canApplyAssessment} value={evaluationDraft.objetivos} onChange={(e) => setEvaluationDraft((d) => ({ ...d, objetivos: e.target.value }))} placeholder="Resultados clínicos esperados e critérios de sucesso." /></Field><Field label="Plano terapêutico"><Textarea disabled={!canApplyAssessment} value={evaluationDraft.planoTerapeutico} onChange={(e) => setEvaluationDraft((d) => ({ ...d, planoTerapeutico: e.target.value }))} placeholder="Frequência, condutas, progressão, reavaliação e critérios de alta." /></Field><Field label="Observações clínicas"><Textarea disabled={!canApplyAssessment} value={evaluationDraft.anamnese.observacoes} onChange={(e) => setEvaluationDraft((d) => ({ ...d, anamnese: { ...d.anamnese, observacoes: e.target.value } }))} /></Field><div className="flex items-center justify-between border-t border-line pt-4"><p className="font-mono text-[10.5px] text-fog">Cada salvamento continua criando um novo registro no modelo anterior.</p>{canApplyAssessment && <Btn variant="ghost" onClick={saveEvaluation} disabled={saving}>{saving ? 'Salvando…' : 'Registrar no modelo anterior'}</Btn>}</div></div>}</Card>}</div>}
      {tab === 'evolucoes' && clinicalRead && <div className="space-y-4">{canWriteEvolution && <Card><CardHead title="Evolução do atendimento" sub="registro clínico vinculado ao atendimento — base segura para sumarização por IA" /><div className="p-5 space-y-4"><Field label="Atendimento">{activeSession ? <div className="rounded-xl border border-mint/25 bg-mint/[0.04] px-3 py-2.5 text-[12px] text-paper">{format(new Date(`${activeSession.data}T12:00`), 'dd/MM/yyyy')} · {activeSession.inicio} · {activeSession.tipo} · atendimento atual</div> : <Select value={sessionId} onChange={(e) => setSessionId(e.target.value)}><option value="">Nenhum atendimento próprio em andamento</option></Select>}</Field><Field label="Evolução clínica"><Textarea value={evolutionText} onChange={(e) => setEvolutionText(e.target.value)} placeholder="Resposta ao tratamento, achados, conduta realizada, intercorrências, orientação e plano para o próximo atendimento." /></Field><div className="flex justify-end"><Btn onClick={registerEvolution} disabled={saving || !activeSession || sessionId !== activeSession.id || !evolutionText.trim()}>{saving ? 'Salvando…' : 'Registrar evolução'}</Btn></div></div></Card>}<Card><CardHead title="Linha do tempo clínica" sub="evoluções em ordem cronológica reversa" />{evolutions.length === 0 ? <Empty title="Nenhuma evolução registrada" sub="A evolução nasce de um atendimento e fica ligada ao evento que a originou." /> : <ul className="divide-y divide-line/70">{evolutions.map((e) => { const session = sessions.find((s) => s.id === e.sessionId); return <li key={e.id} className="px-5 py-4"><div className="flex flex-wrap items-center gap-2.5"><span className="font-mono text-[11px] text-mint">{format(new Date(e.createdAt), "dd MMM yyyy '·' HH:mm", { locale: ptBR })}</span><span className="font-mono text-[10.5px] text-fog">por {userName(users, e.professionalId)}</span>{e.professionalRegistration && <Chip className="border-line text-fog">{e.professionalRegistration}</Chip>}{session && <Chip className="border-aqua/40 text-aqua">atendimento {session.data} · {session.inicio}</Chip>}</div><p className="text-[13px] text-paper/90 leading-relaxed mt-2 whitespace-pre-wrap">{e.texto}</p></li>; })}</ul>}</Card></div>}
      {tab === 'sessoes' && <Card><CardHead title="Jornada de atendimentos" sub="agenda, atendimento e prontuário no mesmo fluxo" />{sessions.length === 0 ? <Empty title="Nenhum atendimento agendado" sub="Agende a primeira consulta ou avaliação para iniciar a jornada clínica." /> : <ul className="divide-y divide-line/70">{sessions.map((session) => { const meta = STATUS_META[session.status]; const hasEvolution = evolutions.some((e) => e.sessionId === session.id); const transitioning = transitioningSessionId === session.id; return <li key={session.id} className="px-5 py-4 flex flex-wrap items-center gap-3"><span className="w-2 h-2 rounded-full" style={{ background: meta.dot }} /><div className="min-w-[150px]"><p className="font-mono text-[11.5px] text-paper">{format(new Date(`${session.data}T12:00`), 'dd/MM/yyyy')} · {session.inicio}</p><p className="text-[12px] text-fog mt-0.5">{session.tipo}</p></div><Chip className={meta.chip}>{meta.label}</Chip>{hasEvolution && <Chip className="border-mint/40 text-mint">prontuário ✓</Chip>}<span className="font-mono text-[11.5px] text-mint ml-auto">{fmtBRL(session.valor)}</span>{canTransitionSession(session) && ['agendado', 'confirmado'].includes(session.status) && <Btn variant="subtle" disabled={transitioningSessionId !== null} onClick={() => void startSession(session)}>{transitioning ? 'Iniciando…' : 'Iniciar atendimento'}</Btn>}{canTransitionSession(session) && activeSession?.id === session.id && <Btn disabled={transitioningSessionId !== null} onClick={() => void finishSession(session)}>{transitioning ? 'Finalizando…' : 'Finalizar atendimento'}</Btn>}</li>; })}</ul>}</Card>}
      {tab === 'documentos' && <Card><CardHead title="Documentos & consentimentos" sub="operacional separado do conteúdo clínico: recepção pode coletar sem abrir anamnese" />{patientConsents.length === 0 ? <Empty title="Nenhum documento vinculado" sub="Os próximos fluxos criarão termos por clínica e assinatura digital versionada." /> : <ul className="divide-y divide-line/70">{patientConsents.map((term) => <li key={term.id} className="px-5 py-4 flex flex-wrap items-center gap-3"><div className="flex-1"><p className="font-display font-semibold text-[13.5px]">{term.nome}</p><p className="font-mono text-[10.5px] text-fog mt-0.5">versão {term.versao}{term.dataAssinatura ? ` · ${format(new Date(term.dataAssinatura), 'dd/MM/yyyy HH:mm')}` : ''}</p></div><Chip className={term.assinado ? 'border-mint/40 text-mint' : 'border-amber/40 text-amber'}>{term.assinado ? 'assinado ✓' : 'pendente'}</Chip>{!term.assinado && canCollectConsent && <Btn variant="subtle" onClick={() => void signConsent(term.id)}>Coletar aceite</Btn>}</li>)}</ul>}</Card>}
    </div>
  );
}