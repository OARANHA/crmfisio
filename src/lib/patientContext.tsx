import { createContext, useCallback, useContext, useMemo, type ReactNode } from 'react';
import { isCancelledError, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabaseClient';
import { useAuth } from './useAuth';
import { anonymizePatient as persistAnonymizePatient, insertPatient, mapPatient, updatePatientStage } from './repository';
import { canManagePatientFunnel } from './permissions';
import { patientQueryKey } from './clinicQuery';
import type { Database, Json } from './database.types';
import type { FunilStage, Patient, Role } from './types';

type PatientRow = Database['public']['Tables']['patients']['Row'];
type PatientClinicalSnapshot = { patient_id: string; queixa_principal: string | null; cid10: string[] | null; anamnese: Json | null };
const PATIENT_OPERATIONAL_SELECT = 'id,clinic_id,nome,nascimento,telefone,email,cpf,convenio,funil_stage,status,ultima_visita,opt_in_whats,anonimizado,created_at,updated_at,deleted_at' as const;
const CLINICAL_ROLES: Role[] = ['owner', 'admin', 'professional'];

interface PatientState {
  patients: Patient[]; loading: boolean; error: string | null;
  refreshPatients: () => Promise<void>;
  addPatient: (patient: Omit<Patient, 'id' | 'createdAt' | 'anamnese'> & { anamnese?: Patient['anamnese'] }) => Promise<Patient>;
  setFunilStage: (id: string, stage: FunilStage) => Promise<void>;
  anonymizePatient: (id: string) => Promise<void>;
}
const PatientContext = createContext<PatientState | null>(null);

async function awaitAbortable<T>(request: PromiseLike<T> & { abortSignal?: (signal: AbortSignal) => PromiseLike<T> }, signal: AbortSignal): Promise<T> {
  return typeof request.abortSignal === 'function' ? await request.abortSignal(signal) : await request;
}

async function loadClinicalSnapshot(role: Role, signal: AbortSignal): Promise<PatientClinicalSnapshot[]> {
  if (!CLINICAL_ROLES.includes(role)) return [];
  const request = (supabase as any).rpc('list_patient_clinical_snapshot') as PromiseLike<{ data: PatientClinicalSnapshot[] | null; error: unknown }> & { abortSignal?: (signal: AbortSignal) => PromiseLike<{ data: PatientClinicalSnapshot[] | null; error: unknown }> };
  const { data, error } = await awaitAbortable(request, signal);
  if (error) throw error;
  return data ?? [];
}

async function loadPatients(clinicId: string, role: Role, signal: AbortSignal): Promise<Patient[]> {
  const operationalRequest = supabase.from('patients')
    .select(PATIENT_OPERATIONAL_SELECT)
    .eq('clinic_id', clinicId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  const [patientsResult, clinicalSnapshot] = await Promise.all([
    awaitAbortable(operationalRequest as any, signal),
    loadClinicalSnapshot(role, signal),
  ]);
  if ((patientsResult as any).error) throw (patientsResult as any).error;
  const clinicalByPatient = new Map(clinicalSnapshot.map((row) => [row.patient_id, row]));
  return ((patientsResult as any).data ?? []).map((row: PatientRow) => {
    const clinical = clinicalByPatient.get(row.id);
    return mapPatient({ ...row, queixa_principal: clinical?.queixa_principal ?? null, cid10: clinical?.cid10 ?? [], anamnese: clinical?.anamnese ?? null } as PatientRow);
  });
}

export function PatientProvider({ children }: { children: ReactNode }) {
  const { session, profile, tenantAccessState } = useAuth();
  const clinicId = profile?.clinic_id ?? null;
  const userId = session?.user.id ?? null;
  const role = (profile?.role ?? null) as Role | null;
  const enabled = Boolean(clinicId && userId && role && tenantAccessState === 'active');
  const queryClient = useQueryClient();
  const queryKey = useMemo(() => patientQueryKey({ clinicId, userId, role }), [clinicId, userId, role]);
  const queryFn = useCallback(({ signal }: { signal: AbortSignal }) => loadPatients(clinicId!, role!, signal), [clinicId, role]);
  const { data: patientData, error: queryError, isFetching, refetch } = useQuery({ queryKey, queryFn, enabled });

  const refreshPatients = useCallback(async () => {
    if (!enabled) return;
    try {
      await refetch({ cancelRefetch: true, throwOnError: true });
    } catch (cause) {
      if (isCancelledError(cause)) return;
      console.error('[MedicsPro] pacientes:', cause);
      throw cause;
    }
  }, [enabled, refetch]);

  const { mutateAsync: addPatientMutation } = useMutation({
    mutationFn: async (patient: Omit<Patient, 'id' | 'createdAt' | 'anamnese'> & { anamnese?: Patient['anamnese'] }) => {
      if (!clinicId) throw new Error('Clínica não identificada');
      const payload: Omit<Patient, 'id' | 'createdAt'> = { ...patient, anamnese: patient.anamnese ?? { historia: '', cirurgias: '', medicamentos: '', alergias: '', objetivo: '' } };
      return insertPatient(clinicId, payload);
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey, exact: true });
    },
    onSuccess: (created) => queryClient.setQueryData<Patient[]>(queryKey, (current = []) => [created, ...current]),
  });

  const { mutateAsync: setFunilStageMutation } = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: FunilStage }) => updatePatientStage(id, stage),
    onMutate: async ({ id, stage }) => {
      if (!canManagePatientFunnel(role)) throw new Error('Sem permissão para alterar o funil do CRM');
      await queryClient.cancelQueries({ queryKey, exact: true });
      const previous = queryClient.getQueryData<Patient[]>(queryKey) ?? [];
      queryClient.setQueryData<Patient[]>(queryKey, previous.map((patient) => patient.id === id ? { ...patient, funilStage: stage } : patient));
      return { previous };
    },
    onError: (_cause, _variables, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous);
    },
  });

  const { mutateAsync: anonymizePatientMutation } = useMutation({
    mutationFn: persistAnonymizePatient,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey, exact: true });
    },
    onSuccess: (_result, id) => queryClient.setQueryData<Patient[]>(queryKey, (current = []) => current.map((item) => item.id === id ? {
      ...item,
      nome: 'Paciente Anonizado', cpf: '', telefone: '', email: '', queixaPrincipal: '', convenio: null, cid10: [], ultimaVisita: null,
      optInWhats: false, status: 'inativo', anonimizado: true,
      anamnese: { historia: '', cirurgias: '', medicamentos: '', alergias: '', objetivo: '' },
    } : item)),
  });

  const addPatient = useCallback((patient: Parameters<typeof addPatientMutation>[0]) => addPatientMutation(patient), [addPatientMutation]);
  const setFunilStage = useCallback(async (id: string, stage: FunilStage) => { await setFunilStageMutation({ id, stage }); }, [setFunilStageMutation]);
  const anonymizePatient = useCallback(async (id: string) => { await anonymizePatientMutation(id); }, [anonymizePatientMutation]);
  const error = queryError ? 'Não foi possível carregar os pacientes.' : null;
  const value = useMemo<PatientState>(() => ({
    patients: enabled ? (patientData ?? []) : [],
    loading: enabled ? isFetching : false,
    error,
    refreshPatients,
    addPatient,
    setFunilStage,
    anonymizePatient,
  }), [enabled, patientData, isFetching, error, refreshPatients, addPatient, setFunilStage, anonymizePatient]);
  return <PatientContext.Provider value={value}>{children}</PatientContext.Provider>;
}

export function usePatients(): PatientState {
  const context = useContext(PatientContext);
  if (!context) throw new Error('usePatients deve ser usado dentro de PatientProvider');
  return context;
}
