import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ageFrom, maskCpf, STAGE_META, type Patient, type PatientGuardian } from '../lib/types';
import { loadPatientRegistryExtras } from '../lib/patientRegistry';
import { useApp } from '../lib/store';
import { isClinicManager } from '../lib/permissions';
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
  const { user } = useApp();
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
  const canSeeClinical = user?.role === 'fisio' || isClinicManager(user?.role);

  return (
    <section className="rounded-2xl border border-line/80 bg-panel/85 px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <div className="h-[68px] w-[68px] shrink-0 overflow-hidden rounded-full border border-line bg-mint/10 ring-4 ring-deep/70">
          {extras?.avatarUrl ? <img src={extras.avatarUrl} alt={`Foto de ${patient.nome}`} className="h-full w-full object-cover" /> : <span className="grid h-full w-full place-items-center font-display text-xl font-bold text-mint">{initials}</span>}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="font-display text-[26px] font-bold tracking-tight text-paper">{displayName}</h1>
            <Chip className={sm.chip}>{sm.label}</Chip>
            {patient.status === 'inativo' && <Chip className="border-pulse/40 text-pulse">inativo</Chip>}
            {patient.status === 'alta' && <Chip className="border-aqua/40 text-aqua">alta</Chip>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-fog">
            {extras?.preferredName && extras.preferredName !== patient.nome && <span>Nome civil: {patient.nome}</span>}
            <span>{ageFrom(patient.nascimento)} anos</span>
            <span className="inline-flex items-center gap-1.5"><IconLock className="h-3.5 w-3.5 text-pulse" />{maskCpf(patient.cpf)}</span>
            {patient.telefone && <span className="inline-flex items-center gap-1.5"><IconPhone className="h-3.5 w-3.5" />{patient.telefone}</span>}
            {patient.email && <span className="inline-flex items-center gap-1.5"><IconMail className="h-3.5 w-3.5" />{patient.email}</span>}
            <span className={patient.optInWhats ? 'font-medium text-mint' : 'text-fog/70'}>WhatsApp {patient.optInWhats ? 'autorizado' : 'sem opt-in'}</span>
          </div>
          {(primaryGuardian || emergencyContact) && <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px]">
            {primaryGuardian && <span className="text-fog"><strong className="font-semibold text-paper/90">Contato principal:</strong> {primaryGuardian.name} · {primaryGuardian.relationship}{primaryGuardian.phone ? ` · ${primaryGuardian.phone}` : ''}</span>}
            {emergencyContact && <span className="text-pulse"><strong className="font-semibold">Emergência:</strong> {emergencyContact.name}{emergencyContact.phone ? ` · ${emergencyContact.phone}` : ''}</span>}
          </div>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canSeeClinical && <>
            <Link to={`/pacientes/${patient.id}/prontuario`} className="rounded-xl border border-mint/35 bg-mint/[0.04] px-3.5 py-2 text-[12.5px] font-semibold text-mint transition-colors hover:border-mint/60 hover:bg-mint/10">Prontuário</Link>
            <Link to={`/pacientes/${patient.id}/nexus`} className="rounded-xl border border-aqua/35 bg-aqua/[0.05] px-3.5 py-2 text-[12.5px] font-semibold text-aqua transition-colors hover:border-aqua/60 hover:bg-aqua/10">Nexus</Link>
            <Link to={`/pacientes/${patient.id}/nexus/evolution`} className="rounded-xl border border-aqua/25 px-3.5 py-2 text-[12.5px] font-semibold text-fog transition-colors hover:border-aqua/50 hover:bg-aqua/[0.04] hover:text-aqua">Evolução</Link>
            <Link to={`/pacientes/${patient.id}/nexus/education`} className="rounded-xl border border-line px-3 py-2 text-[12px] font-semibold text-fog transition-colors hover:border-aqua/40 hover:text-aqua">Educação</Link>
            <Link to={`/pacientes/${patient.id}/nexus/self-assessment`} className="rounded-xl border border-line px-3 py-2 text-[12px] font-semibold text-fog transition-colors hover:border-mint/40 hover:text-mint">Autoaplicação</Link>
            <Link to="/nexus/evidence" className="rounded-xl border border-line px-3 py-2 text-[12px] font-semibold text-fog transition-colors hover:border-aqua/40 hover:text-aqua">Evidências</Link>
          </>}
          <Link to={`/pacientes/${patient.id}/editar`} className="rounded-xl border border-line px-3.5 py-2 text-[12.5px] font-semibold text-fog transition-colors hover:border-line2 hover:bg-raise hover:text-paper">Editar cadastro</Link>
          <PatientJourneyControl patient={patient} />
        </div>
      </div>
    </section>
  );
}
