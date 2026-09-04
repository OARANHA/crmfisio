import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip, Empty } from '../lib/ui';
import {
  hasProfessionalCapability,
  listPatientNexusResults,
  listPatientOpenNexusRedFlags,
  type NexusClinicalResult,
  type NexusRedFlag,
} from '../lib/nexusClinical';
import {
  calculatePhq9,
  isPhq9Complete,
  PHQ9_CLINICAL_CONDUCT,
  PHQ9_CLINICAL_PEARLS,
  PHQ9_METADATA,
  PHQ9_MONITORING_GOALS,
  PHQ9_OPTIONS,
  PHQ9_QUESTIONS,
  type Phq9Answers,
  type Phq9AnswerValue,
} from '../lib/nexus/phq9';
import { persistPhq9Result } from '../lib/nexus/phq9Persistence';

export function NexusPhq9Panel({ patient }: { patient: Patient }) {
  const { user, appointments, toast } = useApp();
  const [answers, setAnswers] = useState<Phq9Answers>({});
  const [history, setHistory] = useState<NexusClinicalResult[]>([]);
  const [openFlags, setOpenFlags] = useState<NexusRedFlag[]>([]);
  const [canApply, setCanApply] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showClinicalContext, setShowClinicalContext] = useState(false);

  const activeAppointment = useMemo(
    () => appointments.find((item) => item.pacienteId === patient.id && item.status === 'em_atendimento') ?? null,
    [appointments, patient.id],
  );

  const preview = useMemo(
    () => isPhq9Complete(answers) ? calculatePhq9(answers) : null,
    [answers],
  );

  const load = async () => {
    setLoading(true);
    try {
      const [capability, results, flags] = await Promise.all([
        hasProfessionalCapability('nexus.scales').catch(() => false),
        listPatientNexusResults(patient.id),
        listPatientOpenNexusRedFlags(patient.id),
      ]);
      setCanApply(capability);
      setHistory(results.filter((item) => item.toolKey === 'phq-9'));
      setOpenFlags(flags.filter((item) => item.flagCode.startsWith('phq9.')));
    } catch (error) {
      console.error('[MedicsPro/Nexus] carregar PHQ-9:', error);
      toast('Não foi possível carregar o PHQ-9 do Nexus.', 'warn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [patient.id, user?.id]);

  const submit = async () => {
    if (!user || !canApply || !isPhq9Complete(answers)) return;
    setBusy(true);
    try {
      const saved = await persistPhq9Result({
        patientId: patient.id,
        professionalId: user.id,
        appointmentId: activeAppointment?.id ?? null,
        answers,
      });
      setHistory((current) => [saved.result, ...current]);
      if (saved.redFlag) setOpenFlags((current) => [saved.redFlag!, ...current]);
      setAnswers({});
      toast(saved.redFlag ? 'PHQ-9 salvo. Alerta clínico crítico registrado pelo Nexus.' : 'PHQ-9 finalizado e salvo no Nexus.', saved.redFlag ? 'warn' : 'info');
    } catch (error) {
      console.error('[MedicsPro/Nexus] finalizar PHQ-9:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível finalizar o PHQ-9.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const copySoap = async (soapText: string | null) => {
    if (!soapText) return;
    await navigator.clipboard.writeText(soapText);
    toast('Texto estruturado do PHQ-9 copiado para o prontuário.');
  };

  if (loading) {
    return <Card><div className="p-6 font-mono text-[11px] text-fog">Carregando Nexus Clinical Engine…</div></Card>;
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHead
          title="Nexus · PHQ-9"
          sub="primeiro instrumento Nexus integrado ao paciente real, com regra clínica versionada, evidência, red flag e histórico longitudinal"
        />
        <div className="p-5 space-y-5">
          <div className="rounded-xl border border-aqua/30 bg-aqua/[0.04] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip className="border-aqua/40 text-aqua">Nexus Clinical Engine</Chip>
              <Chip className="border-line text-fog">{PHQ9_METADATA.estimatedMinutes} min</Chip>
              <Chip className="border-line text-fog">regra versionada</Chip>
            </div>
            <p className="font-display font-semibold text-[14px] mt-3">{PHQ9_METADATA.title}</p>
            <p className="text-[11.5px] text-fog mt-1 leading-relaxed">{PHQ9_METADATA.description}</p>
            <p className="text-[11px] text-paper/80 mt-3">{PHQ9_METADATA.instructions}</p>
          </div>

          {openFlags.length > 0 && (
            <div className="rounded-xl border border-pulse/40 bg-pulse/[0.06] p-4">
              <p className="font-display font-semibold text-[13px] text-pulse">⚠ Alerta Nexus em aberto</p>
              {openFlags.map((flag) => (
                <div key={flag.id} className="mt-2 text-[11.5px] text-paper/90">
                  <strong>{flag.title}:</strong> {flag.requiredAction || flag.message}
                </div>
              ))}
            </div>
          )}

          {canApply ? (
            <div className="space-y-3">
              {PHQ9_QUESTIONS.map((question) => (
                <div key={question.id} className={`rounded-xl border p-4 ${question.id === 'q9' ? 'border-pulse/25 bg-pulse/[0.025]' : 'border-line bg-deep'}`}>
                  <p className="text-[12.5px] font-semibold leading-relaxed">{question.text}</p>
                  <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2">
                    {PHQ9_OPTIONS.map((option) => {
                      const selected = answers[question.id] === option.value;
                      return (
                        <button
                          key={option.value}
                          type="button"
                          disabled={busy}
                          onClick={() => setAnswers((current) => ({ ...current, [question.id]: option.value as Phq9AnswerValue }))}
                          className={`rounded-lg border px-3 py-2.5 text-left text-[11px] transition-colors ${selected ? 'border-mint bg-mint/10 text-mint' : 'border-line text-fog hover:text-paper hover:border-mint/35'}`}
                        >
                          <span className="font-mono mr-1.5">{option.value}</span>{option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {preview && (
                <div className={`rounded-xl border p-4 ${preview.hasSuicideRiskFlag ? 'border-pulse/45 bg-pulse/[0.06]' : 'border-mint/30 bg-mint/[0.04]'}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-fog">Resultado calculado pelo Nexus</p>
                      <p className="font-display text-2xl font-bold mt-1">{preview.totalScore}<span className="text-fog text-sm">/27</span></p>
                      <p className="text-[12px] font-semibold mt-1">{preview.classification}</p>
                    </div>
                    <Chip className={`ml-auto ${preview.hasSuicideRiskFlag ? 'border-pulse/50 text-pulse' : 'border-mint/40 text-mint'}`}>
                      {preview.hasSuicideRiskFlag ? 'item 9 positivo' : preview.severity}
                    </Chip>
                  </div>
                  <p className="text-[11.5px] text-fog mt-3 leading-relaxed">{preview.interpretation}</p>
                  {preview.hasSuicideRiskFlag && (
                    <div className="mt-3 rounded-lg border border-pulse/35 p-3 text-[11.5px] text-pulse">
                      A finalização registrará uma red flag crítica persistente vinculada a este resultado.
                    </div>
                  )}
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Btn variant="ghost" onClick={() => setAnswers({})} disabled={busy}>Limpar</Btn>
                    <Btn onClick={() => void submit()} disabled={busy}>{busy ? 'Finalizando…' : 'Finalizar PHQ-9'}</Btn>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-deep p-4 text-[11.5px] text-fog">
              Seu acesso permite consultar resultados Nexus, mas não aplicar o PHQ-9. A aplicação exige a capability <span className="font-mono text-paper">nexus.scales</span>.
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowClinicalContext((value) => !value)}
            className="text-[11.5px] font-semibold text-aqua hover:text-paper"
          >
            {showClinicalContext ? 'Ocultar contexto clínico do Nexus' : 'Ver contexto clínico, monitoramento e evidências'}
          </button>

          {showClinicalContext && (
            <div className="grid lg:grid-cols-3 gap-3">
              <ClinicalContextBlock title="Conduta por faixa" items={PHQ9_CLINICAL_CONDUCT.map((item) => ({ title: item.title, text: item.description }))} />
              <ClinicalContextBlock title="Monitoramento" items={PHQ9_MONITORING_GOALS.map((item) => ({ title: item.title, text: item.description }))} />
              <ClinicalContextBlock title="Pérolas e evidências" items={PHQ9_CLINICAL_PEARLS.map((item) => ({ title: item.title, text: item.text }))} />
              <div className="lg:col-span-3 rounded-xl border border-line bg-deep p-4 text-[10.5px] text-fog leading-relaxed">
                <strong className="text-paper">Fonte:</strong> {PHQ9_METADATA.referenceCitation}<br />
                <strong className="text-paper">Validação:</strong> {PHQ9_METADATA.validationInfo}<br />
                <strong className="text-paper">Pontos de corte:</strong> {PHQ9_METADATA.cutoffInfo}
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHead title="Evolução PHQ-9" sub="histórico longitudinal do paciente preservando a versão clínica usada em cada aplicação" />
        {history.length === 0 ? (
          <Empty title="Nenhum PHQ-9 finalizado" sub="A primeira aplicação aparecerá aqui sem sobrescrever resultados futuros ou passados." />
        ) : (
          <ul className="divide-y divide-line/70">
            {history.map((item) => (
              <li key={item.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                <div className="min-w-[170px]">
                  <p className="font-mono text-[11px] text-mint">{format(new Date(item.finalizedAt || item.createdAt), "dd MMM yyyy '·' HH:mm", { locale: ptBR })}</p>
                  <p className="font-mono text-[9.5px] text-fog mt-1">regra {item.ruleVersion}</p>
                </div>
                <div>
                  <p className="font-display font-semibold text-[14px]">{item.totalScore ?? '—'}<span className="text-fog text-[11px]">/27</span></p>
                  <p className="text-[11px] text-fog">{item.classification || 'Sem classificação'}</p>
                </div>
                {item.severity && <Chip className="border-line text-fog">{item.severity}</Chip>}
                <div className="ml-auto">
                  <Btn variant="ghost" onClick={() => void copySoap(item.soapText)} disabled={!item.soapText}>Copiar SOAP</Btn>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ClinicalContextBlock({ title, items }: { title: string; items: { title: string; text: string }[] }) {
  return (
    <div className="rounded-xl border border-line bg-deep p-4">
      <p className="font-display font-semibold text-[12.5px]">{title}</p>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={item.title}>
            <p className="text-[10.5px] font-semibold text-paper/90">{item.title}</p>
            <p className="text-[10.5px] text-fog mt-1 leading-relaxed">{item.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
