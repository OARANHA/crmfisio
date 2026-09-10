import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { isCurrentClinicEntitlementAllowed, loadCurrentClinicEntitlementState } from '../lib/clinicEntitlement';
import { buildEncounterScopedNexusPath } from '../lib/clinicalEncounterUx';
import { hasProfessionalCapability, listPatientNexusResults, type NexusClinicalResult } from '../lib/nexusClinical';
import { listPatientNexusRecordIncorporations } from '../lib/nexusRecordIncorporation';
import {
  nexusClinicalToolContextKey,
  resolveNexusClinicalTools,
  type NexusClinicalToolBoundaryState,
  type ResolvedNexusClinicalTool,
} from '../lib/nexus/clinicalToolRegistry';
import type { ProfessionalIdentity } from '../lib/professionalIdentity';
import type { Appointment, Patient } from '../lib/types';
import { Chip } from '../lib/ui';
import { NexusSelfAssessmentInviteAction } from './NexusSelfAssessmentInviteAction';

type NexusEncounterToolState = {
  key: string;
  boundaryState: NexusClinicalToolBoundaryState;
  entitlementAllowed: boolean;
  nexusAccess: boolean;
  canEem: boolean;
  canScales: boolean;
  results: NexusClinicalResult[];
  incorporatedResultIds: string[];
};

const emptyToolState = (key: string, boundaryState: NexusClinicalToolBoundaryState): NexusEncounterToolState => ({
  key,
  boundaryState,
  entitlementAllowed: false,
  nexusAccess: false,
  canEem: false,
  canScales: false,
  results: [],
  incorporatedResultIds: [],
});

export function ActiveEncounterClinicalTools({
  patient,
  encounter,
  identity,
  userId,
}: {
  patient: Patient;
  encounter: Appointment;
  identity: ProfessionalIdentity | null;
  userId: string | null | undefined;
}) {
  const key = nexusClinicalToolContextKey({ userId, patientId: patient.id, encounterId: encounter.id });
  const [state, setState] = useState<NexusEncounterToolState>(() => emptyToolState('', 'loading'));

  useEffect(() => {
    let active = true;
    const loading = emptyToolState(key, 'loading');
    const closed = emptyToolState(key, 'ready');

    setState(loading);
    if (!userId) {
      setState(closed);
      return () => { active = false; };
    }

    void Promise.all([
      loadCurrentClinicEntitlementState('nexus.access'),
      hasProfessionalCapability('nexus.access'),
      hasProfessionalCapability('nexus.eem'),
      hasProfessionalCapability('nexus.scales'),
    ]).then(async ([entitlement, nexusAccess, canEem, canScales]) => {
      if (!active) return;
      const entitlementAllowed = isCurrentClinicEntitlementAllowed(entitlement);
      if (!entitlementAllowed || !nexusAccess) {
        setState({ ...closed, entitlementAllowed, nexusAccess });
        return;
      }

      try {
        const [results, incorporations] = await Promise.all([
          listPatientNexusResults(patient.id),
          listPatientNexusRecordIncorporations(patient.id),
        ]);
        if (!active) return;
        setState({
          key,
          boundaryState: 'ready',
          entitlementAllowed,
          nexusAccess,
          canEem,
          canScales,
          results,
          incorporatedResultIds: incorporations.map((item) => item.nexusResultId),
        });
      } catch (error) {
        console.error('[MedicsPro/Nexus] ferramentas do encounter:', error);
        if (active) setState(emptyToolState(key, 'error'));
      }
    }).catch((error) => {
      console.error('[MedicsPro/Nexus] autorização do encounter:', error);
      if (active) setState(emptyToolState(key, 'error'));
    });

    return () => { active = false; };
  }, [key, patient.id, userId]);

  const visible = state.key === key ? state : emptyToolState(key, 'loading');
  const tools = useMemo(() => resolveNexusClinicalTools({
    state: visible.boundaryState,
    entitlementAllowed: visible.entitlementAllowed,
    nexusAccess: visible.nexusAccess,
    capabilities: {
      'nexus.eem': visible.canEem,
      'nexus.scales': visible.canScales,
    },
  }, identity), [
    identity,
    visible.boundaryState,
    visible.canEem,
    visible.canScales,
    visible.entitlementAllowed,
    visible.nexusAccess,
  ]);
  const lifecycle = useMemo(() => {
    const incorporated = new Set(visible.incorporatedResultIds);
    const pendingReview = visible.results.filter((result) => result.processedAt && !result.reviewedAt).length;
    const pendingSignature = visible.results.filter((result) => result.reviewedAt && !result.signedAt).length;
    const readyToIncorporate = visible.results.filter((result) => result.lifecycleState === 'signed' && !incorporated.has(result.id)).length;
    return { pendingReview, pendingSignature, readyToIncorporate };
  }, [visible.incorporatedResultIds, visible.results]);

  // Availability comes from entitlement + server-side C-06 capability resolution.
  // Specialty only changes presentation level/order in the pure registry resolver.
  if (tools.length === 0) return null;

  const hasContextualHighlight = tools.some((tool) => tool.level === 'relevant');
  const canUseScales = tools.some((tool) => tool.id === 'mental-health-screening');

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-aqua/25 bg-aqua/[0.035] p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-aqua">Ferramentas clínicas</p>
            <p className="mt-1 text-[12px] leading-relaxed text-fog">Nexus disponível para este atendimento conforme entitlement, capabilities e vínculo assistencial já validados pelos boundaries clínicos.</p>
          </div>
          <Chip className="border-aqua/30 text-aqua">{hasContextualHighlight ? 'Em destaque para este contexto' : 'Disponível'}</Chip>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {tools.map((tool) => <ClinicalTool key={tool.id} tool={tool} patientId={patient.id} appointmentId={encounter.id} />)}
        </div>

        {(lifecycle.pendingReview > 0 || lifecycle.pendingSignature > 0 || lifecycle.readyToIncorporate > 0) && <div className="mt-3 flex flex-wrap gap-2">
          {lifecycle.pendingReview > 0 && <Chip className="border-amber/30 text-amber">{lifecycle.pendingReview} aguardando revisão</Chip>}
          {lifecycle.pendingSignature > 0 && <Chip className="border-amber/30 text-amber">{lifecycle.pendingSignature} aguardando assinatura</Chip>}
          {lifecycle.readyToIncorporate > 0 && <Chip className="border-mint/30 text-mint">{lifecycle.readyToIncorporate} pronto para incorporar</Chip>}
        </div>}
      </section>

      {canUseScales && <NexusSelfAssessmentInviteAction key={key} patient={patient} appointmentId={encounter.id} />}
    </div>
  );
}

function ClinicalTool({ tool, patientId, appointmentId }: { tool: ResolvedNexusClinicalTool; patientId: string; appointmentId: string }) {
  const content = <>
    <span className="block font-display text-[12.5px] font-semibold text-paper">{tool.title}</span>
    <span className="mt-1 block text-[10.5px] text-fog">{tool.detail}</span>
    {tool.level === 'relevant' && <span className="mt-1.5 block text-[9.5px] font-semibold uppercase tracking-[0.08em] text-aqua">Em destaque para este contexto</span>}
  </>;

  if (tool.routeSuffix === null) {
    return <div className="rounded-xl border border-line/75 bg-panel px-3.5 py-3">{content}</div>;
  }

  return <Link to={buildEncounterScopedNexusPath(patientId, appointmentId, tool.routeSuffix)} className="rounded-xl border border-line/75 bg-panel px-3.5 py-3 transition-colors hover:border-aqua/35 hover:bg-raise/40">{content}</Link>;
}
