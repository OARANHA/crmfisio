import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useClinicalCapability } from '../hooks/useClinicalCapability';
import { useAgenda } from '../lib/agendaContext';
import { useClinicDirectory } from '../lib/clinicDirectoryContext';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { useFinance } from '../lib/financeContext';
import { usePackages } from '../lib/packageContext';
import { professionalIdOf } from '../lib/professionalReference';
import { fmtBRL, STATUS_META, type Appointment, type Patient } from '../lib/types';
import { Btn, Chip } from '../lib/ui';

const dateTimeKey = (appointment: Appointment) => `${appointment.data}T${appointment.inicio}`;

const sessionLabel = (appointment: Appointment | undefined) => {
  if (!appointment) return 'Sem atendimento';
  return `${format(new Date(`${appointment.data}T12:00:00`), "dd MMM", { locale: ptBR })} · ${appointment.inicio}`;
};

export function PatientCareCockpit({ patient }: { patient: Patient }) {
  const nav = useNavigate();
  const { user, access } = useCurrentUserAccess();
  const { allowed: canAttend } = useClinicalCapability('clinical.attend', user?.id);
  const { users } = useClinicDirectory();
  const { appointments } = useAgenda();
  const { transactions } = useFinance();
  const { patientPackages, packages } = usePackages();

  const patientSessions = useMemo(
    () => appointments
      .filter((appointment) => appointment.pacienteId === patient.id)
      .sort((a, b) => dateTimeKey(a).localeCompare(dateTimeKey(b))),
    [appointments, patient.id],
  );

  const nowKey = format(new Date(), "yyyy-MM-dd'T'HH:mm");
  const activeSession = patientSessions.find((appointment) => appointment.status === 'em_atendimento');
  const nextSession = patientSessions.find((appointment) =>
    ['agendado', 'confirmado'].includes(appointment.status) && dateTimeKey(appointment) >= nowKey,
  );
  const lastSession = [...patientSessions].reverse().find((appointment) => appointment.status === 'finalizado');
  const completedCount = patientSessions.filter((appointment) => appointment.status === 'finalizado').length;
  const missedCount = patientSessions.filter((appointment) => appointment.status === 'faltou').length;

  const patientReceivables = transactions.filter((transaction) => transaction.tipo === 'receber' && transaction.pacienteId === patient.id);
  const outstanding = patientReceivables.filter((transaction) => transaction.status !== 'pago');
  const overdue = outstanding.filter((transaction) => transaction.status === 'atrasado');
  const outstandingAmount = outstanding.reduce((sum, transaction) => sum + transaction.valor, 0);

  const activePackage = patientPackages.find((item) => item.pacienteId === patient.id && item.status === 'ativo');
  const packageCatalog = activePackage ? packages.find((item) => item.id === activePackage.pacoteId) : undefined;
  const packageRemaining = activePackage ? Math.max(0, activePackage.sessoesTotais - activePackage.sessoesUsadas) : null;

  const currentProfessionalId = activeSession ? professionalIdOf(activeSession) : nextSession ? professionalIdOf(nextSession) : '';
  const assignedProfessional = users.find((item) => item.id === currentProfessionalId);
  const isOwnActiveSession = Boolean(activeSession && canAttend && professionalIdOf(activeSession) === user?.id);
  const canSeeFinance = access('financeiro') !== 'none';
  const canUseMessages = access('mensagens') !== 'none';

  const practiceHint = canAttend
    ? 'Atendimento, prontuário, continuidade e próximos passos reunidos no mesmo contexto.'
    : 'Um resumo operacional do paciente para decidir o que merece atenção agora.';

  const attentionText = activeSession
    ? 'Atendimento em andamento'
    : overdue.length > 0 && canSeeFinance
      ? `${overdue.length} pendência${overdue.length > 1 ? 's' : ''} financeira${overdue.length > 1 ? 's' : ''}`
      : packageRemaining !== null && packageRemaining <= 2
        ? 'Pacote próximo do fim'
        : nextSession
          ? nextSession.status === 'confirmado' ? 'Próximo atendimento confirmado' : 'Confirmação pendente'
          : 'Sem próximo atendimento';

  return (
    <section className="overflow-hidden rounded-[24px] border border-line/75 bg-panel shadow-[0_18px_48px_rgba(0,0,0,0.055)]">
      <div className="grid xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-mint">Cockpit do paciente</p>
              <h2 className="mt-2 font-display text-[24px] font-bold leading-tight tracking-tight text-paper">{attentionText}</h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-fog">{practiceHint}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {activeSession ? <Chip className={STATUS_META.em_atendimento.chip}>em atendimento</Chip> : nextSession ? <Chip className={STATUS_META[nextSession.status].chip}>{STATUS_META[nextSession.status].label}</Chip> : <Chip className="border-line text-fog">sem agenda futura</Chip>}
              <Chip className="border-line/80 text-fog">{completedCount} realizado{completedCount === 1 ? '' : 's'}</Chip>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CockpitMetric
              eyebrow={activeSession ? 'Sessão atual' : 'Próximo encontro'}
              value={sessionLabel(activeSession ?? nextSession)}
              detail={(activeSession ?? nextSession)?.tipo ?? 'Sem atendimento futuro'}
              emphasis={Boolean(activeSession || nextSession)}
            />
            <CockpitMetric
              eyebrow="Último encontro"
              value={sessionLabel(lastSession)}
              detail={lastSession ? lastSession.tipo : 'Nenhum atendimento finalizado'}
            />
            <CockpitMetric
              eyebrow="Financeiro"
              value={canSeeFinance ? (outstanding.length ? fmtBRL(outstandingAmount) : 'Em dia') : 'Protegido'}
              detail={canSeeFinance ? (overdue.length ? `${overdue.length} cobrança(s) vencida(s)` : outstanding.length ? `${outstanding.length} pendência(s) aberta(s)` : 'sem pendências abertas') : 'visibilidade conforme perfil'}
              warning={canSeeFinance && overdue.length > 0}
            />
            <CockpitMetric
              eyebrow="Plano de sessões"
              value={packageRemaining === null ? 'Avulso' : `${packageRemaining} restante${packageRemaining === 1 ? '' : 's'}`}
              detail={packageCatalog?.nome ?? (activePackage ? 'pacote ativo' : 'sem pacote ativo')}
              warning={packageRemaining !== null && packageRemaining <= 2}
            />
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <ContextRow label="Profissional responsável" value={assignedProfessional?.nome ?? 'A definir'} />
            <ContextRow label="Jornada" value={patient.funilStage === 'tratamento' ? 'Em tratamento' : patient.funilStage} />
            <ContextRow label="Continuidade" value={missedCount > 0 ? `${missedCount} falta${missedCount > 1 ? 's' : ''} no histórico` : 'Sem faltas registradas'} warning={missedCount > 0} />
          </div>
        </div>

        <aside className="border-t border-line/65 bg-[linear-gradient(180deg,color-mix(in_srgb,var(--color-mint)_7%,var(--color-deep)),var(--color-deep))] p-5 xl:border-l xl:border-t-0">
          <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-fog">Próxima melhor ação</p>
          <p className="mt-2 font-display text-lg font-semibold text-paper">
            {isOwnActiveSession ? 'Continuar o atendimento atual' : activeSession ? 'Acompanhar a sessão em andamento' : nextSession ? 'Preparar o próximo encontro' : 'Criar continuidade'}
          </p>
          <p className="mt-2 text-[12.5px] leading-relaxed text-fog">
            {isOwnActiveSession
              ? 'Entre direto no prontuário da sessão e registre a evolução antes da finalização.'
              : activeSession
                ? 'A autoria clínica continua restrita ao profissional responsável pelo atendimento.'
                : nextSession
                  ? 'O próximo encontro já está na agenda. Use o prontuário para revisar o histórico antes da sessão.'
                  : 'Não há atendimento futuro. Agendar o próximo passo evita perda de continuidade.'}
          </p>

          <div className="mt-5 grid gap-2">
            {isOwnActiveSession && (
              <Btn onClick={() => nav(`/pacientes/${patient.id}?session=${activeSession!.id}#clinical-workspace`)}>
                Continuar atendimento
              </Btn>
            )}
            <Btn variant={isOwnActiveSession ? 'subtle' : 'primary'} onClick={() => nav(`/agenda?patient=${encodeURIComponent(patient.id)}&action=new`)}>
              Agendar atendimento
            </Btn>
            <Btn variant="ghost" onClick={() => nav(`/pacientes/${patient.id}#clinical-workspace`)}>Abrir prontuário</Btn>
            {canUseMessages && patient.telefone && <Btn variant="ghost" onClick={() => nav('/mensagens')}>Abrir Mensagens</Btn>}
            {canSeeFinance && <Btn variant="ghost" onClick={() => nav('/financeiro')}>Ver Financeiro</Btn>}
          </div>
        </aside>
      </div>
    </section>
  );
}

function CockpitMetric({ eyebrow, value, detail, emphasis = false, warning = false }: { eyebrow: string; value: string; detail: string; emphasis?: boolean; warning?: boolean }) {
  return (
    <div className="rounded-2xl border border-line/70 bg-deep/35 p-4">
      <p className="text-[11px] font-semibold text-fog">{eyebrow}</p>
      <p className={`mt-2 font-display text-[19px] font-bold leading-tight ${warning ? 'text-amber' : emphasis ? 'text-mint' : 'text-paper'}`}>{value}</p>
      <p className="mt-2 text-[12px] leading-relaxed text-fog">{detail}</p>
    </div>
  );
}

function ContextRow({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return (
    <div className="rounded-xl border border-line/55 bg-panel/45 px-4 py-3">
      <p className="text-[11px] text-fog">{label}</p>
      <p className={`mt-1 text-[13.5px] font-semibold ${warning ? 'text-amber' : 'text-paper/90'}`}>{value}</p>
    </div>
  );
}
