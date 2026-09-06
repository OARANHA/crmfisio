import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';

const mocks = vi.hoisted(() => ({ auth: {} as any, from: vi.fn() }));
vi.mock('./useAuth', () => ({ useAuth: () => mocks.auth }));
vi.mock('./supabaseClient', () => ({ supabase: { from: mocks.from } }));

import { ClinicDirectoryProvider, useClinicDirectory } from './clinicDirectoryContext';
import { PackageProvider, usePackages } from './packageContext';
import { CommunicationProvider, useCommunication } from './communicationContext';
import { AuditProvider, useAudit } from './auditContext';

function auth() {
  return { profile: { id: 'user', clinic_id: 'clinic', role: 'owner', ativo: true }, tenantAccessState: 'active' };
}

function queryFor(table: string) {
  const rows: Record<string, any[]> = {
    profiles: [{ id: 'u1', nome: 'Ana', email: 'ana@example.com', role: 'fisio', registro: null, cor: null, ativo: true }],
    session_packages: [{ id: 'sp1', nome: '10 sessões', sessoes: 10, preco: 1000, validade_dias: 90 }],
    patient_packages: [{ id: 'pp1', patient_id: 'p1', package_id: 'sp1', sessoes_totais: 10, sessoes_usadas: 2, compra_data: '2026-09-01', valor_pago: 1000, status: 'ativo' }],
    wa_logs: [{ id: 'w1', patient_id: 'p1', template: 'confirmacao', mensagem: 'ok', enviado_em: '2026-09-06', status: 'enviado' }],
    audit_log: [{ id: 'a1', ts: '2026-09-06', usuario_id: 'u1', acao: 'TESTE', detalhe: 'ok' }],
  };
  const query: any = {
    select: () => query,
    eq: () => query,
    order: () => table === 'audit_log' ? query : Promise.resolve({ data: rows[table] ?? [], error: null }),
    limit: () => Promise.resolve({ data: rows[table] ?? [], error: null }),
  };
  return query;
}

let renderer: ReactTestRenderer | undefined;
afterEach(() => {
  if (renderer) act(() => renderer?.unmount());
  renderer = undefined;
  vi.clearAllMocks();
});

it('loads each residual domain independently', async () => {
  mocks.auth = auth();
  mocks.from.mockImplementation((table: string) => queryFor(table));
  let state!: {
    directory: ReturnType<typeof useClinicDirectory>;
    packages: ReturnType<typeof usePackages>;
    communication: ReturnType<typeof useCommunication>;
    audit: ReturnType<typeof useAudit>;
  };

  function Probe() {
    state = {
      directory: useClinicDirectory(),
      packages: usePackages(),
      communication: useCommunication(),
      audit: useAudit(),
    };
    return null;
  }

  await act(async () => {
    renderer = create(
      <ClinicDirectoryProvider>
        <PackageProvider>
          <CommunicationProvider>
            <AuditProvider><Probe /></AuditProvider>
          </CommunicationProvider>
        </PackageProvider>
      </ClinicDirectoryProvider>,
    );
  });

  expect(state.directory.users).toHaveLength(1);
  expect(state.packages.packages).toHaveLength(1);
  expect(state.packages.patientPackages).toHaveLength(1);
  expect(state.communication.waLogs).toHaveLength(1);
  expect(state.audit.audit).toHaveLength(1);
});

describe('inactive access', () => {
  it('does not query tenant data', async () => {
    mocks.auth = { ...auth(), tenantAccessState: 'suspended' };
    mocks.from.mockImplementation(() => { throw new Error('should not query'); });
    function Probe() {
      useClinicDirectory();
      usePackages();
      useCommunication();
      useAudit();
      return null;
    }
    await act(async () => {
      renderer = create(
        <ClinicDirectoryProvider>
          <PackageProvider>
            <CommunicationProvider>
              <AuditProvider><Probe /></AuditProvider>
            </CommunicationProvider>
          </PackageProvider>
        </ClinicDirectoryProvider>,
      );
    });
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
