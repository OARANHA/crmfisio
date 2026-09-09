import { useMemo } from 'react';
import { useProfessionalIdentity } from '../hooks/useProfessionalIdentity';
import { useAgenda } from '../lib/agendaContext';
import { resolveClinicalEncounterWorkspace } from '../lib/clinicalEncounterUx';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import type { Patient } from '../lib/types';
import { ClinicalEncounterWorkspaceV4 } from './ClinicalEncounterWorkspaceV4';
import { ClinicalWorkspace } from './ClinicalWorkspace';
import { NexusRecordIncorporationPanel } from './NexusRecordIncorporationPanel';

export function ClinicalWorkspaceV3({ patient, initialSessionId = null }: { patient: Patient; initialSessionId?: string | null }) {
  const { user } = useCurrentUserAccess();
  const { appointments } = useAgenda();
  const { identity } = useProfessionalIdentity(user?.id);
  const resolution = useMemo(
    () => resolveClinicalEncounterWorkspace(appointments, patient.id, user?.id, initialSessionId),
    [appointments, initialSessionId, patient.id, user?.id],
  );

  const historicalWorkspace = (
    <ClinicalWorkspace patient={patient} initialSessionId={resolution.focusedSessionId} />
  );

  if (resolution.mode === 'encounter' && resolution.encounter) {
    return (
      <ClinicalEncounterWorkspaceV4
        patient={patient}
        encounter={resolution.encounter}
        identity={identity}
        historicalWorkspace={historicalWorkspace}
      />
    );
  }

  return (
    <section data-clinical-encounter-mode="longitudinal" className="overflow-hidden rounded-[26px] border border-line/75 bg-panel shadow-[0_20px_52px_rgba(0,0,0,0.055)]">
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
        {historicalWorkspace}
        <NexusRecordIncorporationPanel patient={patient} />
      </div>
    </section>
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
