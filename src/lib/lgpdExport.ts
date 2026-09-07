import { supabase } from './supabaseClient';
import type { Json } from './database.types';

export type LgpdSubjectExport = Record<string, unknown> & {
  formato: 'LGPD-portabilidade-v2';
  serverAuthoritative: true;
};

type LgpdRpcClient = {
  rpc: (
    name: 'export_patient_data_lgpd',
    args: { p_patient_id: string },
  ) => Promise<{ data: Json | null; error: unknown }>;
};

function isServerAuthoritativeExport(value: Json | null): value is Json & LgpdSubjectExport {
  return Boolean(
    value
    && typeof value === 'object'
    && !Array.isArray(value)
    && value.formato === 'LGPD-portabilidade-v2'
    && value.serverAuthoritative === true,
  );
}

/**
 * Fetches the canonical LGPD portability bundle from PostgreSQL.
 * The browser never composes subject data from provider state: the server RPC
 * owns tenant scoping, completeness, secret exclusion and audit insertion.
 */
export async function exportPatientDataLgpd(patientId: string): Promise<LgpdSubjectExport> {
  if (!patientId) throw new Error('Paciente obrigatório para exportação LGPD');

  const { data, error } = await (supabase as unknown as LgpdRpcClient).rpc(
    'export_patient_data_lgpd',
    { p_patient_id: patientId },
  );

  if (error) throw error;
  if (!isServerAuthoritativeExport(data)) {
    throw new Error('Exportação LGPD retornou contrato inválido');
  }

  return data as unknown as LgpdSubjectExport;
}
