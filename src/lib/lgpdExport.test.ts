import { beforeEach, describe, expect, it, vi } from 'vitest';

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('./supabaseClient', () => ({ supabase: { rpc } }));
import { exportPatientDataLgpd } from './lgpdExport';

beforeEach(() => vi.clearAllMocks());

describe('exportPatientDataLgpd', () => {
  it('uses only the canonical server RPC and returns its v2 bundle unchanged', async () => {
    const payload = {
      formato: 'LGPD-portabilidade-v2',
      serverAuthoritative: true,
      titular: { id: 'patient-1' },
      sessoes: [{ id: 'appointment-1' }],
      nexusResultados: [{ id: 'result-1' }],
    };
    rpc.mockResolvedValue({ data: payload, error: null });

    await expect(exportPatientDataLgpd('patient-1')).resolves.toBe(payload);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith('export_patient_data_lgpd', { p_patient_id: 'patient-1' });
  });

  it('fails closed when PostgreSQL rejects the export', async () => {
    const error = new Error('permission denied');
    rpc.mockResolvedValue({ data: null, error });
    await expect(exportPatientDataLgpd('patient-1')).rejects.toBe(error);
  });

  it.each([
    null,
    {},
    { formato: 'LGPD-portabilidade-v1', serverAuthoritative: true },
    { formato: 'LGPD-portabilidade-v2', serverAuthoritative: false },
    [],
  ])('rejects a non-authoritative or incompatible export contract', async (data) => {
    rpc.mockResolvedValue({ data, error: null });
    await expect(exportPatientDataLgpd('patient-1')).rejects.toThrow('contrato inválido');
  });

  it('rejects an empty patient id before calling the server', async () => {
    await expect(exportPatientDataLgpd('')).rejects.toThrow('Paciente obrigatório');
    expect(rpc).not.toHaveBeenCalled();
  });
});
