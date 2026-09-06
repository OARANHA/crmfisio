import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mocks = vi.hoisted(() => ({ auth: {} as any, from: vi.fn(), insert: vi.fn(), update: vi.fn() }));
vi.mock('./useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('./supabaseClient', () => ({ supabase: { from: mocks.from, rpc: async () => ({ data: [], error: null }) } }));
vi.mock('./repository', () => ({
  mapPatient: (row: unknown) => row, mapAppointment: (row: unknown) => row, mapPayment: (row: unknown) => row,
  insertPatient: mocks.insert, insertAppointment: mocks.insert, insertPayment: mocks.insert, insertEvolution: mocks.insert,
  updatePatientStage: mocks.update, updateAppointmentStatus: mocks.update,
  anonymizePatient: vi.fn(), updatePayment: vi.fn(), closeMonthlyCommissions: vi.fn(), markCommissionPaid: vi.fn(),
  updateConsent: vi.fn(), updateSurvey: vi.fn(),
}));

import { ClinicDataBoundary } from './ClinicDataBoundary';
import { PatientProvider, usePatients } from './patientContext';
import { AgendaProvider, useAgenda } from './agendaContext';
import { FinanceProvider, useFinance } from './financeContext';
import { ClinicalProvider, useClinical } from './clinicalContext';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function auth(clinic = 'a', role = 'owner') {
  return { session: { user: { id: 'user' }, access_token: 'token' }, profile: { id: 'user', clinic_id: clinic, role, ativo: true }, tenantAccessState: 'active' };
}
let latest: { patients: ReturnType<typeof usePatients>; agenda: ReturnType<typeof useAgenda>; finance: ReturnType<typeof useFinance>; clinical: ReturnType<typeof useClinical> };
function Probe() {
  latest = { patients: usePatients(), agenda: useAgenda(), finance: useFinance(), clinical: useClinical() };
  return null;
}
function Tree() {
  return <ClinicDataBoundary><PatientProvider><AgendaProvider><FinanceProvider><ClinicalProvider><Probe /></ClinicalProvider></FinanceProvider></AgendaProvider></PatientProvider></ClinicDataBoundary>;
}
let renderer: ReactTestRenderer;
afterEach(() => { if (renderer) act(() => renderer.unmount()); vi.clearAllMocks(); });

function setupQueries(pendingClinic?: string) {
  const pending: Array<ReturnType<typeof deferred<{ data: any[]; error: null }>>> = [];
  mocks.from.mockImplementation(() => {
    let clinic = '';
    const query: any = {
      select: () => query, is: () => query,
      eq: (field: string, value: string) => { if (field === 'clinic_id') clinic = value; return query; },
      order: () => {
        if (clinic !== pendingClinic) return Promise.resolve({ data: [], error: null });
        const result = deferred<{ data: any[]; error: null }>();
        pending.push(result);
        return result.promise;
      },
    };
    return query;
  });
  return pending;
}
async function mount() { await act(async () => { renderer = create(<Tree />); }); }
async function rerender() { await act(async () => { renderer.update(<Tree />); }); }
function expectEmpty() {
  expect(latest.patients.patients).toEqual([]);
  expect(latest.agenda.appointments).toEqual([]);
  expect(latest.finance.transactions).toEqual([]);
  expect(latest.finance.commissions).toEqual([]);
  expect(latest.clinical.evolutions).toEqual([]);
  expect(latest.clinical.consents).toEqual([]);
  expect(latest.clinical.surveys).toEqual([]);
}

describe('clinic session lifetime', () => {
  it.each(['clinic', 'logout', 'role', 'suspension', 'user', 'inactive'])('discards late loads from every provider after %s changes', async (change) => {
    mocks.auth = auth();
    const pending = setupQueries('a');
    await mount();
    expect(pending).toHaveLength(7);
    if (change === 'clinic') mocks.auth = auth('b');
    if (change === 'logout') mocks.auth = { session: null, profile: null, tenantAccessState: 'unauthenticated' };
    if (change === 'role') mocks.auth = auth('a', 'recep');
    if (change === 'suspension') mocks.auth = { ...auth(), tenantAccessState: 'suspended' };
    if (change === 'user') mocks.auth = { ...auth(), session: { user: { id: 'other' } }, profile: { ...auth().profile, id: 'other' } };
    if (change === 'inactive') mocks.auth = { ...auth(), profile: { ...auth().profile, ativo: false }, tenantAccessState: 'inactive_profile' };
    setupQueries();
    await rerender();
    await act(async () => {
      for (const result of pending) result.resolve({ data: [{ id: 'old', created_at: '2026-09-06', period: '2026-09', patient_id: 'old-patient' }], error: null });
    });
    expectEmpty();
    expect(latest.clinical.error).toBeNull();
    expect(latest.finance.loading).toBe(false);
  });

  it.each(['patient', 'agenda', 'finance', 'clinical'])('does not insert a late %s mutation into a new session', async (domain) => {
    mocks.auth = auth(); setupQueries(); await mount();
    const result = deferred<any>(); mocks.insert.mockReturnValue(result.promise);
    let operation!: Promise<unknown>;
    act(() => {
      if (domain === 'patient') operation = latest.patients.addPatient({} as any);
      if (domain === 'agenda') operation = latest.agenda.addAppointment({} as any);
      if (domain === 'finance') operation = latest.finance.addTransaction({} as any);
      if (domain === 'clinical') operation = latest.clinical.addEvolution({} as any);
    });
    mocks.auth = auth('b'); await rerender();
    await act(async () => { result.resolve({ id: 'old' }); await operation; });
    expectEmpty();
  });

  it.each(['patient', 'agenda'])('ignores an old %s rollback after a clinic change', async (domain) => {
    mocks.auth = auth(); setupQueries(); await mount();
    mocks.insert.mockResolvedValue({ id: 'same-id', status: 'agendado', funilStage: 'lead' });
    await act(async () => {
      if (domain === 'patient') await latest.patients.addPatient({} as any);
      else await latest.agenda.addAppointment({} as any);
    });
    const result = deferred<void>(); mocks.update.mockReturnValue(result.promise);
    let operation!: Promise<unknown>;
    act(() => {
      operation = (domain === 'patient'
        ? latest.patients.setFunilStage('same-id', 'tratamento')
        : latest.agenda.setAppointmentStatus('same-id', 'confirmado')).catch(() => undefined);
    });
    mocks.auth = auth('b'); await rerender();
    const current = { id: 'same-id', status: 'finalizado', funilStage: 'alta' };
    mocks.insert.mockResolvedValue(current);
    await act(async () => {
      if (domain === 'patient') await latest.patients.addPatient({} as any);
      else await latest.agenda.addAppointment({} as any);
    });
    await act(async () => { result.reject(new Error('old failure')); await operation; });
    expect(domain === 'patient' ? latest.patients.patients : latest.agenda.appointments).toEqual([current]);
  });

  it('preserves state and avoids reloading on token renewal', async () => {
    mocks.auth = auth(); setupQueries(); await mount();
    mocks.insert.mockResolvedValue({ id: 'existing' });
    await act(async () => { await latest.patients.addPatient({} as any); });
    const reads = mocks.from.mock.calls.length;
    mocks.auth = { ...auth(), session: { ...auth().session, access_token: 'renewed' } };
    await rerender();
    expect(latest.patients.patients).toEqual([{ id: 'existing' }]);
    expect(mocks.from).toHaveBeenCalledTimes(reads);
  });

  it('does not restore old data after logout followed by login to the same clinic', async () => {
    mocks.auth = auth(); const pending = setupQueries('a'); await mount();
    mocks.auth = { session: null, profile: null, tenantAccessState: 'unauthenticated' }; await rerender();
    setupQueries(); mocks.auth = auth(); await rerender();
    await act(async () => { for (const result of pending) result.resolve({ data: [{ id: 'old', created_at: '2026-09-06', period: '2026-09' }], error: null }); });
    expectEmpty();
  });
});
