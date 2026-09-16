import { useEffect, useMemo, useState } from 'react';
import {
  CLINICIAN_ASSISTED_INSTRUMENT_KEYS,
  loadClinicianAssistedInstrumentAvailability,
  submitClinicianAssistedInstrument,
  type ClinicianAssistedAdministration,
  type ClinicianAssistedInstrumentAvailability,
  type ClinicianAssistedInstrumentKey,
} from '../lib/clinicalInstrumentClinicianAssisted';
import { getClinicianAssistedInstrumentDefinition } from '../lib/nexus/clinicianAssistedInstrumentCatalog';
import { Chip } from '../lib/ui';

type ApplySession = {
  instrumentKey: ClinicianAssistedInstrumentKey;
  requestId: string;
};

const EMPTY_AVAILABILITY: ClinicianAssistedInstrumentAvailability = { phq9: false, gad7: false, phq15: false, cage: false, pcl5: false };

export function ClinicianAssistedInstrumentApplyNow({
  appointmentId,
  onRecorded,
}: {
  appointmentId: string;
  onRecorded?: (administration: ClinicianAssistedAdministration) => void;
}) {
  const [availability, setAvailability] = useState<ClinicianAssistedInstrumentAvailability>(EMPTY_AVAILABILITY);
  const [availabilityState, setAvailabilityState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [session, setSession] = useState<ApplySession | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [result, setResult] = useState<ClinicianAssistedAdministration | null>(null);

  useEffect(() => {
    let active = true;
    setAvailabilityState('loading');
    setAvailability(EMPTY_AVAILABILITY);
    setSession(null);
    setAnswers({});
    setResult(null);
    setSubmitError(null);

    void loadClinicianAssistedInstrumentAvailability(appointmentId)
      .then((next) => {
        if (!active) return;
        setAvailability(next);
        setAvailabilityState('ready');
      })
      .catch((error) => {
        console.error('[MedicsPro] instrumentos clínicos do atendimento:', error);
        if (!active) return;
        setAvailability(EMPTY_AVAILABILITY);
        setAvailabilityState('error');
      });

    return () => { active = false; };
  }, [appointmentId]);

  const availableDefinitions = useMemo(() => CLINICIAN_ASSISTED_INSTRUMENT_KEYS
    .filter((instrumentKey) => availability[instrumentKey])
    .map((instrumentKey) => getClinicianAssistedInstrumentDefinition(instrumentKey))
    .filter((definition): definition is NonNullable<typeof definition> => Boolean(definition)), [availability]);

  const definition = session ? getClinicianAssistedInstrumentDefinition(session.instrumentKey) : null;
  const answeredCount = definition
    ? definition.questions.filter((question) => Number.isInteger(answers[question.id])).length
    : 0;
  const complete = Boolean(definition && answeredCount === definition.questions.length);

  const begin = (instrumentKey: ClinicianAssistedInstrumentKey) => {
    setSession({ instrumentKey, requestId: crypto.randomUUID() });
    setAnswers({});
    setResult(null);
    setSubmitError(null);
  };

  const cancel = () => {
    setSession(null);
    setAnswers({});
    setResult(null);
    setSubmitError(null);
  };

  const submit = async () => {
    if (!session || !definition || !complete || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const canonicalAnswers = Object.fromEntries(definition.questions.map((question) => [question.id, answers[question.id]]));
      const administration = await submitClinicianAssistedInstrument({
        appointmentId,
        instrumentKey: session.instrumentKey,
        requestId: session.requestId,
        answers: canonicalAnswers,
      });
      setResult(administration);
      onRecorded?.(administration);
    } catch (error) {
      console.error('[MedicsPro] aplicar instrumento clínico:', error);
      setSubmitError('Não foi possível registrar este instrumento. Você pode tentar novamente sem duplicar a aplicação.');
    } finally {
      setSubmitting(false);
    }
  };

  if (availabilityState === 'loading') {
    return <div className="rounded-xl border border-line/65 bg-deep/30 px-4 py-3 text-[11.5px] text-fog">Verificando instrumentos disponíveis para este atendimento…</div>;
  }

  if (availabilityState === 'error') {
    return <div className="rounded-xl border border-pulse/30 bg-pulse/[0.04] px-4 py-3"><p className="text-[12px] font-semibold text-pulse">Instrumentos clínicos indisponíveis</p><p className="mt-1 text-[11.5px] leading-relaxed text-fog">Não foi possível confirmar a autorização deste atendimento. Nenhum instrumento foi liberado.</p></div>;
  }

  if (availableDefinitions.length === 0) return null;

  if (result && definition && session) {
    return <ResultCard result={result} acronym={definition.acronym} onApplyAgain={() => begin(session.instrumentKey)} onClose={cancel} />;
  }

  if (definition && session) {
    return (
      <section className="rounded-2xl border border-aqua/25 bg-aqua/[0.035] p-4" aria-label={`Aplicar ${definition.acronym}`}>
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-aqua">Aplicação assistida pelo profissional</p>
            <h3 className="mt-1 font-display text-[17px] font-semibold text-paper">{definition.acronym}</h3>
            <p className="mt-1 text-[11.5px] leading-relaxed text-fog">{definition.instructions}</p>
          </div>
          <Chip className="border-aqua/30 text-aqua">{answeredCount}/{definition.questions.length} respondidos</Chip>
        </div>

        <div className="mt-4 space-y-3">
          {definition.questions.map((question) => (
            <fieldset key={question.id} className="rounded-xl border border-line/70 bg-panel p-3.5">
              <legend className="px-1 text-[12.5px] font-medium leading-relaxed text-paper">{question.text}</legend>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {question.options.map((option) => {
                  const selected = answers[question.id] === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={selected}
                      disabled={submitting}
                      onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.value }))}
                      className={`rounded-xl border px-3 py-2.5 text-left text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${selected ? 'border-mint/55 bg-mint/[0.09] text-paper' : 'border-line/70 bg-deep/30 text-fog hover:border-aqua/35 hover:text-paper'}`}
                    >
                      <span className="block text-[9.5px] font-semibold uppercase tracking-[0.08em] text-aqua">{option.value}</span>
                      <span className="mt-0.5 block">{option.label}</span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          ))}
        </div>

        {submitError && <div className="mt-3 rounded-xl border border-pulse/30 bg-pulse/[0.04] px-3 py-2.5 text-[11.5px] text-pulse">{submitError}</div>}

        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" disabled={submitting} onClick={cancel} className="rounded-lg border border-line/70 px-3.5 py-2 text-[11px] font-semibold text-fog transition-colors hover:text-paper disabled:opacity-60">Cancelar</button>
          <button type="button" disabled={!complete || submitting} onClick={() => void submit()} className="rounded-lg bg-mint px-4 py-2 text-[11px] font-semibold text-on-accent transition-opacity disabled:cursor-not-allowed disabled:opacity-45">{submitting ? 'Registrando…' : 'Concluir aplicação'}</button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-aqua/25 bg-aqua/[0.035] p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-aqua">Instrumentos clínicos</p>
          <h3 className="mt-1 font-display text-[16px] font-semibold text-paper">Aplicar agora</h3>
          <p className="mt-1 text-[11.5px] leading-relaxed text-fog">Instrumentos habilitados pela clínica e disponíveis para este atendimento. A pontuação é calculada e validada automaticamente ao concluir.</p>
        </div>
        <Chip className="border-mint/30 text-mint">Disponível neste atendimento</Chip>
      </div>

      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {availableDefinitions.map((item) => (
          <div key={item.toolKey} className="rounded-xl border border-line/70 bg-panel p-3.5">
            <p className="font-display text-[14px] font-semibold text-paper">{item.acronym}</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-fog">{item.questions.length} itens · respostas estruturadas {Math.min(...item.questions.flatMap((question) => question.options.map((option) => option.value)))}–{Math.max(...item.questions.flatMap((question) => question.options.map((option) => option.value)))} · rastreio clínico</p>
            <button type="button" onClick={() => begin(item.toolKey)} className="mt-3 rounded-lg bg-mint px-3.5 py-2 text-[11px] font-semibold text-on-accent">Aplicar agora</button>
          </div>
        ))}
      </div>
    </section>
  );
}

function ResultCard({
  result,
  acronym,
  onApplyAgain,
  onClose,
}: {
  result: ClinicianAssistedAdministration;
  acronym: string;
  onApplyAgain: () => void;
  onClose: () => void;
}) {
  const recommendations = Array.isArray(result.outputSnapshot?.recommendations) ? result.outputSnapshot.recommendations : [];
  return (
    <section className="rounded-2xl border border-mint/30 bg-mint/[0.045] p-4" aria-live="polite">
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-mint">Aplicação registrada</p>
          <h3 className="mt-1 font-display text-[18px] font-semibold text-paper">{acronym}: {result.totalScore}/{result.maxScore}</h3>
          <p className="mt-1 text-[12px] font-medium text-paper/90">{result.classification}</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-fog">{result.interpretation}</p>
        </div>
        <Chip className="border-mint/35 text-mint">Resultado registrado</Chip>
      </div>

      {result.safetySignals?.length > 0 && <div className="mt-4 space-y-2">
        {result.safetySignals.map((signal) => (
          <div key={signal.flagCode} className={`rounded-xl border px-3.5 py-3 ${signal.severity === 'critical' ? 'border-pulse/45 bg-pulse/[0.07]' : 'border-amber/40 bg-amber/[0.05]'}`}>
            <p className={`text-[12px] font-semibold ${signal.severity === 'critical' ? 'text-pulse' : 'text-amber'}`}>{signal.title}</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-paper/85">{signal.message}</p>
            {signal.requiredAction && <p className="mt-2 text-[11px] font-medium leading-relaxed text-paper">{signal.requiredAction}</p>}
          </div>
        ))}
      </div>}

      {recommendations.length > 0 && <div className="mt-4 rounded-xl border border-line/70 bg-panel p-3.5">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.1em] text-fog">Orientações do instrumento</p>
        <ul className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-fog">{recommendations.map((item, index) => <li key={`${index}-${item}`}>• {item}</li>)}</ul>
      </div>}

      <p className="mt-3 text-[10.5px] text-fog">Concluído em {new Date(result.completedAt).toLocaleString('pt-BR')} · {result.replayed ? 'solicitação já registrada' : 'nova aplicação'}</p>
      <p className="mt-1 text-[10.5px] leading-relaxed text-fog">Instrumento de rastreio. O resultado não estabelece diagnóstico nem conduta isoladamente.</p>

      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded-lg border border-line/70 px-3.5 py-2 text-[11px] font-semibold text-fog hover:text-paper">Fechar</button>
        <button type="button" onClick={onApplyAgain} className="rounded-lg bg-mint px-3.5 py-2 text-[11px] font-semibold text-on-accent">Nova aplicação</button>
      </div>
    </section>
  );
}
