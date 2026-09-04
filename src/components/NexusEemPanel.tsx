import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip, Empty } from '../lib/ui';
import { hasProfessionalCapability, listPatientNexusResults, type NexusClinicalResult } from '../lib/nexusClinical';
import {
  createInitialEemState,
  EEM_DOMAINS,
  eemRedFlags,
  generateEemNarrative,
  NEXUS_EEM_RULE_VERSION,
  toggleEemOption,
  type NexusEemState,
} from '../lib/nexus/eem';
import { persistEemResult } from '../lib/nexus/eemPersistence';

export function NexusEemPanel({ patient }: { patient: Patient }) {
  const { user, appointments, toast } = useApp();
  const [state, setState] = useState<NexusEemState>(() => createInitialEemState());
  const [history, setHistory] = useState<NexusClinicalResult[]>([]);
  const [canApply, setCanApply] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showNarrative, setShowNarrative] = useState(true);

  const activeAppointment = useMemo(
    () => appointments.find((item) => item.pacienteId === patient.id && item.status === 'em_atendimento') ?? null,
    [appointments, patient.id],
  );
  const narrative = useMemo(() => generateEemNarrative(state), [state]);
  const flags = useMemo(() => eemRedFlags(state), [state]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [capability, results] = await Promise.all([
          hasProfessionalCapability('nexus.eem').catch(() => false),
          listPatientNexusResults(patient.id),
        ]);
        if (!cancelled) {
          setCanApply(capability);
          setHistory(results.filter((item) => item.toolKey === 'eem'));
        }
      } catch (error) {
        console.error('[MedicsPro/Nexus] carregar EEM:', error);
        toast('Não foi possível carregar o EEM Nexus.', 'warn');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [patient.id, user?.id]);

  const submit = async () => {
    if (!user || !canApply) return;
    setBusy(true);
    try {
      const result = await persistEemResult({
        patientId: patient.id,
        professionalId: user.id,
        appointmentId: activeAppointment?.id ?? null,
        state,
      });
      setHistory((current) => [result, ...current]);
      toast('EEM finalizado no Nexus. A narrativa já pode ser proposta ao Objetivo do SOAP.', 'info');
    } catch (error) {
      console.error('[MedicsPro/Nexus] finalizar EEM:', error);
      toast(error instanceof Error ? error.message : 'Não foi possível finalizar o EEM.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Card><div className="p-6 font-mono text-[11px] text-fog">Carregando EEM Nexus…</div></Card>;

  return <div className="space-y-4">
    <Card>
      <CardHead title="Nexus · Exame do Estado Mental" sub="Editor especializado · estado estruturado · narrativa determinística · SOAP Objetivo" />
      <div className="space-y-5 p-5">
        <div className="rounded-xl border border-aqua/30 bg-aqua/[0.04] p-4">
          <div className="flex flex-wrap gap-2">
            <Chip className="border-aqua/40 text-aqua">EEM especializado</Chip>
            <Chip className="border-line text-fog">{NEXUS_EEM_RULE_VERSION}</Chip>
            <Chip className="border-line text-fog">destino SOAP: O</Chip>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-fog">O EEM não usa o Scale Runtime. Cada domínio preserva seleções clínicas estruturadas, regras de coerência e geração determinística da narrativa.</p>
        </div>

        {flags.length > 0 && <div className="rounded-xl border border-pulse/40 bg-pulse/[0.05] p-4">
          <p className="font-display text-[13px] font-semibold text-pulse">Achados que exigem atenção</p>
          <div className="mt-3 space-y-2">{flags.map((flag) => <div key={flag.flagCode} className="rounded-lg border border-pulse/25 bg-deep p-3"><p className="text-[11.5px] font-semibold text-paper">{flag.title}</p><p className="mt-1 text-[10.5px] text-fog">{flag.message}</p>{flag.requiredAction && <p className="mt-2 text-[10.5px] font-medium text-pulse">{flag.requiredAction}</p>}{flag.flagCode === 'eem.thought.suicidal-ideation' && <Link to={`/pacientes/${patient.id}/nexus/cssrs`} className="mt-2 inline-flex text-[10.5px] font-semibold text-pulse hover:text-paper">Abrir C-SSRS →</Link>}</div>)}</div>
        </div>}

        {canApply ? <div className="space-y-3">
          {EEM_DOMAINS.map((domain) => <section key={domain.id} className="rounded-xl border border-line bg-deep p-4">
            <div><p className="font-display text-[13px] font-semibold text-paper">{domain.title}</p><p className="mt-1 text-[10.5px] text-fog">{domain.instructions}</p></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {domain.options.map((option) => {
                const selected = state[domain.id].includes(option.id);
                return <button key={option.id} type="button" disabled={busy} onClick={() => setState((current) => toggleEemOption(current, domain.id, option.id))} className={`rounded-lg border px-3 py-2.5 text-left text-[10.5px] leading-relaxed transition-colors ${selected ? 'border-mint bg-mint/10 text-mint' : 'border-line text-fog hover:border-mint/35 hover:text-paper'}`}>{option.label}</button>;
              })}
            </div>
          </section>)}

          <section className="rounded-xl border border-line bg-deep p-4">
            <p className="font-display text-[13px] font-semibold">Observações livres</p>
            <textarea value={state.observacoesLivres} onChange={(event) => setState((current) => ({ ...current, observacoesLivres: event.target.value }))} rows={4} className="mt-3 w-full rounded-lg border border-line bg-panel px-3 py-2 text-[11px] text-paper outline-none focus:border-aqua" placeholder="Achados adicionais que não estejam representados nas opções estruturadas…" />
          </section>

          <div className="rounded-xl border border-mint/30 bg-mint/[0.04] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-mono text-[9.5px] uppercase tracking-wide text-fog">Narrativa determinística</p><p className="mt-1 text-[11.5px] text-paper">Prévia do texto que poderá ser proposto ao Objetivo do SOAP.</p></div><button type="button" onClick={() => setShowNarrative((value) => !value)} className="text-[10.5px] font-semibold text-aqua">{showNarrative ? 'Ocultar' : 'Visualizar'}</button></div>
            {showNarrative && <pre className="mt-3 whitespace-pre-wrap rounded-lg border border-line bg-deep p-3 font-sans text-[10.5px] leading-relaxed text-fog">{narrative}</pre>}
            <div className="mt-4 flex flex-wrap justify-end gap-2"><Btn variant="ghost" disabled={busy} onClick={() => setState(createInitialEemState())}>Restaurar padrão</Btn><Btn disabled={busy} onClick={() => void submit()}>{busy ? 'Finalizando…' : 'Finalizar EEM'}</Btn></div>
          </div>
        </div> : <div className="rounded-xl border border-line bg-deep p-4 text-[11.5px] text-fog">Seu acesso permite consultar histórico, mas registrar EEM exige <span className="font-mono text-paper">nexus.eem</span>.</div>}
      </div>
    </Card>

    <Card>
      <CardHead title="Histórico EEM" sub="Cada registro finalizado mantém estado estruturado, narrativa e versão clínica" />
      {history.length === 0 ? <Empty title="Nenhum EEM finalizado" sub="O primeiro exame aparecerá aqui e ficará disponível ao SOAP canônico." /> : <ul className="divide-y divide-line/70">{history.map((item) => <li key={item.id} className="px-5 py-4"><div className="flex flex-wrap items-center gap-3"><p className="font-mono text-[10.5px] text-mint">{format(new Date(item.finalizedAt || item.createdAt), "dd MMM yyyy '·' HH:mm", { locale: ptBR })}</p><Chip className="border-line text-fog">{item.ruleVersion}</Chip>{item.severity && <Chip className={item.severity === 'severe' ? 'border-pulse/40 text-pulse' : 'border-line text-fog'}>{item.severity}</Chip>}</div><p className="mt-2 text-[11px] text-fog">{item.classification}</p></li>)}</ul>}
    </Card>
  </div>;
}
