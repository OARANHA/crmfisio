import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useAgenda } from '../lib/agendaContext';
import { useClinicDirectory } from '../lib/clinicDirectoryContext';
import { useCurrentUserAccess } from '../lib/currentUserAccess';
import { useFinance } from '../lib/financeContext';
import { usePackages } from '../lib/packageContext';
import { fmtBRL, STATUS_META, type Appointment, type Patient } from '../lib/types';
import { Btn, Chip } from '../lib/ui';

const dateTimeKey = (appointment: Appointment) => `${appointment.data}T${appointment.inicio}`;

const sessionLabel = (appointment: Appointment | undefined) => {
  if (!appointment) return 'Sem sessão';
  return `${format(new Date(`${appointment.data}T12:00:00`), "dd MMM", { locale: ptBR })} · ${appointment.inicio}`;
};

export function PatientCareCockpit({ patient }: { patient: Patient }) {
  const nav = useNavigate();
  const { user, access } = useCurrentUserAccess();
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

  const patientReceivables = transactions.filter((transaction) => transaction.tipo === 'receber' && transaction.pacienteId === patient.id);
  const outstanding = patientReceivables.filter((transaction) => transaction.status !== 'pago');
  const overdue = outstanding.filter((transaction) => transaction.status === 'atrasado');
  const outstandingAmount = outstanding.reduce((sum, transaction) => sum + transaction.valor, 0);

  const activePackage = patientPackages.find((item) => item.pacienteId === patient.id && item.status === 'ativo');
  const packageCatalog = activePackage ? packages.find((item) => item.id === activePackage.pacoteId) : undefined;
  const packageRemaining = activePackage ? Math.max(0, activePackage.sessoesTotais - activePackage.sessoesUsadas) : null;

  const assignedProfessional = users.find((item) => item.id === (activeSession?.fisioId ?? nextSession?.fisioId));
  const isOwnActiveSession = Boolean(activeSession && user?.role === 'fisio' && activeSession.fisioId === user.id);
  const canSeeFinance = access('financeiro') !== 'none';
  const canUseMessages = access('mensagens') !== 'none';

  const practiceHint = user?.role === 'fisio'
    ? 'Seu consultório em um único contexto: atender, registrar, agendar e acompanhar.'
    : 'Contexto do paciente para decidir a próxima ação sem navegar às cegas.';

  return (
    <section className="overflow-hidden rounded-2xl border border-line/80 bg-gradient-to-br from-mint/[0.12] via-panel to-aqua/[0.07] shadow-sm">
      <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="p-5 lg:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mint">Central do paciente</p>
              <h2 className="mt-1 font-display text-xl font-bold text-paper">O que precisa de atenção agora</h2>
              <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-fog">{practiceHint}</p>
            </div>
            {activeSession ? <Chip className={STATUS_META.em_atendimento.chip}>Atendimento em andamento</Chip> : nextSession ? <Chip className={STATUS_META[nextSession.status].chip}>{STATUS_META[nextSession.status].label}</Chip> : <Chip className="border-line text-fog">Sem próxima sessão</Chip>}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <CockpitMetric
              eyebrow={activeSession ? 'Sessão atual' : 'Próxima sessão'}
              value={sessionLabel(activeSession ?? nextSession)}
              detail={(activeSession ?? nextSession)?.tipo ?? 'Agende o próximo encontro'}
              emphasis={Boolean(activeSession)}
            />
            <CockpitMetric
              eyebrow="Última sessão"
              value={sessionLabel(lastSession)}
              detail={lastSession ? lastSession.tipo : 'Nenhuma finalizada'}
            />
            <CockpitMetric
              eyebrow="Financeiro do paciente"
              value={canSeeFinance ? (outstanding.length ? fmtBRL(outstandingAmount) : 'Em dia') : 'Protegido'}
              detail={canSeeFinance ? (overdue.length ? `${overdue.length} cobrança(s) em atraso` : outstanding.length ? `${outstanding.length} pendência(s)` : 'sem pendências abertas') : 'conforme seu perfil'}
              warning={canSeeFinance && overdue.length > 0}
            />
            <CockpitMetric
              eyebrow="Pacote"
              value={packageRemaining === null ? 'Avulso' : `${packageRemaining} restante${packageRemaining === 1 ? '' : 's'}`}
              detail={packageCatalog?.nome ?? (activePackage ? 'pacote ativo' : 'sem pacote ativo')}
              warning={packageRemaining !== null && packageRemaining <= 2}
            />
          </div>

          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-line/60 pt-4 text-[12px] text-fog">
            <span><strong className="font-semibold text-paper/90">Responsável:</strong> {assignedProfessional?.nome ?? 'a definir'}</span>
            <span><strong className="font-semibold text-paper/90">Jornada:</strong> {patient.funilStage === 'tratamento' ? 'em tratamento' : patient.funilStage}</span>
            <span><strong className="font-semibold text-paper/90">WhatsApp:</strong> {patient.optInWhats ? 'autorizado' : 'sem opt-in'}</span>
          </div>
        </div>

        <aside className="border-t border-line/70 bg-deep/35 p-5 xl:border-l xl:border-t-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-fog">Ações rápidas</p>
          <div className="mt-3 grid gap-2">
            {isOwnActiveSession && (
              <Btn onClick={() => nav(`/pacientes/${patient.id}?session=${activeSession!.id}#clinical-workspace`)}>
                Continuar atendimento
              </Btn>
            )}
            <Btn variant={isOwnActiveSession ? 'subtle' : 'primary'} onClick={() => nav(`/agenda?patient=${encodeURIComponent(patient.id)}&action=new`)}>
              Agendar próxima sessão
            </Btn>
            {canUseMessages && patient.telefone && (
              <Btn variant="ghost" onClick={() => nav('/mensagens')}>Abrir Mensagens</Btn>
            )}
            {canSeeFinance && (
              <Btn variant="ghost" onClick={() => nav('/financeiro')}>Ver Financeiro</Btn>
            )}
          </div>
          <p className="mt-4 text-[11.5px] leading-relaxed text-fog/80">
            {isOwnActiveSession
              ? 'Registre a evolução desta sessão antes de finalizar. O restante do contexto permanece disponível aqui.'
              : activeSession
                ? 'Existe um atendimento em andamento. A autoria clínica continua restrita ao profissional responsável.'
                : 'Use esta central como ponto de partida para a próxima decisão sobre o paciente.'}
          </p>
        </aside>
      </div>
    </section>
  );
}

function CockpitMetric({ eyebrow, value, detail, emphasis = false, warning = false }: { eyebrow: string; value: string; detail: string; emphasis?: boolean; warning?: boolean }) {
  return (
    <div className="rounded-xl border border-line/70 bg-panel/75 p-4 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog">{eyebrow}</p>
      <p className={`mt-1.5 font-display text-[18px] font-bold ${warning ? 'text-amber' : emphasis ? 'text-mint' : 'text-paper'}`}>{value}</p>
      <p className="mt-1 text-[11.5px] leading-snug text-fog">{detail}</p>
    </div>
  );
}
