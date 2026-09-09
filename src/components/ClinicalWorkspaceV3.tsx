import { useMemo } from 'react';
import { resolveOwnActiveEncounter } from '../lib/activeClinicalEncounter';
import { useAgenda } from '../lib/agendaContext';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { useInfrastructure } from '../lib/infrastructureContext';
import { professionalIdentityLabel } from '../lib/professionalIdentity';
import type { Appointment, Patient } from '../lib/types';
import { useProfessionalIdentity } from '../hooks/useProfessionalIdentity';
import { ActiveEncounterClinicalTools } from './ActiveEncounterClinicalTools';
import { ClinicalWorkspace } from './ClinicalWorkspace';
import { NexusRecordIncorporationPanel } from './NexusRecordIncorporationPanel';

export function ClinicalWorkspaceV3({ patient, initialSessionId = null }: { patient: Patient; initialSessionId?: string | null }) {
  const { user } = useCurrentUserAccess();
  const { appointments } = useAgenda();
  const { rooms, unidades } = useInfrastructure();
  const { identity, loading: identityLoading } = useProfessionalIdentity(user?.id);
  const activeEncounter = useMemo(
    () => resolveOwnActiveEncounter(appointments, patient.id, user?.id),
    [appointments, patient.id, user?.id],
  );

  const focusedSessionId = activeEncounter?.id ?? initialSessionId;

  if (activeEncounter) {
    return (
      <section className="overflow-hidden rounded-[26px] border border-amber/25 bg-panel shadow-[0_20px_52px_rgba(0,0,0,0.055)]">
        <ActiveEncounterHeader
          encounter={activeEncounter}
          patient={patient}
          professionalName={user?.nome ?? 'Profissional'}
          professionalRegistration={user?.registro ?? ''}
          profession={identityLoading ? 'Validando identidade…' : professionalIdentityLabel(identity)}
          specialty={identity?.specialty ?? null}
          roomName={rooms.find((room) => room.id === activeEncounter.roomId)?.nome ?? null}
          unitName={unidades.find((unit) => unit.id === rooms.find((room) => room.id === activeEncounter.roomId)?.unidadeId)?.nome ?? null}
        />

        <div className="space-y-4 px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
          {!identityLoading && <ActiveEncounterClinicalTools patient={patient} encounter={activeEncounter} identity={identity} userId={user?.id} />}
          <ClinicalWorkspace patient={patient} initialSessionId={focusedSessionId} />
          <NexusRecordIncorporationPanel patient={patient} />
        </div>
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-[26px] border border-line/75 bg-panel shadow-[0_20px_52px_rgba(0,0,0,0.055)]">
      <header className="border-b border-line/65 bg-[linear-gradient(135deg,color-mix(in_srgb,var(--color-mint)_8%,var(--color-panel)),var(--color-panel)_58%,color-mix(in_srgb,var(--color-aqua)_5%,var(--color-panel)))] px-5 py-5 lg:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-[12px] font-semibold uppercase tracking-[0.13em] text-mint">Prontuário longitudinal</p>
            <h2 className="mt-2 font-display text-[25px] font-bold leading-tight tracking-tight text-paper">História clínica, decisões e evolução em um único fluxo</h2>
            <p className="mt-2 text-[13.5px] leading-relaxed text-fog">
              Use este espaço para revisar contexto, registrar avaliações, evoluir atendimentos e acompanhar a continuidade do cuidado sem fragmentar a jornada do paciente.
            </p>
          </div>
          <div className="grid min-w-[260px] grid-cols-3 gap-2 text-center">
            <WorkspaceSignal label="Resumo" detail="visão rápida" />
            <WorkspaceSignal label="Avaliações" detail="estruturadas" />
            <WorkspaceSignal label="Evoluções" detail="por sessão" />
          </div>
        </div>
      </header>

      <div className="space-y-4 px-4 py-4 sm:px-5 lg:px-6 lg:py-5">
        <ClinicalWorkspace patient={patient} initialSessionId={focusedSessionId} />
        <NexusRecordIncorporationPanel patient={patient} />
      </div>
    </section>
  );
}

function ActiveEncounterHeader({
  encounter,
  patient,
  professionalName,
  professionalRegistration,
  profession,
  specialty,
  roomName,
  unitName,
}: {
  encounter: Appointment;
  patient: Patient;
  professionalName: string;
  professionalRegistration: string;
  profession: string;
  specialty: string | null;
  roomName: string | null;
  unitName: string | null;
}) {
  const date = new Date(`${encounter.data}T12:00:00`).toLocaleDateString('pt-BR');
  return (
    <header className="border-b border-amber/20 bg-amber/[0.035] px-5 py-4 lg:px-6">
      <div className="flex flex-wrap items-start gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-amber/35 bg-amber/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.1em] text-amber">Atendimento em andamento</span>
            <span className="font-mono text-[10.5px] text-fog">{date} · {encounter.inicio.slice(0, 5)}–{encounter.fim.slice(0, 5)}</span>
          </div>
          <h2 className="mt-2 font-display text-[22px] font-bold tracking-tight text-paper">{patient.preferredName || patient.nome}</h2>
          <p className="mt-1 text-[12px] text-fog">{encounter.tipo} · {unitName ?? 'Unidade não identificada'}{roomName ? ` · ${roomName}` : ''}</p>
        </div>
        <div className="min-w-[240px] rounded-xl border border-line/70 bg-deep/45 px-3.5 py-3">
          <p className="font-display text-[12.5px] font-semibold text-paper">{professionalName}</p>
          <p className="mt-1 text-[10.5px] text-fog">{profession}{specialty ? ` · ${specialty}` : ''}</p>
          {professionalRegistration && <p className="mt-1 font-mono text-[10px] text-fog">Registro {professionalRegistration}</p>}
        </div>
      </div>
    </header>
  );
}

function WorkspaceSignal({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-line/65 bg-deep/40 px-3 py-3">
      <p className="font-display text-[13px] font-semibold text-paper">{label}</p>
      <p className="mt-1 text-[10.5px] text-fog">{detail}</p>
    </div>
  );
}
