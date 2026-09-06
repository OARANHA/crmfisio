import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './useAuth';
import { anonymizePatient as persistAnonymizePatient, insertPatient, mapPatient, updatePatientStage } from './repository';
import type { Database, Json } from './database.types';
import type { FunilStage, Patient } from './types';

type PatientRow = Database['public']['Tables']['patients']['Row'];
type AppRole = Database['public']['Tables']['profiles']['Row']['role'];

type PatientClinicalSnapshot = {
  patient_id: string;
  queixa_principal: string | null;
  cid10: string[] | null;
  anamnese: Json | null;
};

const PATIENT_OPERATIONAL_SELECT = 'id,clinic_id,nome,nascimento,telefone,email,cpf,convenio,funil_stage,status,ultima_visita,opt_in_whats,anonimizado,created_at,updated_at,deleted_at' as const;
const CLINICAL_ROLES: AppRole[] = ['owner', 'admin', 'fisio'];

interface PatientState {
  patients: Patient[];
  loading: boolean;
  error: string | null;
  refreshPatients: () => Promise<void>;
  addPatient: (patient: Omit<Patient, 'id' | 'createdAt' | 'anamnese'> & { anamnese?: Patient['anamnese'] }) => Promise<Patient>;
  setFunilStage: (id: string, stage: FunilStage) => Promise<void>;
  anonymizePatient: (id: string) => Promise<void>;
}

const PatientContext = createContext<PatientState | null>(null);

async function loadClinicalSnapshot(role: AppRole): Promise<PatientClinicalSnapshot[]> {
  if (!CLINICAL_ROLES.includes(role)) return [];

  const { data, error } = await (supabase as unknown as {
    rpc: (
      name: 'list_patient_clinical_snapshot',
      args?: Record<string, never>,
    ) => Promise<{ data: PatientClinicalSnapshot[] | null; error: unknown }>;
  }).rpc('list_patient_clinical_snapshot');

  if (error) throw error;
  return data ?? [];
}

/**
 * Estado canônico do cadastro de pacientes.
 *
 * O domínio concentra carga operacional, enriquecimento clínico autorizado e
 * mutações de cadastro/funil/LGPD. O store legado apenas expõe uma fachada de
 * compatibilidade enquanto as telas migram gradualmente para este contexto.
 */
export function PatientProvider({ children }: { children: ReactNode }) {
  const { profile, tenantAccessState } = useAuth();
  const clinicId = profile?.clinic_id ?? null;
  const role = profile?.role ?? null;
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshPatients = useCallback(async () => {
    if (!clinicId || !role || tenantAccessState !== 'active') {
      setPatients([]);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const [patientsResult, clinicalSnapshot] = await Promise.all([
        supabase
          .from('patients')
          .select(PATIENT_OPERATIONAL_SELECT)
          .eq('clinic_id', clinicId)
          .is('deleted_at', null)
          .order('created_at', { ascending: false }),
        loadClinicalSnapshot(role),
      ]);

      if (patientsResult.error) throw patientsResult.error;

      const clinicalByPatient = new Map(clinicalSnapshot.map((row) => [row.patient_id, row]));
      const mapped = (patientsResult.data ?? []).map((row) => {
        const clinical = clinicalByPatient.get(row.id);
        return mapPatient({
          ...row,
          queixa_principal: clinical?.queixa_principal ?? null,
          cid10: clinical?.cid10 ?? [],
          anamnese: clinical?.anamnese ?? null,
        } as PatientRow);
      });

      setPatients(mapped);
      setError(null);
    } catch (cause) {
      console.error('[MedicsPro] pacientes:', cause);
      setError('Não foi possível carregar os pacientes.');
      throw cause;
    } finally {
      setLoading(false);
    }
  }, [clinicId, role, tenantAccessState]);

  useEffect(() => {
    void refreshPatients().catch(() => undefined);
  }, [refreshPatients]);

  const addPatient = useCallback(async (
    patient: Omit<Patient, 'id' | 'createdAt' | 'anamnese'> & { anamnese?: Patient['anamnese'] },
  ) => {
    if (!clinicId) throw new Error('Clínica não identificada');
    const payload: Omit<Patient, 'id' | 'createdAt'> = {
      ...patient,
      anamnese: patient.anamnese ?? { historia: '', cirurgias: '', medicamentos: '', alergias: '', objetivo: '' },
    };
    const created = await insertPatient(clinicId, payload);
    setPatients((current) => [created, ...current]);
    return created;
  }, [clinicId]);

  const setFunilStage = useCallback(async (id: string, stage: FunilStage) => {
    let previous: Patient | undefined;
    setPatients((current) => current.map((patient) => {
      if (patient.id !== id) return patient;
      previous = patient;
      return { ...patient, funilStage: stage };
    }));

    try {
      await updatePatientStage(id, stage);
    } catch (cause) {
      if (previous) {
        const rollback = previous;
        setPatients((current) => current.map((patient) => patient.id === id ? rollback : patient));
      }
      throw cause;
    }
  }, []);

  const anonymizePatient = useCallback(async (id: string) => {
    await persistAnonymizePatient(id);
    setPatients((current) => current.map((item) => item.id === id ? {
      ...item,
      nome: 'Paciente Anonizado', cpf: '', telefone: '', email: '', queixaPrincipal: '', convenio: null,
      cid10: [], ultimaVisita: null, optInWhats: false, status: 'inativo', anonimizado: true,
      anamnese: { historia: '', cirurgias: '', medicamentos: '', alergias: '', objetivo: '' },
    } : item));
  }, []);

  const value = useMemo<PatientState>(() => ({
    patients,
    loading,
    error,
    refreshPatients,
    addPatient,
    setFunilStage,
    anonymizePatient,
  }), [patients, loading, error, refreshPatients, addPatient, setFunilStage, anonymizePatient]);

  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>;
}

export function usePatients(): PatientState {
  const context = useContext(PatientContext);
  if (!context) throw new Error('usePatients deve ser usado dentro de PatientProvider');
  return context;
}
