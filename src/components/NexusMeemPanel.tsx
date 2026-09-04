import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip, Empty } from '../lib/ui';
import { hasProfessionalCapability, listPatientNexusResults, type NexusClinicalResult } from '../lib/nexusClinical';
import { calculateMeem, isMeemComplete, MEEM_EDUCATION_BANDS, MEEM_QUESTIONS, NEXUS_MEEM_RULE_VERSION, type MeemAnswerMap, type MeemEducationBand } from '../lib/nexus/meem';
import { persistMeemResult } from '../lib/nexus/meemPersistence';

export function NexusMeemPanel({ patient }: { patient: Patient }) {
  const { user, appointments, toast } = useApp();
  const [answers, setAnswers] = useState<MeemAnswerMap>({});
  const [educationBand, setEducationBand] = useState<MeemEducationBand>('years_5_8');
  const [history, setHistory] = useState<NexusClinicalResult[]>([]);
  const [canApply, setCanApply] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const activeAppointment = useMemo(() => appointments.find((item) => item.pacienteId === patient.id && item.status === 'em_atendimento') ?? null, [appointments, patient.id]);
  const preview = useMemo(() => isMeemComplete(answers) ? calculateMeem(answers, educationBand) : null, [answers, educationBand]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [capability, results] = await Promise.all([
          hasProfessionalCapability('nexus.cognition').catch(() => false),
          listPatientNexusResults(patient.id),
        ]);
        if (!cancelled) {
          setCanApply(capability);
          setHistory(results.filter((item) => item.toolKey === 'meem'));
        }
      } catch (error) {
        console.error('[MedicsPro/Nexus] carregar MEEM:', error);
        toast('Não foi possível carregar o MEEM Nexus.', 'warn');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [patient.id, user?.id]);

  const submit = async () => {
    if (!user || !canApply || !isMeemComplete(answers)) return;
    setBusy(true);
    try {
      const result = await persistMeemResult({ patientId: patient.id, professionalId: user.id, appointmentId: activeAppointment?.id ?? null, answers, educationBand });
      setHistory((current) => [result, ...current]);
      toast('MEEM finalizado no Nexus e disponível para o SOAP canônico.', 'info');
    } catch (error) {
      console.error('[MedicsPro/Nexus] finalizar MEEM:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível finalizar o MEEM.', 'warn');
    } finally { setBusy(false); }
  };

  if (loading) return <Card><div className="p-6 font-mono text-[11px] text-fog">Carregando MEEM Nexus…</div></Card>;

  return <div className="space-y-4">
    <Card>
      <CardHead title="Nexus · MEEM / Cognição" sub="Aplicação estruturada · escolaridade contextual · domínios cognitivos · histórico longitudinal" />
      <div className="space-y-5 p-5">
        <div className="rounded-xl border border-aqua/30 bg-aqua/[0.04] p-4">
          <div className="flex flex-wrap gap-2"><Chip className="border-aqua/40 text-aqua">Cognição especializada</Chip><Chip className="border-line text-fog">{NEXUS_MEEM_RULE_VERSION}</Chip><Chip className="border-line text-fog">30 pontos</Chip></div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-fog">O score é preservado como no Nexus original. A escolaridade é registrada separadamente e aplicada como interpretação contextual, sem apagar a classificação histórica.</p>
        </div>

        {canApply ? <>
          <section className="rounded-xl border border-line bg-deep p-4">
            <p className="font-display text-[13px] font-semibold">Escolaridade formal</p>
            <p className="mt-1 text-[10.5px] text-fog">Obrigatória para interpretação contextual segundo os estratos usados pelo Nexus.</p>
            <select value={educationBand} onChange={(event) => setEducationBand(event.target.value as MeemEducationBand)} className="mt-3 w-full rounded-lg border border-line bg-panel px-3 py-2 text-[11px] text-paper md:max-w-md">
              {Object.entries(MEEM_EDUCATION_BANDS).map(([key, band]) => <option key={key} value={key}>{band.label} · corte {band.cutoff}</option>)}
            </select>
          </section>

          <div className="space-y-3">
            {MEEM_QUESTIONS.map((question) => <section key={question.id} className="rounded-xl border border-line bg-deep p-4">
              <div className="flex flex-wrap items-start gap-2"><p className="min-w-0 flex-1 text-[12px] font-semibold leading-relaxed">{question.text}</p><Chip className="border-line text-fog">{question.domain.replace(/_/g, ' ')}</Chip></div>
              <div className={`mt-3 grid gap-2 ${question.options.length <= 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2 sm:grid-cols-4'}`}>
                {question.options.map((option) => <button key={`${question.id}-${option.value}`} type="button" disabled={busy} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.value }))} className={`rounded-lg border px-3 py-2.5 text-left text-[10.5px] transition-colors ${answers[question.id] === option.value ? 'border-mint bg-mint/10 text-mint' : 'border-line text-fog hover:border-mint/35 hover:text-paper'}`}>{option.label}</button>)}
              </div>
            </section>)}
          </div>

          {preview && <section className="rounded-xl border border-mint/30 bg-mint/[0.04] p-4">
            <div className="flex flex-wrap gap-4"><div><p className="font-mono text-[9.5px] uppercase tracking-wide text-fog">Resultado MEEM</p><p className="mt-1 font-display text-2xl font-bold">{preview.totalScore}<span className="text-sm text-fog">/30</span></p></div><div className="min-w-0 flex-1"><p className="text-[11.5px] font-semibold">{preview.classification}</p><p className={`mt-1 text-[11px] ${preview.contextualStatus === 'below_cutoff' ? 'text-pulse' : 'text-mint'}`}>{preview.educationLabel}: corte {preview.contextualCutoff} · {preview.contextualStatus === 'below_cutoff' ? 'abaixo do corte contextual' : 'igual/acima do corte contextual'}</p></div></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{Object.entries(preview.domainScores).map(([domain, values]) => <div key={domain} className="rounded-lg border border-line bg-deep px-3 py-2"><p className="font-mono text-[9px] uppercase text-fog">{domain.replace(/_/g, ' ')}</p><p className="mt-1 text-[12px] font-semibold">{values.score}/{values.max}</p></div>)}</div>
            <p className="mt-4 text-[10.5px] leading-relaxed text-fog">{preview.interpretation}</p>
            <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" disabled={busy} onClick={() => setAnswers({})}>Limpar</Btn><Btn disabled={busy} onClick={() => void submit()}>{busy ? 'Finalizando…' : 'Finalizar MEEM'}</Btn></div>
          </section>}
        </> : <div className="rounded-xl border border-line bg-deep p-4 text-[11.5px] text-fog">Seu acesso permite consultar histórico, mas aplicar MEEM exige <span className="font-mono text-paper">nexus.cognition</span>.</div>}
      </div>
    </Card>

    <Card>
      <CardHead title="Evolução cognitiva · MEEM" sub="resultados históricos preservam score, escolaridade, domínios e versão clínica" />
      {history.length === 0 ? <Empty title="Nenhum MEEM finalizado" sub="A primeira aplicação aparecerá aqui para comparação longitudinal." /> : <ul className="divide-y divide-line/70">{history.map((item) => <li key={item.id} className="px-5 py-4"><div className="flex flex-wrap items-center gap-3"><p className="font-mono text-[10.5px] text-mint">{format(new Date(item.finalizedAt || item.createdAt), "dd MMM yyyy '·' HH:mm", { locale: ptBR })}</p><p className="font-display text-[14px] font-semibold">{item.totalScore ?? '—'}/30</p><Chip className="border-line text-fog">{item.ruleVersion}</Chip></div><p className="mt-2 text-[11px] text-fog">{item.classification}</p></li>)}</ul>}
    </Card>
  </div>;
}
