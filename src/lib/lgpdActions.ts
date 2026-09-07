import { useCallback } from 'react';
import { exportPatientDataLgpd } from './lgpdExport';
import { useAudit } from './auditContext';
import { usePatients } from './patientContext';

/**
 * Canonical composition point for LGPD subject-access and anonymization flows.
 * Subject export is server-authoritative; the browser never rebuilds the
 * portability bundle from provider state.
 */
export function useLgpdActions() {
  const { refreshAudit } = useAudit();
  const { anonymizePatient: anonymizePatientRecord } = usePatients();

  const exportSubjectData = useCallback(async (patientId: string): Promise<Record<string, unknown>> => {
    const payload = await exportPatientDataLgpd(patientId);
    await refreshAudit().catch(() => undefined);
    return payload;
  }, [refreshAudit]);

  const anonymizePatient = useCallback(async (patientId: string) => {
    await anonymizePatientRecord(patientId);
    await refreshAudit().catch(() => undefined);
  }, [anonymizePatientRecord, refreshAudit]);

  return { exportSubjectData, anonymizePatient };
}
