import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { supabase } from './supabaseClient';
import { useAuth } from './useAuth';
import type { Database } from './database.types';
import type { PatientPackage, SessionPackage } from './types';

type PatientPackageRow = Database['public']['Tables']['patient_packages']['Row'];
type SessionPackageRow = Database['public']['Tables']['session_packages']['Row'];

const mapPatientPackage = (row: PatientPackageRow): PatientPackage => ({
  id: row.id,
  pacienteId: row.patient_id,
  pacoteId: row.package_id,
  sessoesTotais: row.sessoes_totais,
  sessoesUsadas: row.sessoes_usadas,
  compraData: row.compra_data,
  valorPago: row.valor_pago,
  status: row.status,
});

const mapSessionPackage = (row: SessionPackageRow): SessionPackage => ({
  id: row.id,
  nome: row.nome,
  sessoes: row.sessoes,
  preco: row.preco,
  validadeDias: row.validade_dias,
});

interface PackageState {
  packages: SessionPackage[];
  patientPackages: PatientPackage[];
  loading: boolean;
  error: string | null;
  refreshPackages: () => Promise<void>;
}

const PackageContext = createContext<PackageState | null>(null);

export function PackageProvider({ children }: { children: ReactNode }) {
  const { profile, tenantAccessState } = useAuth();
  const clinicId = profile?.clinic_id ?? null;
  const [packages, setPackages] = useState<SessionPackage[]>([]);
  const [patientPackages, setPatientPackages] = useState<PatientPackage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  const refreshPackages = useCallback(async () => {
    const request = ++generation.current;
    if (!clinicId || tenantAccessState !== 'active') {
      setPackages([]);
      setPatientPackages([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    try {
      const [catalogResult, patientResult] = await Promise.all([
        supabase.from('session_packages').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
        supabase.from('patient_packages').select('*').eq('clinic_id', clinicId).order('created_at', { ascending: false }),
      ]);
      if (request !== generation.current) return;
      if (catalogResult.error) throw catalogResult.error;
      if (patientResult.error) throw patientResult.error;
      setPackages((catalogResult.data ?? []).map(mapSessionPackage));
      setPatientPackages((patientResult.data ?? []).map(mapPatientPackage));
      setError(null);
    } catch (cause) {
      if (request !== generation.current) return;
      console.error('[MedicsPro] pacotes:', cause);
      setError('Não foi possível carregar os pacotes da clínica.');
      throw cause;
    } finally {
      if (request === generation.current) setLoading(false);
    }
  }, [clinicId, tenantAccessState]);

  useEffect(() => { void refreshPackages().catch(() => undefined); }, [refreshPackages]);

  const value = useMemo<PackageState>(() => ({ packages, patientPackages, loading, error, refreshPackages }), [packages, patientPackages, loading, error, refreshPackages]);
  return <PackageContext.Provider value={value}>{children}</PackageContext.Provider>;
}

export function usePackages(): PackageState {
  const context = useContext(PackageContext);
  if (!context) throw new Error('usePackages deve ser usado dentro de PackageProvider');
  return context;
}
