import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { addDays, addWeeks, format, getDay } from 'date-fns';
import type {
  Access, Appointment, AppointmentStatus, AuditEntry, Commission, ConsentTerm, Evolution,
  FinancialTransaction, FunilStage, ModuleKey, NpsSurvey, Patient, PatientPackage,
  RecurrenceRule, Role, SessionPackage, Unidade, User, WaLog, WaStatus,
} from './types';
import {
  seedUsers, seedUnidades, seedRooms, seedPatients, seedAppointments, seedPackages,
  seedPatientPackages, seedTransactions, seedCommissions, seedEvolutions,
  seedConsents, seedNps, seedRecurrence, seedWaLogs, seedAudit,
} from './seed';

// Matriz RBAC aprovada no Passo 2 — aplicada também na API (Guards), aqui na UI.
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
  unidades: Unidade[];
  unidadeSel: string; // 'all' | unidadeId
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

  // Fase 3 — LGPD self-service
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

/** Expande uma regra de recorrência em sessões concretas. */
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
        pacienteId: rule.pacienteId, fisioId: rule.fisioId, roomId: rule.roomId,
        inicio: rule.hora, fim,
        status: 'agendado', tipo: rule.tipo, valor: rule.valor, pacoteId: null,
        serieId: rule.id, notas: '',
        [DATA_KEY]: quando,
      } as Omit<Appointment, 'id'>);
    }
  }
  return out;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [patients, setPatients] = useState<Patient[]>(seedPatients);
  const [appointments, setAppointments] = useState<Appointment[]>(seedAppointments);
  const [transactions, setTransactions] = useState<FinancialTransaction[]>(seedTransactions);
  const [commissions, setCommissions] = useState<Commission[]>(seedCommissions);
  const [evolutions, setEvolutions] = useState<Evolution[]>(seedEvolutions);
  const [consents, setConsents] = useState<ConsentTerm[]>(seedConsents);
  const [surveys, setSurveys] = useState<NpsSurvey[]>(seedNps);
  const [patientPackages, setPatientPackages] = useState<PatientPackage[]>(seedPatientPackages);
  const [recurrence, setRecurrence] = useState<RecurrenceRule[]>(seedRecurrence);
  const [waLogs, setWaLogs] = useState<WaLog[]>(seedWaLogs);
  const [audit, setAudit] = useState<AuditEntry[]>(seedAudit);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [unidadeSel, setUnidadeSel] = useState<string>('all');

  const value = useMemo<AppState>(() => {
    const access = (m: ModuleKey): Access => (user ? ACCESS[user.role][m] : 'none');
    const canView = (m: ModuleKey) => access(m) !== 'none';

    const toast = (msg: string, kind: Toast['kind'] = 'ok') => {
      const id = ++seq;
      setToasts((t) => [...t.slice(-3), { id, msg, kind }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4400);
    };

    const log = (acao: string, detalhe: string) =>
      setAudit((prev) => [
        { id: nid('log'), ts: new Date().toISOString(), usuarioId: user?.id ?? 'system', acao, detalhe },
        ...prev,
      ]);

    // fila simulada de disparos: enviando → enviado → entregue → lido
    const pushWa = (pacienteId: string, template: WaLog['template'], mensagem: string) => {
      const id = nid('w');
      const entry: WaLog = { id, pacienteId, template, mensagem, enviadoEm: new Date().toISOString(), status: 'enviando' };
      setWaLogs((prev) => [entry, ...prev]);
      const t1 = 500 + Math.random() * 500;
      const advance = (status: WaStatus, delay: number) =>
        setTimeout(() => setWaLogs((prev) => prev.map((w) => (w.id === id ? { ...w, status } : w))), delay);
      advance('enviado', t1);
      advance('entregue', t1 + 1100 + Math.random() * 700);
      if (template !== 'nps') advance('lido', t1 + 2800 + Math.random() * 1400);
    };

    return {
      user,
      users: seedUsers,
      unidades: seedUnidades,
      unidadeSel,
      setUnidadeSel,
      rooms: seedRooms,
      packages: seedPackages,
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

      login: (userId) => {
        const u = seedUsers.find((x) => x.id === userId) ?? null;
        setUser(u);
        if (u) log('LOGIN', `Sessão iniciada — ${u.nome} (${u.role})`);
      },
      logout: () => {
        if (user) log('LOGOUT', `Sessão encerrada — ${user.nome}`);
        setUser(null);
      },
      access,
      canView,
      toast,

      setAppointmentStatus: (id, status) => {
        setAppointments((prev) => prev.map((a) => (a.id === id ? { ...a, status } : a)));
        const a = appointments.find((x) => x.id === id);
        const p = patients.find((x) => x.id === a?.pacienteId);
        log('STATUS_SESSAO', `${p?.nome ?? id} → ${status}`);
      },

      addAppointment: (a) => {
        setAppointments((prev) => [...prev, { ...a, id: nid('a') }]);
        const p = patients.find((x) => x.id === a.pacienteId);
        log('AGENDAMENTO', `${p?.nome ?? ''} · ${a.tipo} · ${a[DATA_KEY as 'data']} ${a.inicio}`);
      },

      addPatient: (p) => {
        const novo: Patient = {
          ...p,
          id: nid('p'),
          createdAt: hojeIso(),
          anamnese: p.anamnese ?? { historia: '', cirurgias: '', medicamentos: '', alergias: '', objetivo: '' },
        };
        setPatients((prev) => [novo, ...prev]);
        log('CADASTRO_PACIENTE', `${novo.nome} — dados sensíveis criptografados em repouso`);
      },

      setFunilStage: (id, stage) =>
        setPatients((prev) => prev.map((p) => (p.id === id ? { ...p, funilStage: stage } : p))),

      addEvolution: (e) => {
        setEvolutions((prev) => [{ ...e, id: nid('e') }, ...prev]);
        log('EVOLUCAO_CLINICA', `Registro clínico — paciente ${e.pacienteId}`);
      },

      signConsent: (id, assinaturaUrl) => {
        setConsents((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  assinado: true,
                  dataAssinatura: hojeIso(),
                  hash: Math.random().toString(16).slice(2, 6) + '…' + Math.random().toString(16).slice(2, 6),
                  assinaturaUrl: assinaturaUrl ?? c.assinaturaUrl ?? null,
                  ip: `200.147.${Math.floor(Math.random() * 200)}.${Math.floor(Math.random() * 200)} (registrado)`,
                }
              : c
          )
        );
        const c = consents.find((x) => x.id === id);
        const p = patients.find((x) => x.id === c?.pacienteId);
        log('ASSINATURA_TERMO', `${c?.nome ?? id} — ${p?.nome ?? ''}`);
      },

      setTxStatus: (id, status, metodo) =>
        setTransactions((prev) =>
          prev.map((t) => (t.id === id ? { ...t, status, metodo: metodo ?? t.metodo } : t))
        ),

      addTransaction: (t) => setTransactions((prev) => [{ ...t, id: nid('t') }, ...prev]),

      venderPacote: (pacienteId, pacoteId) => {
        const pk = seedPackages.find((x) => x.id === pacoteId);
        const p = patients.find((x) => x.id === pacienteId);
        if (!pk || !p) return;
        setPatientPackages((prev) => [
          { id: nid('pp'), pacienteId, pacoteId, sessoesTotais: pk.sessoes, sessoesUsadas: 0, compraData: hojeIso(), valorPago: pk.preco, status: 'ativo' },
          ...prev,
        ]);
        setTransactions((prev) => [
          { id: nid('t'), tipo: 'receber', descricao: `${pk.nome} — ${p.nome}`, categoria: 'Pacotes', valor: pk.preco, vencimento: hojeIso(), status: 'pendente', pacienteId, metodo: null },
          ...prev,
        ]);
        log('VENDA_PACOTE', `${pk.nome} — ${p.nome}`);
      },

      answerNps: (id, nota) =>
        setSurveys((prev) => prev.map((s) => (s.id === id ? { ...s, nota } : s))),

      /* ------------------------- recorrências (F2) ------------------------- */

      upsertRegra: (r) =>
        setRecurrence((prev) => [...prev.filter((x) => x.id !== r.id), r]),

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
          const kept = prev.filter((a) => !(a.serieId === serieId && a[DATA_KEY as 'data'] >= hoje));
          const novas: Appointment[] = expandSerie(rule, hoje, patch.semanas).map((x) => ({ ...x, id: nid('a') }));
          geradas = novas.length;
          setRecurrence((rs) => [...rs.filter((x) => x.id !== serieId), rule]);
          return [...kept, ...novas];
        });
        return geradas;
      },

      cancelarSerie: (serieId) => {
        const hoje = hojeIso();
        let removidas = 0;
        setAppointments((prev) => {
          removidas = prev.filter((a) => a.serieId === serieId && a[DATA_KEY as 'data'] >= hoje).length;
          return prev.filter((a) => !(a.serieId === serieId && a[DATA_KEY as 'data'] >= hoje));
        });
        setRecurrence((rs) => rs.filter((x) => x.id !== serieId));
        return removidas;
      },

      /* --------------------------- mensageria (F2) --------------------------- */

      enviarLembretes: () => {
        const hoje = hojeIso();
        const limite = format(addDays(new Date(), 2), 'yyyy-MM-dd');
        const alvos = appointments
          .filter((a) => (a.status === 'agendado' || a.status === 'confirmado') && a[DATA_KEY as 'data'] >= hoje && a[DATA_KEY as 'data'] <= limite)
          .map((a) => ({ a, p: patients.find((p) => p.id === a.pacienteId) }))
          .filter((x) => x.p?.optInWhats);
        alvos.forEach(({ a, p }) =>
          pushWa(
            p!.id,
            'confirmacao',
            `Olá, ${p!.nome.split(' ')[0]}! Sua sessão de ${a.tipo} está marcada para ${format(new Date(a[DATA_KEY as 'data'] + 'T12:00'), 'dd/MM')} às ${a.inicio}. Responda *SIM* para confirmar. 💚`
          )
        );
        if (alvos.length) log('DISPARO_WHATSAPP', `${alvos.length} confirmação(ões) de sessão enfileiradas`);
        return alvos.length;
      },

      enviarNps: () => {
        const corte = format(addDays(new Date(), -7), 'yyyy-MM-dd');
        const hoje = hojeIso();
        const recentes = appointments.filter((a) => a.status === 'finalizado' && a[DATA_KEY as 'data'] >= corte && a[DATA_KEY as 'data'] <= hoje);
        const vistos = new Set<string>();
        let n = 0;
        recentes.forEach((a) => {
          if (vistos.has(a.pacienteId)) return;
          vistos.add(a.pacienteId);
          const p = patients.find((x) => x.id === a.pacienteId);
          if (!p?.optInWhats) return;
          if (surveys.some((s) => s.pacienteId === p.id && s.nota === null)) return;
          pushWa(
            p.id,
            'nps',
            `Olá, ${p.nome.split(' ')[0]}! Como você avalia seu atendimento recente? Responda de 0 a 10 — sua opinião direciona nosso cuidado. 🩺`
          );
          setSurveys((prev) => [{ id: nid('n'), pacienteId: p.id, nota: null, comentario: '', [DATA_KEY]: hoje } as NpsSurvey, ...prev]);
          n++;
        });
        if (n) log('DISPARO_NPS', `${n} pesquisa(s) de satisfação enfileirada(s)`);
        return n;
      },

      reativarInativos: () => {
        const inativos = patients.filter((p) => p.status === 'inativo' && p.optInWhats && !p.anonimizado);
        inativos.forEach((p) =>
          pushWa(
            p.id,
            'reativacao',
            `Olá, ${p.nome.split(' ')[0]}! Sentimos sua falta no Coração. Que tal retomar seu tratamento? Temos horários disponíveis esta semana. 💚`
          )
        );
        if (inativos.length) log('REATIVACAO', `${inativos.length} paciente(s) inativo(s) contatado(s)`);
        return inativos.length;
      },

      /* ------------------------------ repasse (F2) ------------------------------ */

      fecharRepasse: (periodo) => {
        const bases = new Map<string, number>();
        appointments
          .filter((a) => a.status === 'finalizado' && a[DATA_KEY as 'data'].startsWith(periodo))
          .forEach((a) => bases.set(a.fisioId, (bases.get(a.fisioId) ?? 0) + a.valor));
        const novas: Commission[] = [...bases.entries()]
          .filter(([fisioId, base]) => base > 0 && !commissions.some((c) => c.periodo === periodo && c.fisioId === fisioId))
          .map(([fisioId, base]) => ({ id: nid('c'), fisioId, periodo, base, percentual: 40, status: 'aberto' }));
        if (novas.length) {
          setCommissions((prev) => [...novas, ...prev]);
          log('FECHAMENTO_REPASSE', `${periodo} — ${novas.length} comissão(ões) gerada(s)`);
        }
        return novas.length;
      },

      setCommissionStatus: (id, status) =>
        setCommissions((prev) => prev.map((c) => (c.id === id ? { ...c, status } : c))),

      /* --------------------------- LGPD self-service (F3) --------------------------- */

      exportarTitular: (pacienteId) => {
        const p = patients.find((x) => x.id === pacienteId);
        const pacote = {
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
        log('EXPORTACAO_LGPD', `Portabilidade completa — ${p?.nome ?? pacienteId}`);
        return pacote;
      },

      anonimizarPaciente: (pacienteId) => {
        const p = patients.find((x) => x.id === pacienteId);
        setPatients((prev) =>
          prev.map((x) =>
            x.id === pacienteId
              ? {
                  ...x,
                  nome: 'Paciente Anonizado',
                  cpf: '000.000.000-00',
                  telefone: '',
                  email: '',
                  queixaPrincipal: '—',
                  convenio: null,
                  cid10: [],
                  ultimaVisita: null,
                  optInWhats: false,
                  status: 'inativo',
                  anonimizado: true,
                  anamnese: { historia: '', cirurgias: '', medicamentos: '', alergias: '', objetivo: '' },
                }
              : x
          )
        );
        log('ANONIMIZACAO_LGPD', `Direito ao esquecimento exercido — registro ${pacienteId} (${p?.nome ?? ''})`);
      },
    };
  }, [user, patients, appointments, transactions, commissions, evolutions, consents, surveys, patientPackages, recurrence, waLogs, audit, toasts, unidadeSel]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp fora do AppProvider');
  return ctx;
}

/** Filtro por unidade (Fase 3): sessões são vinculadas via sala. */
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

// utils compartilhados
export const patientName = (patients: Patient[], id: string) =>
  patients.find((p) => p.id === id)?.nome ?? '—';

export const userName = (users: User[], id: string) =>
  users.find((u) => u.id === id)?.nome ?? '—';
