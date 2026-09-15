import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { usePatients } from '../lib/patientContext';
import { useAgenda } from '../lib/agendaContext';
import { resolveClinicalEncounterWorkspace } from '../lib/clinicalEncounterUx';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { STAGE_META, type FunilStage } from '../lib/types';
import { Btn, Input, Select, Empty, IconSearch, IconPlus, IconChevronL } from '../lib/ui';
import { Reveal } from '../components/Reveal';
import { ClinicalWorkspaceV3 } from '../components/ClinicalWorkspaceV3';
import { PatientCareCockpit } from '../components/PatientCareCockpit';
import { PatientOperationalActions } from '../components/PatientOperationalActions';
import { PatientProfileHeader } from '../components/PatientProfileHeader';
import { PatientDirectoryTableV2 } from '../components/PatientDirectoryTableV2';
import { NexusPatientContextHub } from '../components/NexusPatientContextHub';
import { PatientRegistrationPage } from './PatientRegistrationPage';

export function Pacientes() {
  const { id } = useParams();
  if (id === 'novo') return <PatientRegistrationPage />;
  return id ? <Pep id={id} /> : <Lista />;
}

function Lista() {
  const { patients } = usePatients();
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [stage, setStage] = useState<'all' | FunilStage>('all');

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const digits = q.replace(/\D/g, '');
    return patients.filter((patient) => {
      if (patient.anonimizado || (stage !== 'all' && patient.funilStage !== stage)) return false;
      if (!query) return true;
      const searchableText = [patient.nome, patient.preferredName, patient.telefone, patient.email, patient.convenio]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const cpfDigits = patient.cpf.replace(/\D/g, '');
      return searchableText.includes(query) || Boolean(digits && cpfDigits.includes(digits));
    });
  }, [patients, q, stage]);

  return (
    <div className="space-y-7">
      <Reveal>
        <section className="rounded-ui-surface border border-line/75 bg-panel px-6 py-6 shadow-[0_16px_44px_rgba(8,22,18,0.055)] sm:px-7">
          <div className="flex flex-wrap items-start gap-5">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-mint">Cadastro operacional</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-ui-page-title font-bold leading-tight tracking-[-0.025em]">Pacientes</h1>
                <span className="rounded-full border border-line2/65 bg-raise/45 px-3 py-1 text-sm font-semibold text-fog">
                  {patients.filter((patient) => !patient.anonimizado).length} cadastrados
                </span>
              </div>
              <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-fog">
                Localize rapidamente o cadastro administrativo; dados clínicos ficam no prontuário conforme relação assistencial.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-3 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <IconSearch className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-fog" />
              <Input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                placeholder="Nome, telefone, e-mail ou CPF…"
                className="!min-h-ui-control !rounded-2xl !pl-12 !pr-4 !text-base"
              />
            </div>
            <Select
              value={stage}
              onChange={(event) => setStage(event.target.value as 'all' | FunilStage)}
              className="!min-h-ui-control !w-full !rounded-2xl !px-4 !text-[15px] xl:!w-[220px]"
            >
              <option value="all">Toda a jornada</option>
              {(Object.keys(STAGE_META) as FunilStage[]).map((item) => (
                <option key={item} value={item}>{STAGE_META[item].label}</option>
              ))}
            </Select>
            <Btn onClick={() => nav('/pacientes/novo')} className="!min-h-ui-control !rounded-2xl !px-5 !text-[15px]">
              <IconPlus className="h-5 w-5" /> Novo paciente
            </Btn>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-fog">
            <span><strong className="font-semibold text-paper/85">{filtered.length}</strong> resultado{filtered.length === 1 ? '' : 's'}</span>
            {q.trim() && <span>Busca: “{q.trim()}”</span>}
            {stage !== 'all' && <span>Jornada: {STAGE_META[stage].label}</span>}
          </div>
        </section>
      </Reveal>

      <Reveal delay={80}>
        {filtered.length === 0 ? (
          <Empty title="Nenhum paciente encontrado" sub="Cadastre o primeiro paciente ou ajuste os filtros." />
        ) : (
          <PatientDirectoryTableV2 patients={filtered} onOpenPatient={(patientId) => nav(`/pacientes/${patientId}`)} />
        )}
      </Reveal>
    </div>
  );
}

function Pep({ id }: { id: string }) {
  const { patients } = usePatients();
  const { appointments } = useAgenda();
  const { user } = useCurrentUserAccess();
  const [searchParams] = useSearchParams();
  const patient = patients.find((item) => item.id === id);
  const focusedSessionId = searchParams.get('session');
  const encounterResolution = useMemo(
    () => resolveClinicalEncounterWorkspace(appointments, patient?.id, user?.id, focusedSessionId),
    [appointments, focusedSessionId, patient?.id, user?.id],
  );
  const inOwnEncounter = encounterResolution.mode === 'encounter';

  if (!patient) return <Empty title="Paciente não encontrado" action={<Link to="/pacientes"><Btn variant="ghost">Voltar</Btn></Link>} />;

  return (
    <div className="space-y-4">
      {!inOwnEncounter && (
        <Reveal>
          <Link to="/pacientes" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-fog transition-colors hover:text-mint">
            <IconChevronL className="h-4 w-4" /> Pacientes
          </Link>
          <div className="mt-2"><PatientProfileHeader patient={patient} /></div>
        </Reveal>
      )}

      {!inOwnEncounter && (
        <>
          <Reveal delay={30}>
            <PatientCareCockpit patient={patient} />
          </Reveal>

          <Reveal delay={45}>
            <PatientOperationalActions patient={patient} />
          </Reveal>

          <Reveal delay={55}>
            <NexusPatientContextHub patient={patient} />
          </Reveal>
        </>
      )}

      <Reveal delay={inOwnEncounter ? 20 : 65}>
        <div id="clinical-workspace" className="scroll-mt-4">
          <ClinicalWorkspaceV3 patient={patient} initialSessionId={focusedSessionId} />
        </div>
      </Reveal>
    </div>
  );
}
