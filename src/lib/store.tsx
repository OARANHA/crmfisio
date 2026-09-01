import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { addDays, addWeeks, format, getDay } from 'date-fns';
import type {
  Access, Appointment, AppointmentStatus, AuditEntry, Commission, ConsentTerm, Evolution,
  FinancialTransaction, FunilStage, ModuleKey, NpsSurvey, Patient, PatientPackage,
  RecurrenceRule, Role, SessionPackage, Unidade, User, WaLog, WaStatus,
} from './types';
import { seedUnidades, seedRooms, seedCommissions, seedRecurrence } from './seed';
import {
  anonymizePatient,
  insertAppointment,
  insertEvolution,
  insertPatient,
  insertPayment,
  loadClinicData,
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

export interface SeriePatch {
  diasSemana: number[];
  hora: string;
  duracaoMin: number;
  semanas: number;
  fisioId: string;
  roomId: string;
}

interface AppState {
  user: User | null;
  users: User[];
  setAuthenticatedUser: (user: User | null) => void;
  unidades: Unidade[];
  unidadeSel: string;
  setUnidadeSel: (v: string) => void;
  rooms: typeof seedRooms;
  packages: SessionPackage[];
  patientPackages: PatientPackage[];
  patients: Patient[];
  appointments: Appointment[];
  transactions: FinancialTransaction[];
  commissions: Commission[];
  evolutions: Evolution[];
  consents: ConsentTerm[];
  surveys: NpsSurvey[];
  recurrence: RecurrenceRule[];
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
  venderPacote: (pacienteId: string, pacoteId: string) => void;
  answerNps: (id: string, nota: number) => void;

  upsertRegra: (r: RecurrenceRule) => void;
  editarSerie: (serieId: string, patch: SeriePatch) => number;
  cancelarSerie: (serieId: string) => number;

  enviarLembretes: () => number;
  enviarNps: () => number;
  reativarInativos: () => number;

  fecharRepasse: (periodo: string) => number;
  setCommissionStatus: (id: string, status: Commission['status']) => void;

  exportarTitular: (pacienteId: string) => Record<string, unknown>;
  anonimizarPaciente: (pacienteId: string) => void;
}

const Ctx = createContext<AppState | null>(null);

let seq = 1000;
const nid = (p: string) => `${p}${++seq}`;
const hojeIso = () => format(new Date(), 'yyyy-MM-dd');
const DATA_KEY = 'data';
const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};
const toHHMM = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function expandSerie(rule: RecurrenceRule, fromDate: string, semanas: number): Omit<Appointment, 'id'>[] {
  const out: Omit<Appointment, 'id'>[] = [];
  const start = new Date(fromDate + 'T12:00');
  const fim = toHHMM(toMin(rule.hora) + rule.duracaoMin);
  for (let w = 0; w < semanas; w++) {
    for (const dw of rule.diasSemana) {
      const weekBase = addWeeks(start, w);
      const day = addDays(weekBase, dw - getDay(weekBase));
      if (day < start) continue;
      const quando = format(day, 'yyyy-MM-dd');
      out.push({
        pacienteId: rule.pacienteId,
        fisioId: rule.fisioId,
        roomId: rule.roomId,
        inicio: rule.hora,
        fim,
        status: 'agendado',
        tipo: rule.tipo,
        valor: rule.valor,
        pacoteId: null,
        serieId: rule.id,
        notas: '',
        [DATA_KEY]: quando,
      } as Omit<Appointment, 'id'>);
    }
  }
  return out;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [clinicId, setClinicId] = useState<string | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>(seedCommissions);
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [consents, setConsents] = useState<ConsentTerm[]>([]);
  const [surveys, setSurveys] = useState<NpsSurvey[]>([]);
  const [packages, setPackages] = useState<SessionPackage[]>([]);
  const [patientPackages, setPatientPackages] = useState<PatientPackage[]>([]);
  const [recurrence, setRecurrence] = useState<RecurrenceRule[]>(seedRecurrence);
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
      setPatients([]);
      setAppointments([]);
      setTransactions([]);
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
      .then((data) => {
        if (cancelled) return;
        setClinicId(data.clinicId);
        setUsers(data.users);
        setPatients(data.patients);
        setAppointments(data.appointments);
        setTransactions(data.transactions);
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

    const logLocal = (acao: string, detalhe: string) => {
      setAudit((prev) => [
        { id: nid('log'), ts: new Date().toISOString(), usuarioId: user?.id ?? 'system', acao, detalhe },
        ...prev,
      ]);
    };

    const persistError = (label: string, error: unknown) => {
      console.error(`[MedicsPro] ${label}:`, error);
      pushToast(`${label}. Tente novamente.`, 'warn');
    };

    const pushWa = (pacienteId: string, template: WaLog['template'], mensagem: string) => {
      const id = nid('w');
      const entry: WaLog = { id, pacienteId, template, mensagem, enviadoEm: new Date().toISOString(), status: 'enviando' };
      setWaLogs((prev) => [entry, ...prev]);
      const t1 = 500 + Math.random() * 500;
      const advance = (status: WaStatus, delay: number) =>
        window.setTimeout(() => setWaLogs((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w))), delay);
      advance('enviado', t1);
      advance('entregue', t1 + 1100 + Math.random() * 700);
      if (template !== 'nps') advance('lido', t1 + 2800 + Math.random() * 1400);
    };

    return {
      user,
      setAuthenticatedUser: setUser,
      users,
      unidades: seedUnidades,
      unidadeSel,
      setUnidadeSel,
      rooms: seedRooms,
      packages,
      patientPackages,
      patients,
      appointments,
      transactions,
      commissions,
      evolutions,
      consents,
      surveys,
      recurrence,
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

      venderPacote: (pacienteId, pacoteId) => {
        const pk = packages.find((x) => x.id === pacoteId);
        const p = patients.find((x) => x.id === pacienteId);
        if (!pk || !p || !clinicId) return;
        pushToast('Venda de pacote será persistida na próxima etapa do core.', 'info');
      },

      answerNps: (id, nota) => {
        const anterior = surveys.find((s) => s.id === id)?.nota ?? null;
        setSurveys((prev) => prev.map((s) => (s.id === id ? { ...s, nota } : s)));
        void updateSurvey(id, nota).catch((error) => {
          setSurveys((prev) => prev.map((s) => (s.id === id ? { ...s, nota: anterior } : s)));
          persistError('Falha ao registrar NPS', error);
        });
      },

      upsertRegra: (r) => setRecurrence((prev) => [...prev.filter((x) => x.id !== r.id), r]),

      editarSerie: (serieId, patch) => {
        const hoje = hojeIso();
        let geradas = 0;
        setAppointments((prev) => {
          const any = prev.find((a) => a.serieId === serieId);
          if (!any) return prev;
          const rule: RecurrenceRule = {
            id: serieId,
            pacienteId: any.pacienteId,
            fisioId: patch.fisioId,
            roomId: patch.roomId,
            tipo: any.tipo,
            diasSemana: patch.diasSemana,
            hora: patch.hora,
            duracaoMin: patch.duracaoMin,
            inicio: hoje,
            fim: format(addWeeks(new Date(hoje + 'T12:00'), patch.semanas), 'yyyy-MM-dd'),
            valor: any.valor,
          };
          const kept = prev.filter((a) => !(a.serieId === serieId && a.data >= hoje));
          const novas: Appointment[] = expandSerie(rule, hoje, patch.semanas).map((x) => ({ ...x, id: nid('a') }));
          geradas = novas.length;
          setRecurrence((rs) => [...rs.filter((x) => x.id !== serieId), rule]);
          pushToast('Série editada localmente; persistência de recorrência entra na próxima etapa.', 'info');
          return [...kept, ...novas];
        });
        return geradas;
      },

      cancelarSerie: (serieId) => {
        const hoje = hojeIso();
        let removidas = 0;
        setAppointments((prev) => {
          removidas = prev.filter((a) => a.serieId === serieId && a.data >= hoje).length;
          return prev.filter((a) => !(a.serieId === serieId && a.data >= hoje));
        });
        setRecurrence((rs) => rs.filter((x) => x.id !== serieId));
        pushToast('Série cancelada localmente; persistência de recorrência entra na próxima etapa.', 'info');
        return removidas;
      },

      enviarLembretes: () => {
        const hoje = hojeIso();
        const limite = format(addDays(new Date(), 2), 'yyyy-MM-dd');
        const alvos = appointments
          .filter((a) => (a.status === 'agendado' || a.status === 'confirmado') && a.data >= hoje && a.data <= limite)
          .map((a) => ({ a, p: patients.find((p) => p.id === a.pacienteId) }))
          .filter((x) => x.p?.optInWhats);
        alvos.forEach(({ a, p }) => pushWa(p!.id, 'confirmacao', `Olá, ${p!.nome.split(' ')[0]}! Sua sessão de ${a.tipo} está marcada para ${format(new Date(a.data + 'T12:00'), 'dd/MM')} às ${a.inicio}. Responda *SIM* para confirmar. 💚`));
        if (alvos.length) logLocal('DISPARO_WHATSAPP', `${alvos.length} confirmação(ões) simulada(s)`);
        return alvos.length;
      },

      enviarNps: () => {
        const corte = format(addDays(new Date(), -7), 'yyyy-MM-dd');
        const hoje = hojeIso();
        const recentes = appointments.filter((a) => a.status === 'finalizado' && a.data >= corte && a.data <= hoje);
        const vistos = new Set<string>();
        let n = 0;
        recentes.forEach((a) => {
          if (vistos.has(a.pacienteId)) return;
          vistos.add(a.pacienteId);
          const p = patients.find((x) => x.id === a.pacienteId);
          if (!p?.optInWhats) return;
          pushWa(p.id, 'nps', `Olá, ${p.nome.split(' ')[0]}! Como você avalia seu atendimento recente? Responda de 0 a 10.`);
          n++;
        });
        return n;
      },

      reativarInativos: () => {
        const inativos = patients.filter((p) => p.status === 'inativo' && p.optInWhats && !p.anonimizado);
        inativos.forEach((p) => pushWa(p.id, 'reativacao', `Olá, ${p.nome.split(' ')[0]}! Sentimos sua falta. Que tal retomar seu tratamento?`));
        return inativos.length;
      },

      fecharRepasse: (periodo) => {
        const bases = new Map<string, number>();
        appointments.filter((a) => a.status === 'finalizado' && a.data.startsWith(periodo)).forEach((a) => bases.set(a.fisioId, (bases.get(a.fisioId) ?? 0) + a.valor));
        const novas: Commission[] = [...bases.entries()]
          .filter(([fisioId, base]) => base > 0 && !commissions.some((c) => c.periodo === periodo && c.fisioId === fisioId))
          .map(([fisioId, base]) => ({ id: nid('c'), fisioId, periodo, base, percentual: 40, status: 'aberto' }));
        if (novas.length) setCommissions((prev) => [...novas, ...prev]);
        return novas.length;
      },

      setCommissionStatus: (id, status) => setCommissions((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c))),

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
  }, [user, clinicId, users, patients, appointments, transactions, commissions, evolutions, consents, surveys, packages, patientPackages, recurrence, waLogs, audit, toasts, unidadeSel, pushToast]);

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
