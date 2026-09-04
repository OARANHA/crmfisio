import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip, Empty } from '../lib/ui';
import { hasProfessionalCapability, listPatientNexusResults, type NexusClinicalResult } from '../lib/nexusClinical';
import { calculateScale, isScaleComplete, type NexusScaleDefinition } from '../lib/nexus/scaleRuntime';
import { persistScaleResult, type NexusRawScaleSelection } from '../lib/nexus/scalePersistence';

export function NexusScaleRuntimePanel({ patient, definition }: { patient: Patient; definition: NexusScaleDefinition }) {
  const { user, appointments, toast } = useApp();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [rawSelections, setRawSelections] = useState<Record<string, NexusRawScaleSelection>>({});
  const [history, setHistory] = useState<NexusClinicalResult[]>([]);
  const [canApply, setCanApply] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const activeAppointment = useMemo(
    () => appointments.find((item) => item.pacienteId === patient.id && item.status === 'em_atendimento') ?? null,
    [appointments, patient.id],
  );
  const preview = useMemo(() => isScaleComplete(definition, answers) ? calculateScale(definition, answers) : null, [definition, answers]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [capability, results] = await Promise.all([
          hasProfessionalCapability(definition.requiredCapability).catch(() => false),
          listPatientNexusResults(patient.id),
        ]);
        if (!cancelled) {
          setCanApply(capability);
          setHistory(results.filter((item) => item.toolKey === definition.toolKey));
        }
      } catch (error) {
        console.error(`[MedicsPro/Nexus] carregar ${definition.acronym}:`, error);
        toast(`Não foi possível carregar ${definition.acronym}.`, 'warn');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [patient.id, user?.id, definition]);

  const clear = () => {
    setAnswers({});
    setRawSelections({});
  };

  const choose = (questionId: string, optionIndex: number, label: string, value: number) => {
    setAnswers((current) => ({ ...current, [questionId]: value }));
    setRawSelections((current) => ({ ...current, [questionId]: { optionIndex, label, value } }));
  };

  const submit = async () => {
    if (!user || !canApply || !isScaleComplete(definition, answers)) return;
    setBusy(true);
    try {
      const saved = await persistScaleResult({
        definition,
        patientId: patient.id,
        professionalId: user.id,
        appointmentId: activeAppointment?.id ?? null,
        answers,
        rawSelections,
      });
      setHistory((current) => [saved.result, ...current]);
      clear();
      toast(`${definition.acronym} finalizado e salvo no Nexus. Já pode ser proposto ao SOAP canônico.`, 'info');
    } catch (error) {
      console.error(`[MedicsPro/Nexus] finalizar ${definition.acronym}:`, error);
      toast(error instanceof Error ? error.message : `Não foi possível finalizar ${definition.acronym}.`, 'warn');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Card><div className="p-6 font-mono text-[11px] text-fog">Carregando {definition.acronym} Nexus…</div></Card>;

  return <div className="space-y-4">
    <Card>
      <CardHead title={`Nexus · ${definition.acronym}`} sub="Nexus Scale Runtime · regra clínica versionada · histórico longitudinal · SOAP canônico" />
      <div className="space-y-5 p-5">
        <div className="rounded-xl border border-aqua/30 bg-aqua/[0.04] p-4">
          <div className="flex flex-wrap gap-2"><Chip className="border-aqua/40 text-aqua">Nexus Scale Runtime</Chip><Chip className="border-line text-fog">{definition.estimatedMinutes} min</Chip><Chip className="border-line text-fog">{definition.ruleVersion}</Chip></div>
          <p className="mt-3 font-display text-[14px] font-semibold">{definition.title}</p>
          <p className="mt-1 text-[11.5px] leading-relaxed text-fog">{definition.description}</p>
          <p className="mt-3 text-[11px] text-paper/80">{definition.instructions}</p>
        </div>

        {canApply ? <div className="space-y-3">
          {definition.questions.map((question) => <div key={question.id} className="rounded-xl border border-line bg-deep p-4">
            <div className="flex flex-wrap items-start gap-2"><p className="min-w-0 flex-1 text-[12.5px] font-semibold leading-relaxed">{question.text}</p>{question.subscale && <Chip className="border-line text-fog">{question.subscale}</Chip>}</div>
            {question.instruction && <p className="mt-1 text-[10.5px] text-fog">{question.instruction}</p>}
            <div className={`mt-3 grid gap-2 ${question.options.length <= 2 ? 'grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'}`}>
              {question.options.map((option, optionIndex) => {
                const selected = rawSelections[question.id]?.optionIndex === optionIndex;
                return <button key={`${question.id}:${optionIndex}`} type="button" disabled={busy} onClick={() => choose(question.id, optionIndex, option.label, option.value)} className={`rounded-lg border px-3 py-2.5 text-left text-[11px] transition-colors ${selected ? 'border-mint bg-mint/10 text-mint' : 'border-line text-fog hover:border-mint/35 hover:text-paper'}`}>{option.label}</button>;
              })}
            </div>
          </div>)}

          {preview && <div className="rounded-xl border border-mint/30 bg-mint/[0.04] p-4">
            <div className="flex flex-wrap items-start gap-3"><div><p className="font-mono text-[10px] uppercase tracking-wide text-fog">Resultado calculado pelo Nexus</p><p className="mt-1 font-display text-2xl font-bold">{preview.totalScore}<span className="text-sm text-fog">/{preview.maxScore}</span></p><p className="mt-1 text-[12px] font-semibold">{preview.classification}</p></div><Chip className="ml-auto border-mint/40 text-mint">{preview.severity}</Chip></div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-fog">{preview.interpretation}</p>
            {(preview.redFlags?.length ?? 0) > 0 && <div className="mt-3 rounded-lg border border-pulse/40 bg-pulse/[0.05] p-3"><p className="text-[11px] font-semibold text-pulse">⚠️ Esta aplicação gerará {preview.redFlags?.length} alerta clínico de segurança.</p></div>}
            <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={clear} disabled={busy}>Limpar</Btn><Btn onClick={() => void submit()} disabled={busy}>{busy ? 'Finalizando…' : `Finalizar ${definition.acronym}`}</Btn></div>
          </div>}
        </div> : <div className="rounded-xl border border-line bg-deep p-4 text-[11.5px] text-fog">Seu acesso permite consultar resultados, mas a aplicação exige <span className="font-mono text-paper">{definition.requiredCapability}</span>.</div>}

        <button type="button" onClick={() => setShowContext((value) => !value)} className="text-[11.5px] font-semibold text-aqua hover:text-paper">{showContext ? 'Ocultar contexto clínico' : 'Ver contexto clínico, monitoramento e evidências'}</button>
        {showContext && <div className="grid gap-3 lg:grid-cols-3">
          <ContextBlock title="Conduta" items={definition.clinicalConduct.map(({ title, description }) => ({ title, description }))} />
          <ContextBlock title="Monitoramento" items={definition.monitoringGoals} />
          <ContextBlock title="Pérolas e evidências" items={definition.clinicalPearls.map(({ title, text }) => ({ title, description: text }))} />
          <div className="rounded-xl border border-line bg-deep p-4 text-[10.5px] leading-relaxed text-fog lg:col-span-3"><strong className="text-paper">Fonte:</strong> {definition.referenceCitation}<br/><strong className="text-paper">Validação:</strong> {definition.validationInfo}<br/><strong className="text-paper">Cortes:</strong> {definition.cutoffInfo}</div>
        </div>}
      </div>
    </Card>

    <Card>
      <CardHead title={`Evolução ${definition.acronym}`} sub="histórico longitudinal preservando versão clínica de cada aplicação" />
      {history.length === 0 ? <Empty title={`Nenhum ${definition.acronym} finalizado`} sub="A primeira aplicação aparecerá aqui e ficará disponível ao SOAP canônico." /> : <ul className="divide-y divide-line/70">{history.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-4"><div className="min-w-[170px]"><p className="font-mono text-[11px] text-mint">{format(new Date(item.finalizedAt || item.createdAt), "dd MMM yyyy '·' HH:mm", { locale: ptBR })}</p><p className="mt-1 font-mono text-[9.5px] text-fog">regra {item.ruleVersion}</p></div><div><p className="font-display text-[14px] font-semibold">{item.totalScore ?? '—'}<span className="text-[11px] text-fog">/{item.maxScore ?? definition.questions.length}</span></p><p className="text-[11px] text-fog">{item.classification}</p></div>{item.severity && <Chip className="border-line text-fog">{item.severity}</Chip>}</li>)}</ul>}
    </Card>
  </div>;
}

function ContextBlock({ title, items }: { title: string; items: readonly { title: string; description: string }[] }) {
  return <div className="rounded-xl border border-line bg-deep p-4"><p className="font-display text-[12.5px] font-semibold">{title}</p><div className="mt-3 space-y-3">{items.length === 0 ? <p className="text-[10.5px] text-fog">Sem conteúdo adicional registrado para esta versão.</p> : items.map((item) => <div key={item.title}><p className="text-[10.5px] font-semibold text-paper/90">{item.title}</p><p className="mt-1 text-[10.5px] leading-relaxed text-fog">{item.description}</p></div>)}</div></div>;
}
