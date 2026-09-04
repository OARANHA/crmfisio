import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip, Empty } from '../lib/ui';
import { hasProfessionalCapability, listPatientNexusResults, type NexusClinicalResult } from '../lib/nexusClinical';
import {
  calculateGad7,
  GAD7_CLINICAL_CONDUCT,
  GAD7_CLINICAL_PEARLS,
  GAD7_METADATA,
  GAD7_MONITORING_GOALS,
  GAD7_OPTIONS,
  GAD7_QUESTIONS,
  isGad7Complete,
  type Gad7Answers,
  type Gad7AnswerValue,
} from '../lib/nexus/gad7';
import { persistGad7Result } from '../lib/nexus/gad7Persistence';

export function NexusGad7Panel({ patient }: { patient: Patient }) {
  const { user, appointments, toast } = useApp();
  const [answers, setAnswers] = useState<Gad7Answers>({});
  const [history, setHistory] = useState<NexusClinicalResult[]>([]);
  const [canApply, setCanApply] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showContext, setShowContext] = useState(false);

  const activeAppointment = useMemo(
    () => appointments.find((item) => item.pacienteId === patient.id && item.status === 'em_atendimento') ?? null,
    [appointments, patient.id],
  );
  const preview = useMemo(() => isGad7Complete(answers) ? calculateGad7(answers) : null, [answers]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [capability, results] = await Promise.all([
          hasProfessionalCapability('nexus.scales').catch(() => false),
          listPatientNexusResults(patient.id),
        ]);
        if (!cancelled) {
          setCanApply(capability);
          setHistory(results.filter((item) => item.toolKey === 'gad-7'));
        }
      } catch (error) {
        console.error('[MedicsPro/Nexus] carregar GAD-7:', error);
        toast('Não foi possível carregar o GAD-7 do Nexus.', 'warn');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [patient.id, user?.id]);

  const submit = async () => {
    if (!user || !canApply || !isGad7Complete(answers)) return;
    setBusy(true);
    try {
      const saved = await persistGad7Result({ patientId: patient.id, professionalId: user.id, appointmentId: activeAppointment?.id ?? null, answers });
      setHistory((current) => [saved.result, ...current]);
      setAnswers({});
      toast('GAD-7 finalizado e salvo no Nexus. Já pode ser proposto ao SOAP canônico.', 'info');
    } catch (error) {
      console.error('[MedicsPro/Nexus] finalizar GAD-7:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível finalizar o GAD-7.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Card><div className="p-6 font-mono text-[11px] text-fog">Carregando GAD-7 Nexus…</div></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHead title="Nexus · GAD-7" sub="ansiedade · regra clínica versionada · histórico longitudinal · integração com SOAP" />
        <div className="p-5 space-y-5">
          <div className="rounded-xl border border-aqua/30 bg-aqua/[0.04] p-4">
            <div className="flex flex-wrap gap-2"><Chip className="border-aqua/40 text-aqua">Nexus Clinical Engine</Chip><Chip className="border-line text-fog">{GAD7_METADATA.estimatedMinutes} min</Chip><Chip className="border-line text-fog">regra versionada</Chip></div>
            <p className="mt-3 font-display font-semibold text-[14px]">{GAD7_METADATA.title}</p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-fog">{GAD7_METADATA.description}</p>
            <p className="mt-3 text-[11px] text-paper/80">{GAD7_METADATA.instructions}</p>
          </div>

          {canApply ? <div className="space-y-3">
            {GAD7_QUESTIONS.map((question) => <div key={question.id} className="rounded-xl border border-line bg-deep p-4">
              <p className="text-[12.5px] font-semibold leading-relaxed">{question.text}</p>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4">
                {GAD7_OPTIONS.map((option) => {
                  const selected = answers[question.id] === option.value;
                  return <button key={option.value} type="button" disabled={busy} onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.value as Gad7AnswerValue }))} className={`rounded-lg border px-3 py-2.5 text-left text-[11px] transition-colors ${selected ? 'border-mint bg-mint/10 text-mint' : 'border-line text-fog hover:border-mint/35 hover:text-paper'}`}><span className="mr-1.5 font-mono">{option.value}</span>{option.label}</button>;
                })}
              </div>
            </div>)}
            {preview && <div className="rounded-xl border border-mint/30 bg-mint/[0.04] p-4">
              <div className="flex flex-wrap items-start gap-3"><div><p className="font-mono text-[10px] uppercase tracking-wide text-fog">Resultado calculado pelo Nexus</p><p className="mt-1 font-display text-2xl font-bold">{preview.totalScore}<span className="text-sm text-fog">/21</span></p><p className="mt-1 text-[12px] font-semibold">{preview.classification}</p></div><Chip className="ml-auto border-mint/40 text-mint">{preview.severity}</Chip></div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-fog">{preview.interpretation}</p>
              <div className="mt-4 flex justify-end gap-2"><Btn variant="ghost" onClick={() => setAnswers({})} disabled={busy}>Limpar</Btn><Btn onClick={() => void submit()} disabled={busy}>{busy ? 'Finalizando…' : 'Finalizar GAD-7'}</Btn></div>
            </div>}
          </div> : <div className="rounded-xl border border-line bg-deep p-4 text-[11.5px] text-fog">Seu acesso permite consultar resultados, mas a aplicação exige <span className="font-mono text-paper">nexus.scales</span>.</div>}

          <button type="button" onClick={() => setShowContext((value) => !value)} className="text-[11.5px] font-semibold text-aqua hover:text-paper">{showContext ? 'Ocultar contexto clínico' : 'Ver contexto clínico, monitoramento e evidências'}</button>
          {showContext && <div className="grid gap-3 lg:grid-cols-3">
            <ContextBlock title="Conduta por faixa" items={GAD7_CLINICAL_CONDUCT} />
            <ContextBlock title="Monitoramento" items={GAD7_MONITORING_GOALS} />
            <ContextBlock title="Pérolas e evidências" items={GAD7_CLINICAL_PEARLS.map(({ title, text }) => ({ title, description: text }))} />
            <div className="rounded-xl border border-line bg-deep p-4 text-[10.5px] leading-relaxed text-fog lg:col-span-3"><strong className="text-paper">Fonte:</strong> {GAD7_METADATA.referenceCitation}<br/><strong className="text-paper">Validação:</strong> {GAD7_METADATA.validationInfo}<br/><strong className="text-paper">Cortes:</strong> {GAD7_METADATA.cutoffInfo}</div>
          </div>}
        </div>
      </Card>

      <Card>
        <CardHead title="Evolução GAD-7" sub="histórico longitudinal preservando versão clínica de cada aplicação" />
        {history.length === 0 ? <Empty title="Nenhum GAD-7 finalizado" sub="A primeira aplicação aparecerá aqui e também ficará disponível para revisão no SOAP canônico." /> : <ul className="divide-y divide-line/70">{history.map((item) => <li key={item.id} className="flex flex-wrap items-center gap-3 px-5 py-4"><div className="min-w-[170px]"><p className="font-mono text-[11px] text-mint">{format(new Date(item.finalizedAt || item.createdAt), "dd MMM yyyy '·' HH:mm", { locale: ptBR })}</p><p className="mt-1 font-mono text-[9.5px] text-fog">regra {item.ruleVersion}</p></div><div><p className="font-display font-semibold text-[14px]">{item.totalScore ?? '—'}<span className="text-[11px] text-fog">/21</span></p><p className="text-[11px] text-fog">{item.classification}</p></div><Chip className="border-line text-fog">{item.severity}</Chip></li>)}</ul>}
      </Card>
    </div>
  );
}

function ContextBlock({ title, items }: { title: string; items: readonly { title: string; description: string }[] }) {
  return <div className="rounded-xl border border-line bg-deep p-4"><p className="font-display font-semibold text-[12.5px]">{title}</p><div className="mt-3 space-y-3">{items.map((item) => <div key={item.title}><p className="text-[10.5px] font-semibold text-paper/90">{item.title}</p><p className="mt-1 text-[10.5px] leading-relaxed text-fog">{item.description}</p></div>)}</div></div>;
}
