import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { isPsychiatryContext } from '../lib/activeClinicalEncounter';
import { isCurrentClinicEntitlementAllowed, loadCurrentClinicEntitlementState } from '../lib/clinicEntitlement';
import { hasProfessionalCapability, listPatientNexusResults, type NexusClinicalResult } from '../lib/nexusClinical';
import { listPatientNexusRecordIncorporations } from '../lib/nexusRecordIncorporation';
import type { ProfessionalIdentity } from '../lib/professionalIdentity';
import type { Appointment, Patient } from '../lib/types';
import { Chip } from '../lib/ui';
import { NexusSelfAssessmentInviteAction } from './NexusSelfAssessmentInviteAction';

export function ActiveEncounterClinicalTools({
  patient,
  encounter,
  identity,
}: {
  patient: Patient;
  encounter: Appointment;
  identity: ProfessionalIdentity | null;
}) {
  const psychiatry = isPsychiatryContext(identity?.professionalType, identity?.specialty);
  const [state, setState] = useState<{
    key: string;
    status: 'loading' | 'allowed' | 'denied' | 'error';
    canEem: boolean;
    canScales: boolean;
    results: NexusClinicalResult[];
    incorporatedResultIds: string[];
  }>(() => ({ key: '', status: 'loading', canEem: false, canScales: false, results: [], incorporatedResultIds: [] }));
  const key = `${patient.id}:${encounter.id}`;

  useEffect(() => {
    let active = true;
    const closed = { key, status: 'denied' as const, canEem: false, canScales: false, results: [] as NexusClinicalResult[], incorporatedResultIds: [] as string[] };
    if (!psychiatry) {
      setState(closed);
      return () => { active = false; };
    }

    setState({ ...closed, status: 'loading' });
    void Promise.all([
      loadCurrentClinicEntitlementState('nexus.access'),
      hasProfessionalCapability('nexus.access'),
      hasProfessionalCapability('nexus.eem'),
      hasProfessionalCapability('nexus.scales'),
    ]).then(async ([entitlement, canAccess, canEem, canScales]) => {
      if (!active) return;
      if (!isCurrentClinicEntitlementAllowed(entitlement) || !canAccess) {
        setState(closed);
        return;
      }
      try {
        const [results, incorporations] = await Promise.all([
          listPatientNexusResults(patient.id),
          listPatientNexusRecordIncorporations(patient.id),
        ]);
        if (active) setState({
          key,
          status: 'allowed',
          canEem,
          canScales,
          results,
          incorporatedResultIds: incorporations.map((item) => item.nexusResultId),
        });
      } catch (error) {
        console.error('[MedicsPro/Nexus] ferramentas do encounter:', error);
        if (active) setState({ ...closed, status: 'error' });
      }
    }).catch((error) => {
      console.error('[MedicsPro/Nexus] autorização do encounter:', error);
      if (active) setState({ ...closed, status: 'error' });
    });

    return () => { active = false; };
  }, [encounter.id, key, patient.id, psychiatry]);

  const visible = state.key === key ? state : { key, status: 'loading' as const, canEem: false, canScales: false, results: [] as NexusClinicalResult[], incorporatedResultIds: [] as string[] };
  const status = useMemo(() => {
    const incorporated = new Set(visible.incorporatedResultIds);
    const pendingReview = visible.results.filter((result) => result.processedAt && !result.reviewedAt).length;
    const pendingSignature = visible.results.filter((result) => result.reviewedAt && !result.signedAt).length;
    const readyToIncorporate = visible.results.filter((result) => result.lifecycleState === 'signed' && !incorporated.has(result.id)).length;
    return { pendingReview, pendingSignature, readyToIncorporate };
  }, [visible.incorporatedResultIds, visible.results]);

  // Specialty contextualizes only. It never opens Nexus. Loading/error/denied all fail closed.
  if (!psychiatry || visible.status !== 'allowed') return null;

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-aqua/25 bg-aqua/[0.035] p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-aqua">Ferramentas clínicas</p>
            <p className="mt-1 text-[12px] leading-relaxed text-fog">Nexus contextual ao atendimento atual. Autorização continua cumulativa por entitlement, capability e vínculo assistencial.</p>
          </div>
          <Chip className="border-aqua/30 text-aqua">Psiquiatria</Chip>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {visible.canEem && <ToolLink to={`/pacientes/${patient.id}/nexus/eem`} title="Exame do Estado Mental" detail="EEM · encontro atual" />}
          <ToolLink to={`/pacientes/${patient.id}/nexus/evolution`} title="Longitudinal" detail="comparabilidade C-05" />
          <ToolLink to={`/pacientes/${patient.id}/nexus`} title="Resultados Nexus" detail="revisão, assinatura e C-04" />
        </div>

        {(status.pendingReview > 0 || status.pendingSignature > 0 || status.readyToIncorporate > 0) && <div className="mt-3 flex flex-wrap gap-2">
          {status.pendingReview > 0 && <Chip className="border-amber/30 text-amber">{status.pendingReview} aguardando revisão</Chip>}
          {status.pendingSignature > 0 && <Chip className="border-amber/30 text-amber">{status.pendingSignature} aguardando assinatura</Chip>}
          {status.readyToIncorporate > 0 && <Chip className="border-mint/30 text-mint">{status.readyToIncorporate} pronto para incorporar</Chip>}
        </div>}
      </section>

      {visible.canScales && <NexusSelfAssessmentInviteAction patient={patient} appointmentId={encounter.id} />}
    </div>
  );
}

function ToolLink({ to, title, detail }: { to: string; title: string; detail: string }) {
  return <Link to={to} className="rounded-xl border border-line/75 bg-panel px-3.5 py-3 transition-colors hover:border-aqua/35 hover:bg-raise/40"><span className="block font-display text-[12.5px] font-semibold text-paper">{title}</span><span className="mt-1 block text-[10.5px] text-fog">{detail}</span></Link>;
}
