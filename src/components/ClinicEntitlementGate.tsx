import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  isCurrentClinicEntitlementAllowed,
  loadCurrentClinicEntitlementState,
  type CurrentClinicEntitlementState,
} from '../lib/clinicEntitlement';
import type { PlatformClinicEntitlementKey } from '../lib/platformAdmin';

const LABELS: Record<PlatformClinicEntitlementKey, string> = {
  'nexus.access': 'Nexus',
  'finance.access': 'Financeiro',
  'crm.access': 'CRM',
  'reports.access': 'Relatórios',
  'assessments.custom': 'Avaliações customizadas',
  'whatsapp.access': 'Mensagens / WhatsApp',
};

export function ClinicEntitlementGate({
  entitlement,
  children,
}: {
  entitlement: PlatformClinicEntitlementKey;
  children: ReactNode;
}) {
  const [state, setState] = useState<CurrentClinicEntitlementState | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    setState(null);
    setError(false);

    void loadCurrentClinicEntitlementState(entitlement)
      .then((next) => {
        if (active) setState(next);
      })
      .catch((cause) => {
        console.error('[Entitlement] route gate:', entitlement, cause);
        if (active) setError(true);
      });

    return () => { active = false; };
  }, [entitlement]);

  if (!state && !error) {
    return <div className="app-surface min-h-[50vh] grid place-items-center text-fog">Validando módulo da clínica…</div>;
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-5 md:p-8">
        <div className="rounded-2xl border border-amber/35 bg-panel p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-amber">Validação indisponível</p>
          <h1 className="mt-2 font-display text-xl font-bold">Não foi possível validar este módulo</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-fog">Por segurança, o acesso ficou suspenso até o estado contratual da clínica poder ser confirmado.</p>
          <Link to="/dashboard" className="mt-5 inline-flex rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-fog hover:text-paper">Voltar ao Dashboard</Link>
        </div>
      </div>
    );
  }

  if (state && !isCurrentClinicEntitlementAllowed(state)) {
    return (
      <div className="mx-auto max-w-2xl p-5 md:p-8">
        <div className="rounded-2xl border border-line bg-panel p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-aqua">Módulo não liberado</p>
          <h1 className="mt-2 font-display text-xl font-bold">{LABELS[entitlement]} não está disponível para esta clínica</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-fog">A disponibilidade é controlada pelo MedicsPro Platform Admin. Nenhum dado foi removido; o módulo apenas está fora do entitlement efetivo da clínica.</p>
          <Link to="/dashboard" className="mt-5 inline-flex rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-fog hover:text-paper">Voltar ao Dashboard</Link>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
