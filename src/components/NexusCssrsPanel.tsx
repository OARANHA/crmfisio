import { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip, Empty } from '../lib/ui';
import { hasProfessionalCapability, listPatientNexusResults, type NexusClinicalResult } from '../lib/nexusClinical';
import {
  calculateCssrs,
  CSSRS_CLINICAL_CONDUCT,
  CSSRS_CLINICAL_PEARLS,
  CSSRS_METADATA,
  CSSRS_MONITORING_GOALS,
  CSSRS_QUESTIONS,
  isCssrsComplete,
  type CssrsAnswers,
} from '../lib/nexus/cssrs';
import { persistCssrsResult } from '../lib/nexus/cssrsPersistence';

export function NexusCssrsPanel({ patient }: { patient: Patient }) {
  const { user, appointments, toast } = useApp();
  const [answers, setAnswers] = useState<CssrsAnswers>({});
  const [history, setHistory] = useState<NexusClinicalResult[]>([]);
  const [canApply, setCanApply] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showClinicalContext, setShowClinicalContext] = useState(true);

  const activeAppointment = useMemo(
    () => appointments.find((item) => item.pacienteId === patient.id && item.status === 'em_atendimento') ?? null,
    [appointments, patient.id],
  );

  const preview = useMemo(
    () => isCssrsComplete(answers) ? calculateCssrs(answers) : null,
    [answers],
  );

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
          setHistory(results.filter((item) => item.toolKey === 'cssrs'));
        }
      } catch (error) {
        console.error('[MedicsPro/Nexus] carregar C-SSRS:', error);
        toast('Não foi possível carregar a C-SSRS do Nexus.', 'warn');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [patient.id, user?.id]);

  const submit = async () => {
    if (!user || !canApply || !isCssrsComplete(answers)) return;
    setBusy(true);
    try {
      const saved = await persistCssrsResult({
        patientId: patient.id,
        professionalId: user.id,
        appointmentId: activeAppointment?.id ?? null,
        answers,
      });
      setHistory((current) => [saved.result, ...current]);
      setAnswers({});
      toast(saved.clinical.severity === 'severe' ? 'C-SSRS salva. Resultado de alto risco registrado no Nexus.' : 'C-SSRS finalizada e salva no Nexus.', saved.clinical.severity === 'severe' ? 'warn' : 'info');
    } catch (error) {
      console.error('[MedicsPro/Nexus] finalizar C-SSRS:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível finalizar a C-SSRS.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const copySoap = async (soapText: string | null) => {
    if (!soapText) return;
    await navigator.clipboard.writeText(soapText);
    toast('Texto estruturado da C-SSRS copiado para o prontuário.');
  };

  if (loading) return <Card><div className="p-6 font-mono text-[11px] text-fog">Carregando C-SSRS Nexus…</div></Card>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHead title="Nexus · C-SSRS" sub="avaliação estruturada de risco e segurança, preservando a regra clínica validada do Nexus" />
        <div className="p-5 space-y-5">
          <div className="rounded-xl border border-pulse/30 bg-pulse/[0.04] p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Chip className="border-pulse/40 text-pulse">Segurança clínica</Chip>
              <Chip className="border-line text-fog">{CSSRS_METADATA.estimatedMinutes} min</Chip>
              <Chip className="border-line text-fog">regra versionada</Chip>
            </div>
            <p className="font-display font-semibold text-[14px] mt-3">{CSSRS_METADATA.title}</p>
            <p className="text-[11.5px] text-fog mt-1 leading-relaxed">{CSSRS_METADATA.description}</p>
            <p className="text-[11px] text-paper/80 mt-3">{CSSRS_METADATA.instructions}</p>
          </div>

          {canApply ? (
            <div className="space-y-3">
              {CSSRS_QUESTIONS.map((question) => {
                const current = answers[question.id];
                return (
                  <div key={question.id} className="rounded-xl border border-line bg-deep p-4">
                    <p className="text-[12.5px] font-semibold leading-relaxed">{question.text}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button type="button" disabled={busy} onClick={() => setAnswers((value) => ({ ...value, [question.id]: 0 }))} className={`rounded-lg border px-3 py-2.5 text-left text-[11px] transition-colors ${current === 0 ? 'border-mint bg-mint/10 text-mint' : 'border-line text-fog hover:text-paper'}`}>Não (0)</button>
                      <button type="button" disabled={busy} onClick={() => setAnswers((value) => ({ ...value, [question.id]: question.yesValue }))} className={`rounded-lg border px-3 py-2.5 text-left text-[11px] transition-colors ${current === question.yesValue ? 'border-pulse bg-pulse/10 text-pulse' : 'border-line text-fog hover:text-paper'}`}>Sim ({question.yesValue})</button>
                    </div>
                  </div>
                );
              })}

              {preview && (
                <div className={`rounded-xl border p-4 ${preview.severity === 'severe' ? 'border-pulse/50 bg-pulse/[0.08]' : preview.severity === 'moderate' ? 'border-amber/45 bg-amber/[0.05]' : 'border-mint/30 bg-mint/[0.04]'}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-wide text-fog">Estratificação Nexus</p>
                      <p className="font-display text-2xl font-bold mt-1">Nível {preview.totalScore}<span className="text-fog text-sm">/5</span></p>
                      <p className="text-[12px] font-semibold mt-1">{preview.classification}</p>
                    </div>
                    <Chip className={`ml-auto ${preview.severity === 'severe' ? 'border-pulse/50 text-pulse' : preview.severity === 'moderate' ? 'border-amber/50 text-amber' : 'border-mint/40 text-mint'}`}>{preview.severity}</Chip>
                  </div>
                  <p className="text-[11.5px] text-fog mt-3 leading-relaxed">{preview.interpretation}</p>
                  <div className="mt-3 space-y-1.5">
                    {preview.recommendations.map((item) => <p key={item} className="text-[11px] text-paper/90">• {item}</p>)}
                  </div>
                  <div className="mt-4 flex flex-wrap justify-end gap-2">
                    <Btn variant="ghost" onClick={() => setAnswers({})} disabled={busy}>Limpar</Btn>
                    <Btn onClick={() => void submit()} disabled={busy}>{busy ? 'Finalizando…' : 'Finalizar C-SSRS'}</Btn>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-xl border border-line bg-deep p-4 text-[11.5px] text-fog">Seu acesso permite consultar resultados Nexus, mas não aplicar a C-SSRS. A aplicação exige <span className="font-mono text-paper">nexus.scales</span>.</div>
          )}

          <button type="button" onClick={() => setShowClinicalContext((value) => !value)} className="text-[11.5px] font-semibold text-aqua hover:text-paper">{showClinicalContext ? 'Ocultar protocolo e evidências' : 'Ver protocolo, monitoramento e evidências'}</button>
          {showClinicalContext && (
            <div className="grid lg:grid-cols-3 gap-3">
              <ContextBlock title="Conduta por nível" items={CSSRS_CLINICAL_CONDUCT.map((item) => ({ title: item.title, text: item.description }))} />
              <ContextBlock title="Monitoramento" items={CSSRS_MONITORING_GOALS.map((item) => ({ title: item.title, text: item.description }))} />
              <ContextBlock title="Pérolas e evidências" items={CSSRS_CLINICAL_PEARLS.map((item) => ({ title: item.title, text: item.text }))} />
              <div className="lg:col-span-3 rounded-xl border border-line bg-deep p-4 text-[10.5px] text-fog leading-relaxed"><strong className="text-paper">Fonte:</strong> {CSSRS_METADATA.referenceCitation}<br /><strong className="text-paper">Validação:</strong> {CSSRS_METADATA.validationInfo}<br /><strong className="text-paper">Estratificação:</strong> {CSSRS_METADATA.cutoffInfo}</div>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHead title="Histórico C-SSRS" sub="cada avaliação permanece versionada e vinculada ao paciente" />
        {history.length === 0 ? <Empty title="Nenhuma C-SSRS finalizada" sub="A primeira avaliação de risco aparecerá aqui sem sobrescrever registros anteriores." /> : (
          <ul className="divide-y divide-line/70">
            {history.map((item) => (
              <li key={item.id} className="px-5 py-4 flex flex-wrap items-center gap-3">
                <div className="min-w-[170px]"><p className="font-mono text-[11px] text-mint">{format(new Date(item.finalizedAt || item.createdAt), "dd MMM yyyy '·' HH:mm", { locale: ptBR })}</p><p className="font-mono text-[9.5px] text-fog mt-1">regra {item.ruleVersion}</p></div>
                <div><p className="font-display font-semibold text-[14px]">Nível {item.totalScore ?? '—'}<span className="text-fog text-[11px]">/5</span></p><p className="text-[11px] text-fog">{item.classification || 'Sem classificação'}</p></div>
                {item.severity && <Chip className={item.severity === 'severe' ? 'border-pulse/45 text-pulse' : 'border-line text-fog'}>{item.severity}</Chip>}
                <div className="ml-auto"><Btn variant="ghost" onClick={() => void copySoap(item.soapText)} disabled={!item.soapText}>Copiar SOAP</Btn></div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function ContextBlock({ title, items }: { title: string; items: { title: string; text: string }[] }) {
  return <div className="rounded-xl border border-line bg-deep p-4"><p className="font-display font-semibold text-[12.5px]">{title}</p><div className="mt-3 space-y-3">{items.map((item) => <div key={item.title}><p className="text-[10.5px] font-semibold text-paper/90">{item.title}</p><p className="text-[10.5px] text-fog mt-1 leading-relaxed">{item.text}</p></div>)}</div></div>;
}
