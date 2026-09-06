import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mocks = vi.hoisted(() => ({ auth: {} as any, from: vi.fn() }));
vi.mock('./useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('./supabaseClient', () => ({ supabase: { from: mocks.from, rpc: async () => ({ data: [], error: null }) } }));
vi.mock('./repository', () => ({
  mapPatient: (row: any) => row,
  mapAppointment: (row: any) => row,
  mapPayment: (row: any) => row,
  insertPatient: vi.fn(), updatePatientStage: vi.fn(), anonymizePatient: vi.fn(),
  insertAppointment: vi.fn(), updateAppointmentStatus: vi.fn(),
  insertPayment: vi.fn(), updatePayment: vi.fn(), closeMonthlyCommissions: vi.fn(), markCommissionPaid: vi.fn(),
  insertEvolution: vi.fn(), updateConsent: vi.fn(), updateSurvey: vi.fn(),
}));

import { AgendaProvider, useAgenda } from './agendaContext';
import { FinanceProvider, useFinance } from './financeContext';
import { PatientProvider, usePatients } from './patientContext';
import { ClinicalProvider, useClinical } from './clinicalContext';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

const auth = () => ({ profile: { id: 'user', clinic_id: 'clinic', role: 'owner', ativo: true }, tenantAccessState: 'active' });
const immediateQuery = () => {
  const query: any = { select: () => query, eq: () => query, is: () => query, order: () => Promise.resolve({ data: [], error: null }) };
  return query;
};
function pendingQueries() {
  const pending: Array<ReturnType<typeof deferred<{ data: any[]; error: null }>>> = [];
  mocks.from.mockImplementation(() => {
    const result = deferred<{ data: any[]; error: null }>();
    pending.push(result);
    const query: any = { select: () => query, eq: () => query, is: () => query, order: () => result.promise };
    return query;
  });
  return pending;
}

let renderer: ReactTestRenderer | undefined;
afterEach(() => {
  if (renderer) act(() => renderer?.unmount());
  renderer = undefined;
  vi.clearAllMocks();
});

async function mount(element: React.ReactElement) {
  mocks.auth = auth();
  mocks.from.mockImplementation(immediateQuery);
  await act(async () => { renderer = create(element); });
}

const clinicalRow = (id: string) => ({
  id, patient_id: 'patient', professional_id: 'user', created_at: '2026-09-06T12:00:00Z',
  texto: id, anexos: [], nome: id, versao: '1', assinado: false, data_assinatura: null,
  hash: id, assinatura_url: null, ip: null, nota: null, comentario: null, data: '2026-09-06',
});

describe('same-session refresh ordering', () => {
  it('keeps the latest agenda refresh', async () => {
    let state!: ReturnType<typeof useAgenda>;
    function Probe() { state = useAgenda(); return null; }
    await mount(<AgendaProvider><Probe /></AgendaProvider>);
    const pending = pendingQueries();
    let first!: Promise<void>; let second!: Promise<void>;
    act(() => { first = state.refreshAgenda(); second = state.refreshAgenda(); });
    expect(pending).toHaveLength(2);
    await act(async () => { pending[1].resolve({ data: [{ id: 'new' }], error: null }); await second; });
    await act(async () => { pending[0].resolve({ data: [{ id: 'old' }], error: null }); await first; });
    expect(state.appointments.map((item) => item.id)).toEqual(['new']);
    expect(state.loading).toBe(false);
  });

  it('keeps the latest finance refresh', async () => {
    let state!: ReturnType<typeof useFinance>;
    function Probe() { state = useFinance(); return null; }
    await mount(<FinanceProvider><Probe /></FinanceProvider>);
    const pending = pendingQueries();
    let first!: Promise<void>; let second!: Promise<void>;
    act(() => { first = state.refreshFinance(); second = state.refreshFinance(); });
    expect(pending).toHaveLength(4);
    await act(async () => {
      pending[2].resolve({ data: [{ id: 'new-payment' }], error: null });
      pending[3].resolve({ data: [], error: null });
      await second;
    });
    await act(async () => {
      pending[0].resolve({ data: [{ id: 'old-payment' }], error: null });
      pending[1].resolve({ data: [], error: null });
      await first;
    });
    expect(state.transactions.map((item) => item.id)).toEqual(['new-payment']);
    expect(state.loading).toBe(false);
  });

  it('keeps the latest patient refresh', async () => {
    let state!: ReturnType<typeof usePatients>;
    function Probe() { state = usePatients(); return null; }
    await mount(<PatientProvider><Probe /></PatientProvider>);
    const pending = pendingQueries();
    let first!: Promise<void>; let second!: Promise<void>;
    act(() => { first = state.refreshPatients(); second = state.refreshPatients(); });
    expect(pending).toHaveLength(2);
    await act(async () => { pending[1].resolve({ data: [{ id: 'new' }], error: null }); await second; });
    await act(async () => { pending[0].resolve({ data: [{ id: 'old' }], error: null }); await first; });
    expect(state.patients.map((item) => item.id)).toEqual(['new']);
    expect(state.loading).toBe(false);
  });

  it('keeps the latest clinical refresh', async () => {
    let state!: ReturnType<typeof useClinical>;
    function Probe() { state = useClinical(); return null; }
    await mount(<ClinicalProvider><Probe /></ClinicalProvider>);
    const pending = pendingQueries();
    let first!: Promise<void>; let second!: Promise<void>;
    act(() => { first = state.refreshClinical(); second = state.refreshClinical(); });
    expect(pending).toHaveLength(6);
    await act(async () => {
      pending[3].resolve({ data: [clinicalRow('new-evolution')], error: null });
      pending[4].resolve({ data: [clinicalRow('new-consent')], error: null });
      pending[5].resolve({ data: [clinicalRow('new-survey')], error: null });
      await second;
    });
    await act(async () => {
      pending[0].resolve({ data: [clinicalRow('old-evolution')], error: null });
      pending[1].resolve({ data: [clinicalRow('old-consent')], error: null });
      pending[2].resolve({ data: [clinicalRow('old-survey')], error: null });
      await first;
    });
    expect(state.evolutions.map((item) => item.id)).toEqual(['new-evolution']);
    expect(state.consents.map((item) => item.id)).toEqual(['new-consent']);
    expect(state.surveys.map((item) => item.id)).toEqual(['new-survey']);
    expect(state.loading).toBe(false);
  });
});
