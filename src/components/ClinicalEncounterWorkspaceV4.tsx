import { useMemo, useRef, useState, type ReactNode } from 'react';
import { format, isSameDay, isYesterday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useClinicalCapability } from '../hooks/useClinicalCapability';
import { resolveOwnActiveEncounter } from '../lib/activeClinicalEncounter';
import { useAgenda } from '../lib/agendaContext';
import {
  buildEncounterEvolutionDraft,
  canFinalizeEncounter,
  hasOwnLinkedEncounterEvolution,
  longitudinalPatientContext,
  resolveEncounterProgress,
  type EncounterProgressItem,
} from '../lib/clinicalEncounterUx';
import { useClinical } from '../lib/clinicalContext';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { useFinance } from '../lib/financeContext';
import { updateAppointmentStatusVerified } from '../lib/appointmentOperations';
import { usePackages } from '../lib/packageContext';
import { professionalIdOf } from '../lib/professionalReference';
import type { ProfessionalIdentity } from '../lib/professionalIdentity';
import type { Appointment, Patient } from '../lib/types';
import { Btn, Card, Chip, Textarea } from '../lib/ui';
import { useToast } from '../lib/toastContext';
import { ActiveEncounterClinicalTools } from './ActiveEncounterClinicalTools';
import { ClinicalAssessmentRunner } from './ClinicalAssessmentRunner';
import { NexusRecordIncorporationPanel } from './NexusRecordIncorporationPanel';

export function ClinicalEncounterWorkspaceV4({
  patient,
  encounter,
  identity,
  historicalWorkspace,
}: {
  patient: Patient;
  encounter: Appointment;
  identity: ProfessionalIdentity | null;
  historicalWorkspace: ReactNode;
}) {
  const { user } = useCurrentUserAccess();
  const { appointments, refreshAgenda } = useAgenda();
  const { evolutions, consents, addEvolution } = useClinical();
  const { refreshFinance } = useFinance();
  const { refreshPackages } = usePackages();
  const { toast } = useToast();
  const attendCapability = useClinicalCapability('clinical.attend', user?.id);
  const evolutionCapability = useClinicalCapability('clinical.evolution.write', user?.id);
  const assessmentCapability = useClinicalCapability('clinical.assessment.apply', user?.id);
  const [evolutionText, setEvolutionText] = useState('');
  const [savingEvolution, setSavingEvolution] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const evolutionRef = useRef<HTMLElement | null>(null);

  const canonicalEncounter = useMemo(
    () => resolveOwnActiveEncounter(appointments, patient.id, user?.id),
    [appointments, patient.id, user?.id],
  );
  const isCurrentEncounter = Boolean(
    canonicalEncounter
    && canonicalEncounter.id === encounter.id
    && user?.id
    && professionalIdOf(canonicalEncounter) === user.id,
  );
  const hasLinkedEvolution = isCurrentEncounter
    && hasOwnLinkedEncounterEvolution(evolutions, encounter.id, user?.id);
  const canFinalize = canFinalizeEncounter({
    encounter: isCurrentEncounter ? canonicalEncounter : null,
    professionalId: user?.id,
    canAttend: attendCapability.allowed,
    canWriteEvolution: evolutionCapability.allowed,
    hasLinkedEvolution,
  });
  const progress = resolveEncounterProgress({
    canApplyAssessment: assessmentCapability.allowed,
    canWriteEvolution: evolutionCapability.allowed,
    hasLinkedEvolution,
    canFinalize,
  });
  const patientContext = longitudinalPatientContext(patient);
  const patientConsents = consents.filter((consent) => consent.pacienteId === patient.id);
  const currentEvolution = evolutions.find((evolution) => (
    evolution.sessionId === encounter.id
    && professionalIdOf(evolution) === user?.id
  ));

  if (!isCurrentEncounter || !canonicalEncounter) {
    // Context changed while the screen was mounted. Fail closed and fall back to
    // the existing longitudinal record instead of leaving stale encounter edits.
    return <>{historicalWorkspace}</>;
  }

  const registerEvolution = async () => {
    if (!user || !evolutionCapability.allowed || savingEvolution || hasLinkedEvolution) return;
    let draft;
    try {
      draft = buildEncounterEvolutionDraft({
        patient,
        encounter: canonicalEncounter,
        professionalId: user.id,
        text: evolutionText,
      });
    } catch {
      return;
    }

    setSavingEvolution(true);
    try {
      await addEvolution(draft);
      setEvolutionText('');
      toast('Evolução vinculada ao atendimento.');
    } catch (error) {
      console.error('[MedicsPro] evolução do encounter:', error);
      toast('Não foi possível registrar a evolução deste atendimento.', 'warn');
    } finally {
      setSavingEvolution(false);
    }
  };

  const finishEncounter = async () => {
    if (!canFinalize || finishing) return;
    setFinishing(true);
    try {
      try {
        await updateAppointmentStatusVerified(canonicalEncounter.id, 'finalizado');
      } catch (error) {
        console.error('[MedicsPro] finalizar encounter:', error);
        toast('Não foi possível finalizar o atendimento. Verifique os requisitos clínicos e tente novamente.', 'warn');
        return;
      }

      toast('Atendimento finalizado com a evolução vinculada.');
      const projections = await Promise.allSettled([
        refreshAgenda(),
        refreshFinance(),
        refreshPackages(),
      ]);
      if (projections.some((result) => result.status === 'rejected')) {
        toast('O atendimento foi finalizado, mas algumas listas não puderam ser atualizadas agora.', 'warn');
      }
    } finally {
      setFinishing(false);
    }
  };

  const scrollToEvolution = () => evolutionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <section data-clinical-encounter-mode="active" className="space-y-4">
      <EncounterHero patient={patient} encounter={canonicalEncounter} identity={identity} />

      <nav aria-label="Estado do atendimento" className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {progress.map((item) => <ProgressCard key={item.key} item={item} />)}
      </nav>

      <EncounterSection id="encounter-context" step="1" eyebrow="Contexto" title="Entenda o ponto de partida" detail="Informações do paciente ajudam a orientar a consulta, mas continuam pertencendo ao prontuário longitudinal.">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-line/70 bg-deep/35 p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-fog">{patientContext.eyebrow}</p>
            <p className="mt-3 text-[11px] font-semibold text-fog">{patientContext.complaintLabel}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-paper/90">{patientContext.complaint}</p>
          </div>
          <div className="rounded-2xl border border-line/70 bg-deep/35 p-4">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-fog">Prontuário longitudinal</p>
            <p className="mt-3 text-[11px] font-semibold text-fog">{patientContext.cidLabel}</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-paper/90">{patientContext.cid}</p>
            <p className="mt-3 text-[11px] text-fog">{patientConsents.filter((item) => item.assinado).length} consentimento(s) assinado(s) · documentos permanecem no histórico abaixo.</p>
          </div>
        </div>
      </EncounterSection>

      <EncounterSection id="encounter-assessment" step="2" eyebrow="Avaliação clínica" title="Avalie quando fizer sentido" detail="A avaliação estruturada é opcional nesta consulta e respeita a capability clínica do profissional.">
        {assessmentCapability.loading ? (
          <NeutralState>Validando acesso às avaliações clínicas…</NeutralState>
        ) : assessmentCapability.allowed ? (
          <ClinicalAssessmentRunner patient={patient} />
        ) : (
          <NeutralState>A aplicação de avaliações estruturadas não está liberada para este perfil. O histórico permanece disponível no prontuário longitudinal.</NeutralState>
        )}
      </EncounterSection>

      <EncounterSection id="encounter-tools" step="3" eyebrow="Instrumentos" title="Use ferramentas clínicas contextuais" detail="Ferramentas aparecem apenas quando os boundaries clínicos e de produto permitem. Especialidade organiza relevância; não concede acesso.">
        <ActiveEncounterClinicalTools patient={patient} encounter={canonicalEncounter} identity={identity} userId={user?.id} />
        <p className="rounded-xl border border-line/60 bg-deep/25 px-4 py-3 text-[11.5px] leading-relaxed text-fog">Nenhum instrumento é obrigatório para encerrar este atendimento. Use apenas os recursos pertinentes ao julgamento clínico.</p>
      </EncounterSection>

      <section ref={evolutionRef} id="encounter-evolution" className="scroll-mt-6">
        <EncounterSection step="4" eyebrow="Evolução" title={hasLinkedEvolution ? 'Evolução registrada ✓' : 'Registre o que aconteceu nesta consulta'} detail="A evolução é o registro encounter-scoped obrigatório para liberar a finalização e fica vinculada exatamente a esta sessão.">
          {hasLinkedEvolution ? (
            <div className="rounded-2xl border border-mint/30 bg-mint/[0.045] p-4">
              <div className="flex flex-wrap items-center gap-2"><Chip className="border-mint/35 text-mint">Evolução ✓</Chip><span className="font-mono text-[10.5px] text-fog">sessão {canonicalEncounter.inicio.slice(0, 5)} · autoria atual</span></div>
              {currentEvolution?.texto && <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-paper/90">{currentEvolution.texto}</p>}
            </div>
          ) : evolutionCapability.loading ? (
            <NeutralState>Validando permissão para registrar evolução…</NeutralState>
          ) : evolutionCapability.allowed ? (
            <div className="rounded-2xl border border-amber/25 bg-amber/[0.035] p-4">
              <p className="text-[11.5px] leading-relaxed text-fog">Este texto será salvo no prontuário com <span className="font-semibold text-paper">session_id = {canonicalEncounter.id.slice(0, 8)}…</span>. Não há seletor de outra sessão durante um atendimento ativo.</p>
              <Textarea className="mt-3" rows={7} value={evolutionText} onChange={(event) => setEvolutionText(event.target.value)} placeholder="Achados relevantes, evolução do quadro, conduta realizada, orientações e plano de continuidade…" />
              <div className="mt-3 flex justify-end"><Btn disabled={savingEvolution || !evolutionText.trim()} onClick={() => void registerEvolution()}>{savingEvolution ? 'Registrando…' : 'Registrar evolução'}</Btn></div>
            </div>
          ) : (
            <BlockedState title="Evolução indisponível">Seu acesso atual não permite registrar a evolução necessária para encerrar este atendimento.</BlockedState>
          )}
        </EncounterSection>
      </section>

      <EncounterSection id="encounter-continuity" step="5" eyebrow="Conduta / continuidade" title="Consolide o que deve seguir no prontuário" detail="Resultados Nexus só entram no registro oficial por incorporação explícita, preservando revisão, assinatura, origem e versão.">
        <NexusRecordIncorporationPanel patient={patient} />
        <NeutralState>Motivo desta consulta, HDA, hipótese e plano encounter-scoped ainda não possuem modelo próprio nesta versão. Esta tela não grava esses dados em campos longitudinais para simular contexto da consulta.</NeutralState>
      </EncounterSection>

      <EncounterSection id="encounter-closing" step="6" eyebrow="Encerramento" title={canFinalize ? 'Pronto para finalizar' : 'Ainda falta a evolução'} detail={canFinalize ? 'Os requisitos clínicos visíveis foram satisfeitos. A transição continua validada pelo PostgreSQL.' : 'Registre uma evolução vinculada a esta sessão para liberar o encerramento.'}>
        <div className={`rounded-2xl border p-4 ${canFinalize ? 'border-mint/30 bg-mint/[0.045]' : 'border-amber/30 bg-amber/[0.04]'}`}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[220px] flex-1">
              <p className={`font-display text-[15px] font-semibold ${canFinalize ? 'text-mint' : 'text-amber'}`}>{canFinalize ? 'Evolução vinculada · encerramento liberado' : 'Evolução ainda não registrada'}</p>
              <p className="mt-1 text-[11.5px] leading-relaxed text-fog">{canFinalize ? 'Finalizar mantém as proteções clínicas e a separação do ciclo financeiro.' : 'O banco também bloqueia a finalização sem evolução; a interface apenas antecipa essa regra.'}</p>
            </div>
            {!hasLinkedEvolution && evolutionCapability.allowed && <Btn variant="subtle" onClick={scrollToEvolution}>Registrar evolução</Btn>}
            <Btn disabled={!canFinalize || finishing} onClick={() => void finishEncounter()}>{finishing ? 'Finalizando…' : 'Finalizar atendimento'}</Btn>
          </div>
        </div>
      </EncounterSection>

      <details className="rounded-[22px] border border-line/70 bg-panel">
        <summary className="cursor-pointer list-none px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div><p className="font-display text-[14px] font-semibold text-paper">Prontuário longitudinal e histórico</p><p className="mt-1 text-[11.5px] text-fog">Resumo do paciente, avaliações anteriores, evoluções, atendimentos e documentos continuam disponíveis sem competir com a consulta atual.</p></div>
            <span className="text-fog" aria-hidden>⌄</span>
          </div>
        </summary>
        <div className="border-t border-line/65 p-4 sm:p-5">{historicalWorkspace}</div>
      </details>
    </section>
  );
}

export function EncounterHero({ patient, encounter, identity }: { patient: Patient; encounter: Appointment; identity: ProfessionalIdentity | null }) {
  const when = encounterTemporalLabel(encounter);
  return (
    <header className="overflow-hidden rounded-[26px] border border-aqua/30 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-aqua)_9%,var(--color-panel)),var(--color-panel)_58%,color-mix(in_srgb,var(--color-mint)_5%,var(--color-panel)))] shadow-[0_20px_52px_rgba(0,0,0,0.055)]">
      <div className="flex flex-wrap items-start gap-4 px-5 py-5 lg:px-6">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-aqua/35 bg-aqua/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-aqua">Atendimento em andamento</span><span className="font-mono text-[10.5px] text-fog">{when}</span></div>
          <h1 className="mt-3 font-display text-[28px] font-bold tracking-tight text-paper">{patient.preferredName || patient.nome}</h1>
          <p className="mt-1 text-[13px] text-fog">{encounter.tipo} · {encounter.inicio.slice(0, 5)}–{encounter.fim.slice(0, 5)}</p>
          <p className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-fog">Você está dentro desta consulta. Avalie, use instrumentos quando úteis, registre a evolução e encerre quando o atendimento estiver documentado.</p>
        </div>
        <div className="rounded-2xl border border-line/70 bg-deep/40 px-4 py-3 text-right">
          <p className="text-[10px] uppercase tracking-[0.1em] text-fog">Identidade clínica</p>
          <p className="mt-1.5 text-[12.5px] font-semibold text-paper">{identity?.professionalType || 'Profissional clínico'}</p>
          {identity?.specialty && <p className="mt-1 text-[10.5px] text-fog">{identity.specialty}</p>}
        </div>
      </div>
    </header>
  );
}

function EncounterSection({ id, step, eyebrow, title, detail, children }: { id?: string; step: string; eyebrow: string; title: string; detail: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6 rounded-[22px] border border-line/70 bg-panel p-4 sm:p-5">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line/80 bg-deep text-[11px] font-bold text-fog">{step}</span>
        <div><p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-aqua">{eyebrow}</p><h2 className="mt-1 font-display text-[18px] font-semibold text-paper">{title}</h2><p className="mt-1 text-[11.5px] leading-relaxed text-fog">{detail}</p></div>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ProgressCard({ item }: { item: EncounterProgressItem }) {
  const style = item.state === 'complete'
    ? 'border-mint/30 bg-mint/[0.045] text-mint'
    : item.state === 'pending'
      ? 'border-amber/30 bg-amber/[0.04] text-amber'
      : item.state === 'blocked'
        ? 'border-pulse/25 bg-pulse/[0.035] text-pulse'
        : item.state === 'optional'
          ? 'border-aqua/25 bg-aqua/[0.035] text-aqua'
          : 'border-line/70 bg-panel text-paper';
  return <div className={`rounded-2xl border px-3.5 py-3 ${style}`}><p className="text-[11.5px] font-semibold">{item.label}</p><p className="mt-1 text-[10px] text-fog">{item.detail}</p></div>;
}

function NeutralState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-line/65 bg-deep/30 px-4 py-3 text-[11.5px] leading-relaxed text-fog">{children}</div>;
}

function BlockedState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-xl border border-pulse/30 bg-pulse/[0.04] px-4 py-3"><p className="text-[12px] font-semibold text-pulse">{title}</p><p className="mt-1 text-[11.5px] leading-relaxed text-fog">{children}</p></div>;
}

export function encounterTemporalLabel(encounter: Appointment, now = new Date()): string {
  const date = new Date(`${encounter.data}T12:00:00`);
  const dayLabel = isSameDay(date, now) ? 'Hoje' : isYesterday(date) ? 'Ontem' : format(date, 'dd/MM/yyyy', { locale: ptBR });
  return `${dayLabel} · ${encounter.inicio.slice(0, 5)}`;
}
