import { format } from 'date-fns';
import { activeEncounterStartedLabel } from '../../lib/clinicianDaily';
import type { Appointment } from '../../lib/types';
import { Btn } from '../../lib/ui';

export function ClinicianActiveEncounterBanner({
  encounter,
  patientLabel,
  now = new Date(),
  onContinue,
}: {
  encounter: Appointment;
  patientLabel: string;
  now?: Date;
  onContinue: () => void;
}) {
  const todayIso = format(now, 'yyyy-MM-dd');
  return (
    <section aria-label="Atendimento em andamento" className="rounded-[18px] border border-aqua/35 bg-aqua/[0.055] px-4 py-3.5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.13em] text-aqua">Atendimento em andamento</p>
          <p className="mt-1 truncate font-display text-[17px] font-semibold text-paper">{patientLabel}</p>
          <p className="mt-0.5 text-[11.5px] text-fog">{activeEncounterStartedLabel(encounter, now)} · {encounter.tipo}</p>
          {encounter.data !== todayIso && <p className="mt-1.5 text-[11px] text-amber">Atendimento aberto de uma data anterior.</p>}
        </div>
        <Btn onClick={onContinue}>Continuar atendimento</Btn>
      </div>
    </section>
  );
}
