import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getNexusScaleDefinition } from '../lib/nexus/scaleCatalog';
import { resolveSelfAssessment, submitSelfAssessment, type ResolvedSelfAssessment } from '../lib/nexus/selfAssessment';

export function NexusPublicSelfAssessmentPage() {
  const { token = '' } = useParams();
  const [invite, setInvite] = useState<ResolvedSelfAssessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [invalid, setInvalid] = useState(false);
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    resolveSelfAssessment(token)
      .then((resolved) => { if (!cancelled) { setInvite(resolved); setInvalid(!resolved); } })
      .catch(() => { if (!cancelled) setInvalid(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [token]);

  const definition = useMemo(() => getNexusScaleDefinition(invite?.scaleKey), [invite?.scaleKey]);
  const question = definition?.questions[current];
  const complete = Boolean(definition && definition.questions.every((q) => selected[q.id] !== undefined));

  if (loading) return <Shell><p className="text-sm text-slate-500">Carregando questionário…</p></Shell>;
  if (invalid || !invite || !definition || invite.ruleVersion !== definition.ruleVersion) return <Shell><h1 className="text-lg font-bold text-slate-900">Link indisponível</h1><p className="mt-2 text-sm text-slate-600">Este convite expirou, foi revogado ou a versão do instrumento não está disponível.</p></Shell>;
  if (submitted) return <Shell><h1 className="text-xl font-bold text-slate-900">Respostas enviadas</h1><p className="mt-2 text-sm leading-relaxed text-slate-600">Obrigado. Suas respostas foram recebidas pela equipe responsável e serão processadas com a regra clínica validada do instrumento.</p><p className="mt-3 text-xs text-slate-500">Nenhum resultado clínico é calculado ou exibido neste dispositivo.</p></Shell>;
  if (!question) return null;

  const choose = (optionIndex: number) => {
    const option = question.options[optionIndex];
    setAnswers((state) => ({ ...state, [question.id]: option.value }));
    setSelected((state) => ({ ...state, [question.id]: optionIndex }));
    if (current < definition.questions.length - 1) setCurrent((value) => value + 1);
  };

  const submit = async () => {
    if (!complete) return;
    setBusy(true);
    try {
      const selectedOptions = definition.questions.map((q) => {
        const optionIndex = selected[q.id];
        const option = q.options[optionIndex];
        return { questionId: q.id, optionIndex, label: option.label, value: option.value };
      });
      const ok = await submitSelfAssessment(token, {
        scaleKey: definition.toolKey,
        ruleVersion: definition.ruleVersion,
        answers,
        selectedOptions,
        submittedClientAt: new Date().toISOString(),
      });
      if (!ok) throw new Error('Convite indisponível');
      setSubmitted(true);
    } catch {
      setInvalid(true);
    } finally { setBusy(false); }
  };

  const progress = Math.round(((current + 1) / definition.questions.length) * 100);
  return <Shell>
    <div className="mb-5"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-teal-700">Nexus Clinical Engine · Autoaplicação</p><h1 className="mt-1 text-xl font-bold text-slate-900">{definition.acronym}</h1><p className="mt-1 text-xs leading-relaxed text-slate-600">{definition.instructions}</p></div>
    <div className="mb-5"><div className="flex justify-between text-[11px] font-medium text-slate-500"><span>Pergunta {current + 1} de {definition.questions.length}</span><span>{progress}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full bg-teal-600" style={{ width: `${progress}%` }} /></div></div>
    <h2 className="text-base font-semibold leading-snug text-slate-900">{question.text}</h2>{question.instruction && <p className="mt-2 text-xs italic text-slate-500">{question.instruction}</p>}
    <div className="mt-5 space-y-2">{question.options.map((option, optionIndex) => <button key={`${question.id}-${optionIndex}`} type="button" onClick={() => choose(optionIndex)} className={`w-full rounded-lg border p-3 text-left text-sm ${selected[question.id] === optionIndex ? 'border-teal-600 bg-teal-50 font-semibold text-teal-900' : 'border-slate-200 bg-white text-slate-800'}`}>{option.label}</button>)}</div>
    <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4"><button type="button" disabled={current === 0} onClick={() => setCurrent((value) => Math.max(0, value - 1))} className="text-xs font-semibold text-slate-600 disabled:opacity-30">← Anterior</button>{current === definition.questions.length - 1 && <button type="button" disabled={!complete || busy} onClick={() => void submit()} className="rounded-lg bg-teal-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-40">{busy ? 'Enviando…' : 'Enviar respostas'}</button>}</div>
    <p className="mt-5 text-[10px] leading-relaxed text-slate-400">Este link não dá acesso ao prontuário. O resultado clínico será processado pela plataforma e revisado pela equipe responsável.</p>
  </Shell>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return <main className="min-h-screen bg-slate-50 px-4 py-8"><section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">{children}</section></main>;
}
