import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ageFrom, maskCpf, STAGE_META, type Patient, type PatientGuardian } from '../lib/types';
import { loadPatientRegistryExtras } from '../lib/patientRegistry';
import { Chip, IconMail, IconPhone } from '../lib/ui';
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
  const primaryGuardian = extras?.guardians.find((item) => item.isPrimaryContact) ?? extras?.guardians[0];
  const emergencyContact = extras?.guardians.find((item) => item.isEmergencyContact && item.id !== primaryGuardian?.id);
  const displayName = extras?.preferredName || patient.nome;

  return (
    <section className="relative overflow-hidden rounded-[24px] border border-line/75 bg-panel px-5 py-5 shadow-[0_14px_42px_rgba(0,0,0,0.045)] lg:px-6">
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-mint/80" />
      <div className="flex flex-wrap items-start gap-5">
        <div className="h-[76px] w-[76px] shrink-0 overflow-hidden rounded-2xl border border-line bg-mint/10 ring-4 ring-deep/55">
          {extras?.avatarUrl ? <img src={extras.avatarUrl} alt={`Foto de ${patient.nome}`} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center font-display text-[24px] font-bold text-mint">{initials}</span>}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fog">Paciente</p>
              <h1 className="mt-1 font-display text-[28px] font-bold leading-tight tracking-tight text-paper">{displayName}</h1>
            </div>
            <div className="flex flex-wrap gap-2 self-end pb-0.5">
              <Chip className={sm.chip}>{sm.label}</Chip>
              {patient.status === 'ativo' && <Chip className="border-mint/30 bg-mint/[0.06] text-mint">ativo</Chip>}
              {patient.status === 'inativo' && <Chip className="border-pulse/40 text-pulse">inativo</Chip>}
              {patient.status === 'alta' && <Chip className="border-aqua/40 text-aqua">alta</Chip>}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-fog">
            {extras?.preferredName && extras.preferredName !== patient.nome && <span>Nome civil: <strong className="font-medium text-paper/85">{patient.nome}</strong></span>}
            <span>{ageFrom(patient.nascimento)} anos</span>
            <span className="inline-flex items-center gap-1.5"><IconLock className="h-3.5 w-3.5 text-pulse" />{maskCpf(patient.cpf)}</span>
            {patient.telefone && <span className="inline-flex items-center gap-1.5"><IconPhone className="h-3.5 w-3.5" />{patient.telefone}</span>}
            {patient.email && <span className="inline-flex items-center gap-1.5"><IconMail className="h-3.5 w-3.5" />{patient.email}</span>}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${patient.optInWhats ? 'border-mint/30 bg-mint/[0.06] text-mint' : 'border-line text-fog'}`}>
              WhatsApp {patient.optInWhats ? 'autorizado' : 'sem opt-in'}
            </span>
            {patient.convenio && <span className="rounded-full border border-line px-2.5 py-1 text-[11.5px] font-semibold text-fog">{patient.convenio}</span>}
            {extras?.insuranceNumber && <span className="rounded-full border border-line px-2.5 py-1 text-[11.5px] font-semibold text-fog">Carteirinha {extras.insuranceNumber}</span>}
          </div>

          {(primaryGuardian || emergencyContact) && (
            <div className="mt-4 grid gap-2 border-t border-line/55 pt-4 lg:grid-cols-2">
              {primaryGuardian && (
                <div className="rounded-xl bg-deep/30 px-3.5 py-3 text-[12.5px] text-fog">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fog/75">Contato principal</p>
                  <p className="mt-1 font-medium text-paper/90">{primaryGuardian.name} · {primaryGuardian.relationship}</p>
                  {primaryGuardian.phone && <p className="mt-0.5">{primaryGuardian.phone}</p>}
                </div>
              )}
              {emergencyContact && (
                <div className="rounded-xl border border-pulse/20 bg-pulse/[0.04] px-3.5 py-3 text-[12.5px] text-pulse">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em]">Contato de emergência</p>
                  <p className="mt-1 font-medium">{emergencyContact.name}{emergencyContact.phone ? ` · ${emergencyContact.phone}` : ''}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex w-full flex-wrap items-center gap-2 lg:w-auto lg:max-w-[260px] lg:justify-end">
          <Link to={`/pacientes/${patient.id}/editar`} className="inline-flex min-h-10 items-center justify-center rounded-xl border border-line bg-deep/35 px-3.5 py-2 text-[12.5px] font-semibold text-fog transition-colors hover:border-line2 hover:bg-raise hover:text-paper">Editar cadastro</Link>
          <PatientJourneyControl patient={patient} />
        </div>
      </div>
    </section>
  );
}
