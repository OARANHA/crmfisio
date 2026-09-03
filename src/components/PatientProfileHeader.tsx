import { useEffect, useState } from 'react';
import { ageFrom, maskCpf, STAGE_META, type Patient, type PatientGuardian } from '../lib/types';
import { loadPatientRegistryExtras } from '../lib/patientRegistry';
import { Card, Chip, IconMail, IconPhone } from '../lib/ui';
import { IconLock } from './icons';
import { PatientJourneyControl } from './PatientJourneyControl';

interface Extras {
  preferredName: string;
  addressLine: string;
  insuranceNumber: string;
  administrativeNotes: string;
  avatarPath: string | null;
  avatarUrl: string | null;
  guardians: PatientGuardian[];
}

export function PatientProfileHeader({ patient }: { patient: Patient }) {
  const [extras, setExtras] = useState<Extras | null>(null);

  useEffect(() => {
    let active = true;
    loadPatientRegistryExtras(patient.id)
      .then((data) => active && setExtras(data))
      .catch((error) => console.warn('[MedicsPro] dados complementares do paciente:', error));
    return () => { active = false; };
  }, [patient.id]);

  const sm = STAGE_META[patient.funilStage];
  const initials = patient.nome.split(' ').map((word) => word[0]).slice(0, 2).join('').toUpperCase();
  const primaryGuardian = extras?.guardians.find((guardian) => guardian.isPrimaryContact) ?? extras?.guardians[0];

  return (
    <Card>
      <div className="flex flex-wrap items-start gap-5 px-5 py-4">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl border border-line bg-mint/10">
          {extras?.avatarUrl ? (
            <img src={extras.avatarUrl} alt={`Foto de ${patient.nome}`} className="h-full w-full object-cover" />
          ) : (
            <span className="grid h-full w-full place-items-center font-display text-xl font-bold text-mint">{initials}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-2xl font-bold tracking-tight">{extras?.preferredName || patient.nome}</h1>
            {extras?.preferredName && extras.preferredName !== patient.nome && <span className="text-[12.5px] text-fog">cadastro: {patient.nome}</span>}
            <Chip className={sm.chip}>{sm.label}</Chip>
            {patient.status === 'inativo' && <Chip className="border-pulse/40 text-pulse">inativo · oportunidade de reativação</Chip>}
            {patient.status === 'alta' && <Chip className="border-aqua/40 text-aqua">alta registrada · histórico preservado</Chip>}
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-fog">
            <span>{ageFrom(patient.nascimento)} anos</span>
            <span className="inline-flex items-center gap-1.5"><IconLock className="h-3.5 w-3.5 text-pulse" />{maskCpf(patient.cpf)}</span>
            {patient.telefone && <span className="inline-flex items-center gap-1.5"><IconPhone className="h-3.5 w-3.5" />{patient.telefone}</span>}
            {patient.email && <span className="inline-flex items-center gap-1.5"><IconMail className="h-3.5 w-3.5" />{patient.email}</span>}
            <span className={patient.optInWhats ? 'text-mint' : 'text-fog/70'}>WhatsApp {patient.optInWhats ? 'autorizado' : 'sem opt-in'}</span>
          </div>

          {primaryGuardian && (
            <div className="mt-3 inline-flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl bg-deep/70 px-3 py-2 text-[12.5px]">
              <span className="font-semibold">Responsável: {primaryGuardian.name}</span>
              <span className="text-fog">{primaryGuardian.relationship}</span>
              {primaryGuardian.phone && <span className="text-fog">{primaryGuardian.phone}</span>}
              {primaryGuardian.isFinancialResponsible && <span className="text-amber">financeiro</span>}
              {primaryGuardian.isLegalGuardian && <span className="text-mint">legal</span>}
            </div>
          )}
        </div>

        <PatientJourneyControl patient={patient} />
      </div>
    </Card>
  );
}
