import { useCallback } from 'react';
import { logPatientDataExport } from './repository';
import { useAuth } from './useAuth';
import { useAgenda } from './agendaContext';
import { useAudit } from './auditContext';
import { useClinical } from './clinicalContext';
import { useFinance } from './financeContext';
import { usePackages } from './packageContext';
import { usePatients } from './patientContext';

/**
 * Canonical composition point for LGPD subject-access and anonymization flows.
 * Domain providers keep owning their data; this hook only coordinates the
 * cross-domain operation and audit refresh required by LGPD actions.
 */
export function useLgpdActions() {
  const { user, profile } = useAuth();
  const agenda = useAgenda();
  const audit = useAudit();
  const clinical = useClinical();
  const finance = useFinance();
  const packages = usePackages();
  const patients = usePatients();

  const exportSubjectData = useCallback(async (patientId: string): Promise<Record<string, unknown>> => {
    await logPatientDataExport(patientId);
    await audit.refreshAudit().catch(() => undefined);

    const patient = patients.patients.find((item) => item.id === patientId);
    return {
      formato: 'LGPD-portabilidade-v1',
      exportadoEm: new Date().toISOString(),
      exportadoPor: profile?.nome || user?.email?.split('@')[0] || 'sistema',
      titular: patient,
      sessoes: agenda.appointments.filter((appointment) => appointment.pacienteId === patientId),
      evolucoes: clinical.evolutions.filter((evolution) => evolution.pacienteId === patientId),
      consentimentos: clinical.consents
        .filter((consent) => consent.pacienteId === patientId)
        .map(({ assinaturaUrl: _image, ...rest }) => rest),
      pesquisas: clinical.surveys.filter((survey) => survey.pacienteId === patientId),
      pacotes: packages.patientPackages.filter((item) => item.pacienteId === patientId),
      financeiro: finance.transactions.filter((transaction) => transaction.pacienteId === patientId),
    };
  }, [
    user?.email,
    profile?.nome,
    audit.refreshAudit,
    patients.patients,
    agenda.appointments,
    clinical.evolutions,
    clinical.consents,
    clinical.surveys,
    packages.patientPackages,
    finance.transactions,
  ]);

  const anonymizePatient = useCallback(async (patientId: string) => {
    await patients.anonymizePatient(patientId);
    await audit.refreshAudit().catch(() => undefined);
  }, [patients.anonymizePatient, audit.refreshAudit]);

  return { exportSubjectData, anonymizePatient };
}
