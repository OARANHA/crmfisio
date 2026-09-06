import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  Access, Appointment, AppointmentStatus, AuditEntry, Commission, ConsentTerm, Evolution,
  FinancialTransaction, FunilStage, ModuleKey, NpsSurvey, Patient, PatientPackage,
  Room, SessionPackage, Unidade, User, WaLog,
} from './types';
import { loadInfrastructure } from './infrastructure';
import { logPatientDataExport } from './repository';
import { loadClinicShellData } from './clinicShellData';
import { accessFor } from './permissions';
import { useFinance } from './financeContext';
import { useAgenda } from './agendaContext';
import { usePatients } from './patientContext';
import { useClinical } from './clinicalContext';

export interface Toast { id: number; msg: string; kind: 'ok' | 'warn' | 'info' }

interface AppState {
  user: User | null;
  users: User[];
  setAuthenticatedUser: (user: User | null) => void;
  unidades: Unidade[];
  unidadeSel: string;
  setUnidadeSel: (v: string) => void;
  rooms: Room[];
  refreshInfrastructure: () => Promise<void>;
  refreshClinicData: () => Promise<void>;
  packages: SessionPackage[];
  patientPackages: PatientPackage[];
  patients: Patient[];
  appointments: Appointment[];
  transactions: FinancialTransaction[];
  commissions: Commission[];
  evolutions: Evolution[];
  consents: ConsentTerm[];
  surveys: NpsSurvey[];
  waLogs: WaLog[];
  audit: AuditEntry[];
  toasts: Toast[];

  login: (userId: string) => void;
  logout: () => void;
  access: (m: ModuleKey) => Access;
  canView: (m: ModuleKey) => boolean;
  toast: (msg: string, kind?: Toast['kind']) => void;

  setAppointmentStatus: (id: string, status: AppointmentStatus) => void;
  addAppointment: (a: Omit<Appointment, 'id'>) => void;
  addPatient: (p: Omit<Patient, 'id' | 'createdAt' | 'anamnese'> & { anamnese?: Patient['anamnese'] }) => void;
  setFunilStage: (id: string, stage: FunilStage) => void;
  addEvolution: (e: Omit<Evolution, 'id'>) => void;
  signConsent: (id: string) => Promise<void>;
  setTxStatus: (id: string, status: FinancialTransaction['status'], metodo?: FinancialTransaction['metodo']) => void;
  addTransaction: (t: Omit<FinancialTransaction, 'id'>) => void;
  answerNps: (id: string, nota: number) => void;

  fecharRepasse: (periodo: string) => Promise<number>;
  setCommissionStatus: (id: string, status: Commission['status']) => Promise<void>;

  exportarTitular: (pacienteId: string) => Promise<Record<string, unknown>>;
  anonimizarPaciente: (pacienteId: string) => Promise<void>;
}

const Ctx = createContext<AppState | null>(null);

let seq = 1000;
const nid = (p: string) => `${p}${++seq}`;

export function AppProvider({ children }: { children: ReactNode }) {
  const finance = useFinance();
  const agenda = useAgenda();
  const patientDomain = usePatients();
  const clinical = useClinical();
  const [user, setUser] = useState<User | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [packages, setPackages] = useState<SessionPackage[]>([]);
  const [patientPackages, setPatientPackages] = useState<PatientPackage[]>([]);
  const [waLogs, setWaLogs] = useState<WaLog[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unidadeSel, setUnidadeSel] = useState<string>('all');

  const pushToast = useCallback((msg: string, kind: Toast['kind'] = 'ok') => {
    const id = ++seq;
    setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4400);
  }, []);

  const applyClinicData = useCallback(async (data: Awaited<ReturnType<typeof loadClinicShellData>>) => {
    const infrastructure = await loadInfrastructure(data.clinicId);
    setClinicId(data.clinicId);
    setUsers(data.users);
    setUnidades(infrastructure.unidades);
    setRooms(infrastructure.rooms);
    setUnidadeSel((current) => current === 'all' || infrastructure.unidades.some((unit) => unit.id === current) ? current : 'all');
    setPackages(data.packages);
    setPatientPackages(data.patientPackages);
    setWaLogs(data.waLogs);
    setAudit(data.audit);
  }, []);

  const refreshClinicData = useCallback(async () => {
    if (!user?.id) return;
    const [data] = await Promise.all([
      loadClinicShellData(user.id),
      finance.refreshFinance(),
      agenda.refreshAgenda(),
      patientDomain.refreshPatients(),
      clinical.refreshClinical(),
    ]);
    await applyClinicData(data);
  }, [user?.id, finance.refreshFinance, agenda.refreshAgenda, patientDomain.refreshPatients, clinical.refreshClinical, applyClinicData]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setClinicId(null);
      setUsers([]);
      setUnidades([]);
      setRooms([]);
      setUnidadeSel('all');
      setPackages([]);
      setPatientPackages([]);
      setWaLogs([]);
      setAudit([]);
      return;
    }

    loadClinicShellData(user.id)
      .then(async (data) => {
        if (cancelled) return;
        await applyClinicData(data);
      })
      .catch((error) => {
        console.error('[MedicsPro] Falha ao carregar dados do shell da clínica:', error);
        if (!cancelled) pushToast('Não foi possível carregar os dados da clínica.', 'warn');
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, pushToast, applyClinicData]);

  const value = useMemo<AppState>(() => {
    const access = (m: ModuleKey): Access => accessFor(user?.role, m);
    const canView = (m: ModuleKey) => access(m) !== 'none';

    const persistError = (label: string, error: unknown) => {
      console.error(`[MedicsPro] ${label}:`, error);
      pushToast(`${label}. Tente novamente.`, 'warn');
    };

    return {
      user,
      setAuthenticatedUser: setUser,
      users,
      unidades,
      unidadeSel,
      setUnidadeSel,
      rooms,
      refreshInfrastructure: async () => {
        if (!clinicId) throw new Error('Clínica não identificada');
        const infrastructure = await loadInfrastructure(clinicId);
        setUnidades(infrastructure.unidades);
        setRooms(infrastructure.rooms);
        setUnidadeSel((current) => current === 'all' || infrastructure.unidades.some((unit) => unit.id === current) ? current : 'all');
      },
      refreshClinicData,
      packages,
      patientPackages,
      patients: patientDomain.patients,
      appointments: agenda.appointments,
      transactions: finance.transactions,
      commissions: finance.commissions,
      evolutions: clinical.evolutions,
      consents: clinical.consents,
      surveys: clinical.surveys,
      waLogs,
      audit,
      toasts,

      login: () => {
        // Login real é responsabilidade do useAuth/Supabase Auth.
      },
      logout: () => setUser(null),
      access,
      canView,
      toast: pushToast,

      setAppointmentStatus: (id, status) => {
        void agenda.setAppointmentStatus(id, status)
          .catch((error) => persistError('Falha ao atualizar o atendimento', error));
      },

      addAppointment: (appointment) => {
        void agenda.addAppointment(appointment)
          .then(() => pushToast('Agendamento salvo.'))
          .catch((error) => persistError('Falha ao salvar agendamento', error));
      },

      addPatient: (patient) => {
        void patientDomain.addPatient(patient)
          .then(() => pushToast('Paciente salvo no Supabase.'))
          .catch((error) => persistError('Falha ao cadastrar paciente', error));
      },

      setFunilStage: (id, stage) => {
        void patientDomain.setFunilStage(id, stage)
          .catch((error) => persistError('Falha ao atualizar o funil', error));
      },

      addEvolution: (evolution) => {
        void clinical.addEvolution(evolution)
          .then(() => pushToast('Evolução clínica salva.'))
          .catch((error) => persistError('Falha ao salvar evolução clínica', error));
      },

      signConsent: async (id) => {
        try {
          await clinical.signConsent(id);
          pushToast('Consentimento registrado com sucesso.');
        } catch (error) {
          persistError('Falha ao registrar consentimento', error);
        }
      },

      setTxStatus: (id, status, metodo) => {
        void finance.setTransactionStatus(id, status, metodo)
          .catch((error) => persistError('Falha ao atualizar financeiro', error));
      },

      addTransaction: (transaction) => {
        void finance.addTransaction(transaction)
          .then(() => pushToast('Lançamento financeiro salvo.'))
          .catch((error) => persistError('Falha ao salvar lançamento financeiro', error));
      },

      answerNps: (id, nota) => {
        void clinical.answerNps(id, nota)
          .catch((error) => persistError('Falha ao registrar NPS', error));
      },

      fecharRepasse: finance.closeCommissions,
      setCommissionStatus: finance.setCommissionStatus,

      exportarTitular: async (pacienteId) => {
        await logPatientDataExport(pacienteId);
        setAudit((current) => [{ id: nid('audit-'), ts: new Date().toISOString(), usuarioId: user!.id, acao: 'EXPORTACAO_LGPD', detalhe: `paciente_id=${pacienteId}; formato=JSON` }, ...current]);
        const patient = patientDomain.patients.find((item) => item.id === pacienteId);
        return {
          formato: 'LGPD-portabilidade-v1',
          exportadoEm: new Date().toISOString(),
          exportadoPor: user?.nome ?? 'sistema',
          titular: patient,
          sessoes: agenda.appointments.filter((appointment) => appointment.pacienteId === pacienteId),
          evolucoes: clinical.evolutions.filter((evolution) => evolution.pacienteId === pacienteId),
          consentimentos: clinical.consents.filter((consent) => consent.pacienteId === pacienteId).map(({ assinaturaUrl: _img, ...rest }) => rest),
          pesquisas: clinical.surveys.filter((survey) => survey.pacienteId === pacienteId),
          pacotes: patientPackages.filter((item) => item.pacienteId === pacienteId),
          financeiro: finance.transactions.filter((transaction) => transaction.pacienteId === pacienteId),
        };
      },

      anonimizarPaciente: async (pacienteId) => {
        await patientDomain.anonymizePatient(pacienteId);
        setAudit((current) => [{ id: nid('audit-'), ts: new Date().toISOString(), usuarioId: user!.id, acao: 'ANONIMIZACAO_LGPD', detalhe: `paciente_id=${pacienteId}; identificadores_diretos_removidos=true` }, ...current]);
      },
    };
  }, [
    user, clinicId, users, unidades, rooms,
    packages, patientPackages, waLogs, audit, toasts, unidadeSel, pushToast, refreshClinicData,
    patientDomain.patients, patientDomain.addPatient, patientDomain.setFunilStage, patientDomain.anonymizePatient,
    clinical.evolutions, clinical.consents, clinical.surveys, clinical.addEvolution, clinical.signConsent, clinical.answerNps,
    agenda.appointments, agenda.addAppointment, agenda.setAppointmentStatus,
    finance.transactions, finance.commissions, finance.addTransaction, finance.setTransactionStatus,
    finance.closeCommissions, finance.setCommissionStatus,
  ]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp fora do AppProvider');
  return ctx;
}

export function useUnitFilter() {
  const { rooms, unidadeSel } = useApp();
  return useCallback(
    (appointment: { roomId: string }) => {
      if (unidadeSel === 'all') return true;
      const room = rooms.find((item) => item.id === appointment.roomId);
      return room ? room.unidadeId === unidadeSel : true;
    },
    [rooms, unidadeSel],
  );
}

export const patientName = (patients: Patient[], id: string) =>
  patients.find((patient) => patient.id === id)?.nome ?? '—';

export const userName = (users: User[], id: string) =>
  users.find((user) => user.id === id)?.nome ?? '—';
