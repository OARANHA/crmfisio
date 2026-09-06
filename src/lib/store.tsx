import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type {
  Access, Appointment, AppointmentStatus, AuditEntry, Commission, ConsentTerm, Evolution,
  FinancialTransaction, FunilStage, ModuleKey, NpsSurvey, Patient, PatientPackage,
  SessionPackage, User, WaLog,
} from './types';
import { accessFor } from './permissions';
import { useAuth } from './useAuth';
import { useFinance } from './financeContext';
import { useAgenda } from './agendaContext';
import { usePatients } from './patientContext';
import { useClinical } from './clinicalContext';
import { useClinicDirectory } from './clinicDirectoryContext';
import { usePackages } from './packageContext';
import { useCommunication } from './communicationContext';
import { useAudit } from './auditContext';
import { useLgpdActions } from './lgpdActions';

export interface Toast { id: number; msg: string; kind: 'ok' | 'warn' | 'info' }

interface AppState {
  user: User | null;
  users: User[];
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

/**
 * Compatibility facade for screens still using useApp().
 *
 * Canonical auth and domain state live in dedicated providers. New code should
 * consume those providers directly instead of adding state or loaders here.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const { user: authUser, profile, tenantAccessState } = useAuth();
  const finance = useFinance();
  const agenda = useAgenda();
  const patientDomain = usePatients();
  const clinical = useClinical();
  const directory = useClinicDirectory();
  const packageDomain = usePackages();
  const communication = useCommunication();
  const auditDomain = useAudit();
  const lgpd = useLgpdActions();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const user = useMemo<User | null>(() => {
    if (!authUser || !profile || tenantAccessState !== 'active') return null;
    return {
      id: authUser.id,
      nome: profile.nome || authUser.email?.split('@')[0] || 'Usuário',
      email: authUser.email || '',
      role: profile.role,
      registro: profile.registro || '',
      cor: profile.cor || '#cbd5e1',
      ativo: profile.ativo,
    };
  }, [authUser, profile, tenantAccessState]);

  const pushToast = useCallback((msg: string, kind: Toast['kind'] = 'ok') => {
    const id = ++seq;
    setToasts((current) => [...current.slice(-3), { id, msg, kind }]);
    window.setTimeout(() => setToasts((current) => current.filter((item) => item.id !== id)), 4400);
  }, []);

  // Temporary compatibility refresh for the final two legacy consumers.
  // Its scope is intentionally limited to the domains those flows can mutate.
  const refreshClinicData = useCallback(async () => {
    if (!user?.id) return;
    await Promise.all([
      finance.refreshFinance(),
      agenda.refreshAgenda(),
      clinical.refreshClinical(),
      packageDomain.refreshPackages(),
    ]);
  }, [
    user?.id,
    finance.refreshFinance,
    agenda.refreshAgenda,
    clinical.refreshClinical,
    packageDomain.refreshPackages,
  ]);

  const value = useMemo<AppState>(() => {
    const access = (module: ModuleKey): Access => accessFor(user?.role, module);
    const canView = (module: ModuleKey) => access(module) !== 'none';
    const persistError = (label: string, error: unknown) => {
      console.error(`[MedicsPro] ${label}:`, error);
      pushToast(`${label}. Tente novamente.`, 'warn');
    };

    return {
      user,
      users: directory.users,
      refreshClinicData,
      packages: packageDomain.packages,
      patientPackages: packageDomain.patientPackages,
      patients: patientDomain.patients,
      appointments: agenda.appointments,
      transactions: finance.transactions,
      commissions: finance.commissions,
      evolutions: clinical.evolutions,
      consents: clinical.consents,
      surveys: clinical.surveys,
      waLogs: communication.waLogs,
      audit: auditDomain.audit,
      toasts,
      access,
      canView,
      toast: pushToast,
      setAppointmentStatus: (id, status) => { void agenda.setAppointmentStatus(id, status).catch((error) => persistError('Falha ao atualizar o atendimento', error)); },
      addAppointment: (appointment) => { void agenda.addAppointment(appointment).then(() => pushToast('Agendamento salvo.')).catch((error) => persistError('Falha ao salvar agendamento', error)); },
      addPatient: (patient) => { void patientDomain.addPatient(patient).then(() => pushToast('Paciente salvo no Supabase.')).catch((error) => persistError('Falha ao cadastrar paciente', error)); },
      setFunilStage: (id, stage) => { void patientDomain.setFunilStage(id, stage).catch((error) => persistError('Falha ao atualizar o funil', error)); },
      addEvolution: (evolution) => { void clinical.addEvolution(evolution).then(() => pushToast('Evolução clínica salva.')).catch((error) => persistError('Falha ao salvar evolução clínica', error)); },
      signConsent: async (id) => {
        try {
          await clinical.signConsent(id);
          pushToast('Consentimento registrado com sucesso.');
        } catch (error) {
          persistError('Falha ao registrar consentimento', error);
        }
      },
      setTxStatus: (id, status, metodo) => { void finance.setTransactionStatus(id, status, metodo).catch((error) => persistError('Falha ao atualizar financeiro', error)); },
      addTransaction: (transaction) => { void finance.addTransaction(transaction).then(() => pushToast('Lançamento financeiro salvo.')).catch((error) => persistError('Falha ao salvar lançamento financeiro', error)); },
      answerNps: (id, nota) => { void clinical.answerNps(id, nota).catch((error) => persistError('Falha ao registrar NPS', error)); },
      fecharRepasse: finance.closeCommissions,
      setCommissionStatus: finance.setCommissionStatus,
      exportarTitular: lgpd.exportSubjectData,
      anonimizarPaciente: lgpd.anonymizePatient,
    };
  }, [
    user, directory.users,
    packageDomain.packages, packageDomain.patientPackages, communication.waLogs, auditDomain.audit,
    toasts, pushToast, refreshClinicData,
    lgpd.exportSubjectData, lgpd.anonymizePatient,
    patientDomain.patients, patientDomain.addPatient, patientDomain.setFunilStage,
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

export const patientName = (patients: Patient[], id: string) => patients.find((patient) => patient.id === id)?.nome ?? '—';
export const userName = (users: User[], id: string) => users.find((user) => user.id === id)?.nome ?? '—';