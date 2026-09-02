import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type {
  Access, Appointment, AppointmentStatus, AuditEntry, Commission, ConsentTerm, Evolution,
  FinancialTransaction, FunilStage, ModuleKey, NpsSurvey, Patient, PatientPackage,
  Role, Room, SessionPackage, Unidade, User, WaLog,
} from './types';
import { loadInfrastructure } from './infrastructure';
import {
  anonymizePatient,
  closeMonthlyCommissions,
  insertAppointment,
  insertEvolution,
  insertPatient,
  insertPayment,
  loadClinicData,
  markCommissionPaid,
  updateAppointmentStatus,
  updateConsent,
  updatePatientStage,
  updatePayment,
  updateSurvey,
} from './repository';

const ACCESS: Record<Role, Record<ModuleKey, Access>> = {
  admin: { dashboard: 'full', agenda: 'full', pacientes: 'full', clinico: 'read', financeiro: 'full', crm: 'full', mensagens: 'full', relatorios: 'full', config: 'full' },
  fisio: { dashboard: 'read', agenda: 'full', pacientes: 'full', clinico: 'full', financeiro: 'read', crm: 'read', mensagens: 'read', relatorios: 'read', config: 'none' },
  recep: { dashboard: 'none', agenda: 'full', pacientes: 'full', clinico: 'none', financeiro: 'full', crm: 'full', mensagens: 'full', relatorios: 'none', config: 'none' },
};

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
  signConsent: (id: string, assinaturaUrl?: string) => void;
  setTxStatus: (id: string, status: FinancialTransaction['status'], metodo?: FinancialTransaction['metodo']) => void;
  addTransaction: (t: Omit<FinancialTransaction, 'id'>) => void;
  answerNps: (id: string, nota: number) => void;

  fecharRepasse: (periodo: string) => Promise<number>;
  setCommissionStatus: (id: string, status: Commission['status']) => Promise<void>;

  exportarTitular: (pacienteId: string) => Record<string, unknown>;
  anonimizarPaciente: (pacienteId: string) => void;
}

const Ctx = createContext<AppState | null>(null);

let seq = 1000;
const nid = (p: string) => `${p}${++seq}`;
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [consents, setConsents] = useState<ConsentTerm[]>([]);
  const [surveys, setSurveys] = useState<NpsSurvey[]>([]);
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

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setClinicId(null);
      setUsers([]);
      setUnidades([]);
      setRooms([]);
      setUnidadeSel('all');
      setPatients([]);
      setAppointments([]);
      setTransactions([]);
      setCommissions([]);
      setEvolutions([]);
      setConsents([]);
      setSurveys([]);
      setPackages([]);
      setPatientPackages([]);
      setWaLogs([]);
      setAudit([]);
      return;
    }

    loadClinicData(user.id)
      .then(async (data) => ({ data, infrastructure: await loadInfrastructure(data.clinicId) }))
      .then(({ data, infrastructure }) => {
        if (cancelled) return;
        setClinicId(data.clinicId);
        setUsers(data.users);
        setUnidades(infrastructure.unidades);
        setRooms(infrastructure.rooms);
        setUnidadeSel((current) => current === 'all' || infrastructure.unidades.some((unit) => unit.id === current) ? current : 'all');
        setPatients(data.patients);
        setAppointments(data.appointments);
        setTransactions(data.transactions);
        setCommissions(data.commissions);
        setEvolutions(data.evolutions);
        setConsents(data.consents);
        setSurveys(data.surveys);
        setPackages(data.packages);
        setPatientPackages(data.patientPackages);
        setWaLogs(data.waLogs);
        setAudit(data.audit);
      })
      .catch((error) => {
        console.error('[MedicsPro] Falha ao carregar dados reais:', error);
        if (!cancelled) pushToast('Não foi possível carregar os dados da clínica.', 'warn');
      });

    return () => {
      cancelled = true;
    };
  }, [user?.id, pushToast]);

  const value = useMemo<AppState>(() => {
    const access = (m: ModuleKey): Access => (user ? ACCESS[user.role][m] : 'none');
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
      packages,
      patientPackages,
      patients,
      appointments,
      transactions,
      commissions,
      evolutions,
      consents,
      surveys,
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
        const anterior = appointments.find((a) => a.id === id)?.status;
        setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
        void updateAppointmentStatus(id, status).catch((error) => {
          if (anterior) setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status: anterior } : a)));
          persistError('Falha ao atualizar o atendimento', error);
        });
      },

      addAppointment: (a) => {
        if (!clinicId) return persistError('Clínica não identificada', new Error('clinicId ausente'));
        void insertAppointment(clinicId, a)
          .then((novo) => {
            setAppointments((prev) => [...prev, novo]);
            pushToast('Agendamento salvo.');
          })
          .catch((error) => persistError('Falha ao salvar agendamento', error));
      },

      addPatient: (p) => {
        if (!clinicId) return persistError('Clínica não identificada', new Error('clinicId ausente'));
        const payload: Omit<Patient, 'id' | 'createdAt'> = {
          ...p,
          anamnese: p.anamnese ?? { historia: '', cirurgias: '', medicamentos: '', alergias: '', objetivo: '' },
        };
        void insertPatient(clinicId, payload)
          .then((novo) => {
            setPatients((prev) => [novo, ...prev]);
            pushToast('Paciente salvo no Supabase.');
          })
          .catch((error) => persistError('Falha ao cadastrar paciente', error));
      },

      setFunilStage: (id, stage) => {
        const anterior = patients.find((p) => p.id === id)?.funilStage;
        setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, funilStage: stage } : p)));
        void updatePatientStage(id, stage).catch((error) => {
          if (anterior) setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, funilStage: anterior } : p)));
          persistError('Falha ao atualizar o funil', error);
        });
      },

      addEvolution: (e) => {
        if (!clinicId) return persistError('Clínica não identificada', new Error('clinicId ausente'));
        void insertEvolution(clinicId, e)
          .then((nova) => {
            setEvolutions((prev) => [nova, ...prev]);
            pushToast('Evolução clínica salva.');
          })
          .catch((error) => persistError('Falha ao salvar evolução clínica', error));
      },

      signConsent: (id, assinaturaUrl) => {
        const anterior = consents.find((c) => c.id === id);
        const agora = new Date().toISOString();
        setConsents((prev) => prev.map((c) => c.id === id ? { ...c, assinado: true, dataAssinatura: agora, assinaturaUrl: assinaturaUrl ?? c.assinaturaUrl } : c));
        void updateConsent(id, assinaturaUrl).catch((error) => {
          if (anterior) setConsents((prev) => prev.map((c) => c.id === id ? anterior : c));
          persistError('Falha ao registrar consentimento', error);
        });
      },

      setTxStatus: (id, status, metodo) => {
        const anterior = transactions.find((t) => t.id === id);
        setTransactions((prev) => prev.map((t) => t.id === id ? { ...t, status, metodo: metodo ?? t.metodo } : t));
        void updatePayment(id, status, metodo).catch((error) => {
          if (anterior) setTransactions((prev) => prev.map((t) => t.id === id ? anterior : t));
          persistError('Falha ao atualizar financeiro', error);
        });
      },

      addTransaction: (t) => {
        if (!clinicId) return persistError('Clínica não identificada', new Error('clinicId ausente'));
        void insertPayment(clinicId, t)
          .then((novo) => {
            setTransactions((prev) => [novo, ...prev]);
            pushToast('Lançamento financeiro salvo.');
          })
          .catch((error) => persistError('Falha ao salvar lançamento financeiro', error));
      },

      answerNps: (id, nota) => {
        const anterior = surveys.find((s) => s.id === id)?.nota ?? null;
        setSurveys((prev) => prev.map((s) => (s.id === id ? { ...s, nota } : s)));
        void updateSurvey(id, nota).catch((error) => {
          setSurveys((prev) => prev.map((s) => (s.id === id ? { ...s, nota: anterior } : s)));
          persistError('Falha ao registrar NPS', error);
        });
      },

      fecharRepasse: async (periodo) => {
        const anteriores = new Set(commissions.map((c) => c.id));
        const fechadas = await closeMonthlyCommissions(periodo);
        setCommissions((prev) => [
          ...fechadas,
          ...prev.filter((item) => !fechadas.some((closed) => closed.id === item.id)),
        ]);
        return fechadas.filter((item) => !anteriores.has(item.id)).length;
      },

      setCommissionStatus: async (id, status) => {
        if (status !== 'pago') throw new Error('Somente a baixa de repasse é permitida');
        const paid = await markCommissionPaid(id);
        setCommissions((prev) => prev.map((item) => item.id === id ? paid : item));
      },

      exportarTitular: (pacienteId) => {
        const p = patients.find((x) => x.id === pacienteId);
        return {
          formato: 'LGPD-portabilidade-v1',
          exportadoEm: new Date().toISOString(),
          exportadoPor: user?.nome ?? 'sistema',
          titular: p,
          sessoes: appointments.filter((a) => a.pacienteId === pacienteId),
          evolucoes: evolutions.filter((e) => e.pacienteId === pacienteId),
          consentimentos: consents.filter((c) => c.pacienteId === pacienteId).map(({ assinaturaUrl: _img, ...resto }) => resto),
          pesquisas: surveys.filter((s) => s.pacienteId === pacienteId),
          pacotes: patientPackages.filter((x) => x.pacienteId === pacienteId),
          financeiro: transactions.filter((t) => t.pacienteId === pacienteId),
        };
      },

      anonimizarPaciente: (pacienteId) => {
        const anterior = patients.find((p) => p.id === pacienteId);
        setPatients((prev) => prev.map((x) => x.id === pacienteId ? {
          ...x,
          nome: 'Paciente Anonizado', cpf: '', telefone: '', email: '', queixaPrincipal: '', convenio: null,
          cid10: [], ultimaVisita: null, optInWhats: false, status: 'inativo', anonimizado: true,
          anamnese: { historia: '', cirurgias: '', medicamentos: '', alergias: '', objetivo: '' },
        } : x));
        void anonymizePatient(pacienteId).catch((error) => {
          if (anterior) setPatients((prev) => prev.map((p) => p.id === pacienteId ? anterior : p));
          persistError('Falha ao anonimizar paciente', error);
        });
      },
    };
  }, [user, clinicId, users, unidades, rooms, patients, appointments, transactions, commissions, evolutions, consents, surveys, packages, patientPackages, waLogs, audit, toasts, unidadeSel, pushToast]);

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
    (a: { roomId: string }) => {
      if (unidadeSel === 'all') return true;
      const room = rooms.find((r) => r.id === a.roomId);
      return room ? room.unidadeId === unidadeSel : true;
    },
    [rooms, unidadeSel]
  );
}

export const patientName = (patients: Patient[], id: string) =>
  patients.find((p) => p.id === id)?.nome ?? '—';

export const userName = (users: User[], id: string) =>
  users.find((u) => u.id === id)?.nome ?? '—';
