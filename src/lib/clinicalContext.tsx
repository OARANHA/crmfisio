import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './useAuth';
import { insertEvolution, updateConsent, updateSurvey } from './repository';
import type { Database } from './database.types';
import type { ConsentTerm, Evolution, NpsSurvey } from './types';

type EvolutionRow = Database['public']['Tables']['physiotherapy_evolutions']['Row'];
type ConsentRow = Database['public']['Tables']['consent_terms']['Row'];
type NpsRow = Database['public']['Tables']['nps_surveys']['Row'];
const mapEvolution = (row: EvolutionRow): Evolution => ({ id: row.id, pacienteId: row.patient_id, fisioId: row.professional_id, data: row.created_at.slice(0, 10), texto: row.texto, anexos: row.anexos ?? [] });
const mapConsent = (row: ConsentRow): ConsentTerm => ({ id: row.id, pacienteId: row.patient_id, nome: row.nome, versao: row.versao, assinado: row.assinado, dataAssinatura: row.data_assinatura, hash: row.hash, assinaturaUrl: row.assinatura_url, ip: row.ip });
const mapNps = (row: NpsRow): NpsSurvey => ({ id: row.id, pacienteId: row.patient_id, nota: row.nota, comentario: row.comentario ?? '', data: row.data });

interface ClinicalState {
  evolutions: Evolution[]; consents: ConsentTerm[]; surveys: NpsSurvey[]; loading: boolean; error: string | null;
  refreshClinical: () => Promise<void>;
  addEvolution: (evolution: Omit<Evolution, 'id'>) => Promise<Evolution>;
  signConsent: (id: string) => Promise<ConsentTerm>;
  answerNps: (id: string, nota: number) => Promise<void>;
}
const ClinicalContext = createContext<ClinicalState | null>(null);

export function ClinicalProvider({ children }: { children: ReactNode }) {
  const { profile, tenantAccessState } = useAuth();
  const clinicId = profile?.clinic_id ?? null;
  const [evolutions, setEvolutions] = useState<Evolution[]>([]);
  const [consents, setConsents] = useState<ConsentTerm[]>([]);
  const [surveys, setSurveys] = useState<NpsSurvey[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const refreshClinical = useCallback(async () => {
    const request = ++generation.current;
    if (!clinicId || tenantAccessState !== 'active') {
      setEvolutions([]); setConsents([]); setSurveys([]); setLoading(false); setError(null); return;
    }
    setLoading(true);
    try {
      const [evolutionsResult, consentsResult, surveysResult] = await Promise.all([
        supabase.from('physiotherapy_evolutions').select('*').eq('clinic_id', clinicId).is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('consent_terms').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
        supabase.from('nps_surveys').select('*').eq('clinic_id', clinicId).order('data', { ascending: false }),
      ]);
      if (request !== generation.current) return;
      if (evolutionsResult.error) throw evolutionsResult.error;
      if (consentsResult.error) throw consentsResult.error;
      if (surveysResult.error) throw surveysResult.error;
      setEvolutions((evolutionsResult.data ?? []).map(mapEvolution));
      setConsents((consentsResult.data ?? []).map(mapConsent));
      setSurveys((surveysResult.data ?? []).map(mapNps));
      setError(null);
    } catch (cause) {
      if (request !== generation.current) return;
      console.error('[MedicsPro] domínio clínico:', cause); setError('Não foi possível carregar os dados clínicos.'); throw cause;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [clinicId, tenantAccessState]);

  useEffect(() => { void refreshClinical().catch(() => undefined); }, [refreshClinical]);
  const addEvolution = useCallback(async (evolution: Omit<Evolution, 'id'>) => { if (!clinicId) throw new Error('Clínica não identificada'); const created = await insertEvolution(clinicId, evolution); setEvolutions((current) => [created, ...current]); return created; }, [clinicId]);
  const signConsent = useCallback(async (id: string) => { const persisted = await updateConsent(id); setConsents((current) => current.map((consent) => consent.id === id ? persisted : consent)); return persisted; }, []);
  const answerNps = useCallback(async (id: string, nota: number) => {
    let previous: NpsSurvey | undefined;
    setSurveys((current) => current.map((survey) => { if (survey.id !== id) return survey; previous = survey; return { ...survey, nota }; }));
    try { await updateSurvey(id, nota); }
    catch (cause) { if (previous) { const rollback = previous; setSurveys((current) => current.map((survey) => survey.id === id ? rollback : survey)); } throw cause; }
  }, []);
  const value = useMemo<ClinicalState>(() => ({ evolutions, consents, surveys, loading, error, refreshClinical, addEvolution, signConsent, answerNps }), [evolutions, consents, surveys, loading, error, refreshClinical, addEvolution, signConsent, answerNps]);
  return <ClinicalContext.Provider value={value}>{children}</ClinicalContext.Provider>;
}
export function useClinical(): ClinicalState { const context = useContext(ClinicalContext); if (!context) throw new Error('useClinical deve ser usado dentro de ClinicalProvider'); return context; }
