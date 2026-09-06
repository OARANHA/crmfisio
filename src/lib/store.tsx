import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type {
  Access, Appointment, AppointmentStatus, Commission, ConsentTerm, Evolution,
  FinancialTransaction, FunilStage, ModuleKey, NpsSurvey, Patient, User,
} from './types';
import { useFinance } from './financeContext';
import { useAgenda } from './agendaContext';
import { usePatients } from './patientContext';
import { useClinical } from './clinicalContext';
import { useClinicDirectory } from './clinicDirectoryContext';
import { useLgpdActions } from './lgpdActions';
import { useCurrentUserAccess } from './currentUserAccess';
import { useToast, type Toast } from './toastContext';

interface AppState {
  user: User | null;
  users: User[];
  patients: Patient[];
  appointments: Appointment[];
  transactions: FinancialTransaction[];
  commissions: Commission[];
  evolutions: Evolution[];
  consents: ConsentTerm[];
  surveys: NpsSurvey[];
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

/**
 * Compatibility facade for screens still using useApp().
 *
 * Canonical auth and domain state live in dedicated providers. New code should
 * consume those providers directly instead of adding state or loaders here.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const { user, access, canView } = useCurrentUserAccess();
  const finance = useFinance();
  const agenda = useAgenda();
  const patientDomain = usePatients();
  const clinical = useClinical();
  const directory = useClinicDirectory();
  const lgpd = useLgpdActions();
  const { toast: pushToast } = useToast();

  const value = useMemo<AppState>(() => {
    const persistError = (label: string, error: unknown) => {
      console.error(`[MedicsPro] ${label}:`, error);
      pushToast(`${label}. Tente novamente.`, 'warn');
    };

    return {
      user,
      users: directory.users,
      patients: patientDomain.patients,
      appointments: agenda.appointments,
      transactions: finance.transactions,
      commissions: finance.commissions,
      evolutions: clinical.evolutions,
      consents: clinical.consents,
      surveys: clinical.surveys,
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
    user, access, canView, directory.users,
    pushToast,
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