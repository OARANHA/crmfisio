import { useMemo, useRef, useState, type ReactNode } from 'react';
import { format, isSameDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useClinicalCapability } from '../hooks/useClinicalCapability';
import { resolveOwnActiveEncounter } from '../lib/activeClinicalEncounter';
import { useAgenda } from '../lib/agendaContext';
import {
  canFinalizeEncounter,
  encounterWorkspaceNavigation,
  hasOwnLinkedEncounterEvolution,
  longitudinalPatientContext,
  resolveEncounterClosingState,
  type EncounterClosingPresentation,
} from '../lib/clinicalEncounterUx';
import { useClinical } from '../lib/clinicalContext';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { useFinance } from '../lib/financeContext';
import { updateAppointmentStatusVerified } from '../lib/appointmentOperations';
import { usePackages } from '../lib/packageContext';
import { professionalIdOf } from '../lib/professionalReference';
import type { ProfessionalIdentity } from '../lib/professionalIdentity';
import type { Appointment, Patient } from '../lib/types';
import { Btn, Chip } from '../lib/ui';
import { useToast } from '../lib/toastContext';
import { ActiveEncounterClinicalTools } from './ActiveEncounterClinicalTools';
import { ClinicalAssessmentRunner } from './ClinicalAssessmentRunner';
import { ClinicalEncounterRecordEditor } from './ClinicalEncounterRecordEditor';
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
  const { evolutions, consents, refreshClinical } = useClinical();
  const { refreshFinance } = useFinance();
  const { refreshPackages } = usePackages();
  const { toast } = useToast();
  const attendCapability = useClinicalCapability('clinical.attend', user?.id);
  const evolutionCapability = useClinicalCapability('clinical.evolution.write', user?.id);
  const assessmentCapability = useClinicalCapability('clinical.assessment.apply', user?.id);
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
  const closing = resolveEncounterClosingState({
    hasLinkedEvolution,
    attendStatus: attendCapability.status,
    evolutionWriteStatus: evolutionCapability.status,
    canFinalize,
  });
  const patientContext = longitudinalPatientContext(patient);
  const signedConsentCount = consents.filter((consent) => consent.pacienteId === patient.id && consent.assinado).length;
  const currentEvolution = evolutions.find((evolution) => (
    evolution.sessionId === encounter.id
    && professionalIdOf(evolution) === user?.id
  ));

  if (!isCurrentEncounter || !canonicalEncounter || !user) {
    return <>{historicalWorkspace}</>;
  }

  // Compatibility path only: appointments that already had a canonical
  // Evolution before #394 continue to use the existing verified finalization.
  const finishLegacyEncounter = async () => {
    if (!canFinalize || finishing) return;
    setFinishing(true);
    try {
      try {
        await updateAppointmentStatusVerified(canonicalEncounter.id, 'finalizado');
      } catch (error) {
        console.error('[MedicsPro] finalizar atendimento legado:', error);
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

  const afterStructuredFinalization = async () => {
    toast('Registro concluído e atendimento finalizado.');
    const projections = await Promise.allSettled([
      refreshClinical(),
      refreshAgenda(),
      refreshFinance(),
      refreshPackages(),
    ]);
    if (projections.some((result) => result.status === 'rejected')) {
      toast('O atendimento foi finalizado, mas algumas listas não puderam ser atualizadas agora.', 'warn');
    }
  };

  const scrollToRecord = () => evolutionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const closingStyle = closing.tone === 'ready'
    ? 'border-mint/30 bg-mint/[0.045]'
    : closing.tone === 'checking'
      ? 'border-aqua/30 bg-aqua/[0.035]'
      : closing.tone === 'pending'
        ? 'border-amber/30 bg-amber/[0.04]'
        : 'border-pulse/30 bg-pulse/[0.04]';
  const closingTitleStyle = closing.tone === 'ready'
    ? 'text-mint'
    : closing.tone === 'checking'
      ? 'text-aqua'
      : closing.tone === 'pending'
        ? 'text-amber'
        : 'text-pulse';

  const legacyEvolution = (
    <div className="rounded-2xl border border-mint/30 bg-mint/[0.045] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Chip className="border-mint/35 text-mint">Registrada no prontuário ✓</Chip>
        <span className="font-mono text-[10.5px] text-fog">consulta {canonicalEncounter.inicio.slice(0, 5)} · registro do profissional atual</span>
      </div>
      {currentEvolution?.texto && <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-paper/90">{currentEvolution.texto}</p>}
    </div>
  );

  return (
    <section data-clinical-encounter-mode="active" data-clinical-encounter-version="4.1" className="space-y-4">
      <div className="sticky top-3 z-20 space-y-2 rounded-[24px] bg-base/90 pb-2 backdrop-blur-xl">
        <EncounterHero patient={patient} encounter={canonicalEncounter} identity={identity} />
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line/70 bg-panel/95 px-3 py-2 shadow-sm">
          <nav aria-label="Navegação da consulta" className="flex min-w-0 flex-1 flex-wrap gap-1.5">
            {encounterWorkspaceNavigation.map((item) => (
              <a key={item.id} href={`#${item.id}`} className="rounded-lg px-2.5 py-1.5 text-[10.5px] font-semibold text-fog transition-colors hover:bg-raise/60 hover:text-paper">
                {item.label}
              </a>
            ))}
          </nav>
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Estado clínico da consulta">
            <Chip className={hasLinkedEvolution ? 'border-mint/35 text-mint' : 'border-amber/35 text-amber'}>
              {hasLinkedEvolution ? 'Evolução registrada ✓' : 'Registro em elaboração'}
            </Chip>
            {hasLinkedEvolution && <ClosingChip closing={closing} />}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="min-w-0 space-y-4">
          <EncounterSection id="encounter-context" eyebrow="Contexto" title="Ponto de partida" detail="Informações já registradas no prontuário ajudam a orientar o atendimento atual.">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-line/60 bg-deep/30 p-4">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-fog">{patientContext.eyebrow}</p>
                <p className="mt-3 text-[11px] font-semibold text-fog">{patientContext.complaintLabel}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-paper/90">{patientContext.complaint}</p>
              </div>
              <div className="rounded-2xl border border-line/60 bg-deep/30 p-4">
                <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-fog">Prontuário longitudinal</p>
                <p className="mt-3 text-[11px] font-semibold text-fog">{patientContext.cidLabel}</p>
                <p className="mt-1.5 text-[14px] leading-relaxed text-paper/90">{patientContext.cid}</p>
                <p className="mt-3 text-[11px] text-fog">{signedConsentCount} consentimento(s) assinado(s) · documentos e registros anteriores permanecem no histórico.</p>
              </div>
            </div>
          </EncounterSection>

          <section ref={evolutionRef} className="scroll-mt-36">
            <EncounterSection id="encounter-evolution" eyebrow="Registro clínico" title={hasLinkedEvolution ? 'Evolução registrada ✓' : 'Registro da consulta'} detail={hasLinkedEvolution ? 'Evolução já vinculada a este atendimento.' : 'Registre a consulta uma única vez e conclua quando estiver pronto.'}>
              {hasLinkedEvolution ? (
                <ClinicalEncounterRecordEditor
                  patient={patient}
                  encounter={canonicalEncounter}
                  userId={user.id}
                  hasLinkedEvolution
                  legacyFallback={legacyEvolution}
                  onFinalized={afterStructuredFinalization}
                />
              ) : attendCapability.loading || evolutionCapability.loading ? (
                <NeutralState>Verificando acesso ao registro da consulta…</NeutralState>
              ) : attendCapability.error || evolutionCapability.error ? (
                <BlockedState title="Não foi possível verificar seu acesso">Tente novamente antes de registrar ou concluir o atendimento.</BlockedState>
              ) : attendCapability.allowed && evolutionCapability.allowed ? (
                <ClinicalEncounterRecordEditor
                  patient={patient}
                  encounter={canonicalEncounter}
                  userId={user.id}
                  hasLinkedEvolution={false}
                  legacyFallback={legacyEvolution}
                  onFinalized={afterStructuredFinalization}
                />
              ) : (
                <BlockedState title="Registro clínico indisponível">Seu acesso atual não permite registrar e concluir este atendimento.</BlockedState>
              )}
            </EncounterSection>
          </section>

          <EncounterSection id="encounter-assessment" eyebrow="Avaliação clínica" title="Avaliação estruturada" detail="Avaliação estruturada opcional para esta consulta.">
            {assessmentCapability.loading ? (
              <NeutralState>Carregando avaliações clínicas…</NeutralState>
            ) : assessmentCapability.error ? (
              <BlockedState title="Não foi possível verificar o acesso às avaliações">Tente novamente em instantes ou atualize a página.</BlockedState>
            ) : assessmentCapability.allowed ? (
              <ClinicalAssessmentRunner patient={patient} presentation="encounter" />
            ) : (
              <NeutralState>Avaliações estruturadas não estão disponíveis para seu perfil neste atendimento.</NeutralState>
            )}
          </EncounterSection>

          <EncounterSection id="encounter-tools" eyebrow="Ferramentas clínicas" title="Recursos disponíveis para este atendimento" detail="Use os recursos disponíveis conforme a necessidade clínica.">
            <ActiveEncounterClinicalTools patient={patient} encounter={canonicalEncounter} identity={identity} userId={user.id} />
          </EncounterSection>

          <EncounterSection id="encounter-continuity" eyebrow="Conduta e continuidade" title="Continuidade do cuidado" detail="Registre ou consulte informações relevantes para a continuidade do cuidado.">
            <NexusRecordIncorporationPanel patient={patient} />
          </EncounterSection>

          <EncounterSection id="encounter-closing" eyebrow="Encerramento" title={hasLinkedEvolution ? closing.sectionTitle : 'Concluir registro da consulta'} detail={hasLinkedEvolution ? closing.sectionDetail : 'A conclusão é feita a partir do registro acima, sem digitar uma segunda evolução.'}>
            {hasLinkedEvolution ? (
              <div className={`rounded-2xl border p-4 ${closingStyle}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-[220px] flex-1">
                    <p className={`font-display text-[15px] font-semibold ${closingTitleStyle}`}>{closing.noticeTitle}</p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-fog">{closing.noticeDetail}</p>
                  </div>
                  <Btn disabled={!canFinalize || finishing} onClick={() => void finishLegacyEncounter()}>{finishing ? 'Finalizando…' : 'Finalizar atendimento'}</Btn>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-line/70 bg-deep/30 p-4">
                <p className="text-[12px] leading-relaxed text-fog">Salve o registro da consulta e use <span className="font-semibold text-paper">Revisar e concluir</span>. O conteúdo será transformado na evolução oficial e o atendimento será encerrado na mesma confirmação.</p>
                <Btn className="mt-3" variant="subtle" onClick={scrollToRecord}>Ir para o registro da consulta</Btn>
              </div>
            )}
          </EncounterSection>
        </main>

        <aside aria-label="Contexto persistente da consulta" className="space-y-3 xl:sticky xl:top-36">
          <ConsultationStateCard closing={closing} hasLinkedEvolution={hasLinkedEvolution} onRegisterEvolution={scrollToRecord} />
          <div className="rounded-[20px] border border-line/70 bg-panel p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog">Paciente em contexto</p>
            <p className="mt-2 font-display text-[17px] font-semibold text-paper">{patient.preferredName || patient.nome}</p>
            <p className="mt-1 text-[11px] text-fog">{canonicalEncounter.tipo} · {canonicalEncounter.inicio.slice(0, 5)}–{canonicalEncounter.fim.slice(0, 5)}</p>
            <dl className="mt-4 space-y-3 text-[11px]">
              <div><dt className="text-fog">CID-10 longitudinal</dt><dd className="mt-0.5 font-medium text-paper/90">{patientContext.cid}</dd></div>
              <div><dt className="text-fog">Consentimentos assinados</dt><dd className="mt-0.5 font-medium text-paper/90">{signedConsentCount}</dd></div>
            </dl>
            <a href="#encounter-history" className="mt-4 inline-flex text-[11px] font-semibold text-aqua hover:underline">Abrir prontuário longitudinal ↓</a>
          </div>
        </aside>
      </div>

      <details id="encounter-history" className="scroll-mt-36 rounded-[22px] border border-line/70 bg-panel">
        <summary className="cursor-pointer list-none px-5 py-4">
          <div className="flex items-center justify-between gap-4">
            <div><p className="font-display text-[14px] font-semibold text-paper">Prontuário longitudinal e histórico</p><p className="mt-1 text-[11.5px] text-fog">Resumo do paciente, avaliações anteriores, evoluções, atendimentos e documentos continuam disponíveis como referência secundária, sem substituir a consulta atual.</p></div>
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
    <header className="overflow-hidden rounded-[22px] border border-aqua/30 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-aqua)_9%,var(--color-panel)),var(--color-panel)_58%,color-mix(in_srgb,var(--color-mint)_5%,var(--color-panel)))] shadow-[0_16px_40px_rgba(0,0,0,0.05)]">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3.5 lg:px-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><span className="rounded-full border border-aqua/35 bg-aqua/[0.08] px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-[0.12em] text-aqua">Consulta em andamento</span><span className="font-mono text-[10.5px] text-fog">{when}</span></div>
          <div className="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><h1 className="font-display text-[22px] font-bold tracking-tight text-paper">{patient.preferredName || patient.nome}</h1><p className="text-[11.5px] text-fog">{encounter.tipo} · {encounter.inicio.slice(0, 5)}–{encounter.fim.slice(0, 5)}</p></div>
        </div>
        <div className="rounded-xl border border-line/70 bg-deep/35 px-3 py-2 text-right">
          <p className="text-[9px] uppercase tracking-[0.1em] text-fog">Identidade clínica</p>
          <p className="mt-1 text-[11.5px] font-semibold text-paper">{identity?.professionalType || 'Profissional clínico'}</p>
          {identity?.specialty && <p className="mt-0.5 text-[9.5px] text-fog">{identity.specialty}</p>}
        </div>
      </div>
    </header>
  );
}

function EncounterSection({ id, eyebrow, title, detail, children }: { id: string; eyebrow: string; title: string; detail: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-36 rounded-[22px] border border-line/70 bg-panel p-4 sm:p-5">
      <div className="mb-4">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-aqua">{eyebrow}</p>
        <h2 className="mt-1 font-display text-[18px] font-semibold text-paper">{title}</h2>
        <p className="mt-1 text-[11.5px] leading-relaxed text-fog">{detail}</p>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function ConsultationStateCard({
  closing,
  hasLinkedEvolution,
  onRegisterEvolution,
}: {
  closing: EncounterClosingPresentation;
  hasLinkedEvolution: boolean;
  onRegisterEvolution: () => void;
}) {
  const persistence = hasLinkedEvolution
    ? { label: 'Evolução confirmada ✓', className: 'border-mint/30 text-mint' }
    : { label: 'Registro em elaboração', className: 'border-amber/30 text-amber' };

  return (
    <div className="rounded-[20px] border border-line/70 bg-panel p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog">Estado da consulta</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip className={persistence.className}>{persistence.label}</Chip>
        {hasLinkedEvolution && <ClosingChip closing={closing} />}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-fog">{hasLinkedEvolution ? 'A evolução está vinculada a este atendimento.' : 'Registre a consulta e conclua quando o conteúdo estiver pronto.'}</p>
      {!hasLinkedEvolution && <Btn className="mt-3 w-full" variant="subtle" onClick={onRegisterEvolution}>Ir para o registro</Btn>}
      <a href="#encounter-closing" className="mt-3 inline-flex text-[11px] font-semibold text-aqua hover:underline">Ver encerramento ↓</a>
    </div>
  );
}

function ClosingChip({ closing }: { closing: EncounterClosingPresentation }) {
  const className = closing.tone === 'ready'
    ? 'border-mint/35 text-mint'
    : closing.tone === 'pending'
      ? 'border-amber/35 text-amber'
      : closing.tone === 'checking'
        ? 'border-aqua/35 text-aqua'
        : 'border-pulse/35 text-pulse';
  return <Chip className={className}>{closing.progressDetail}</Chip>;
}

function NeutralState({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-line/65 bg-deep/30 px-4 py-3 text-[11.5px] leading-relaxed text-fog">{children}</div>;
}

function BlockedState({ title, children }: { title: string; children: ReactNode }) {
  return <div className="rounded-xl border border-pulse/30 bg-pulse/[0.04] px-4 py-3"><p className="text-[12px] font-semibold text-pulse">{title}</p><p className="mt-1 text-[11.5px] leading-relaxed text-fog">{children}</p></div>;
}

export function encounterTemporalLabel(encounter: Appointment, now = new Date()): string {
  const date = new Date(`${encounter.data}T12:00:00`);
  const dayLabel = isSameDay(date, now) ? 'Hoje' : isSameDay(date, subDays(now, 1)) ? 'Ontem' : format(date, 'dd/MM/yyyy', { locale: ptBR });
  return `${dayLabel} · ${encounter.inicio.slice(0, 5)}`;
}
