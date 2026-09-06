import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlatformAdminShell } from '../components/PlatformAdminShell';
import { isPlatformAdmin } from '../lib/platformAdmin';

export function PlatformRevenuePage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void isPlatformAdmin()
      .then((allowed) => { if (active) setAuthorized(allowed); })
      .catch(() => { if (active) setAuthorized(false); });
    return () => { active = false; };
  }, []);

  if (authorized === null) return <div className="app-surface min-h-screen grid place-items-center text-fog">Validando privilégios da plataforma…</div>;
  if (!authorized) return <AccessDenied />;

  return (
    <PlatformAdminShell
      eyebrow="MedicsPro Platform Admin"
      title="Receita & Assinaturas"
      description="Backoffice financeiro do MedicsPro como SaaS, separado do financeiro interno das clínicas."
    >
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="relative overflow-hidden rounded-[26px] border border-mint/20 bg-gradient-to-br from-mint/[0.11] via-panel to-panel p-6 md:p-7">
          <div className="pointer-events-none absolute -right-14 -top-16 h-56 w-56 rounded-full bg-mint/[0.08] blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-mint">Billing da plataforma</p>
            <h2 className="mt-3 font-display text-[28px] font-bold leading-tight tracking-tight">Cobrar, receber e renovar com histórico auditável.</h2>
            <p className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-fog">A futura integração com Asaas alimentará esta área por API e webhooks. Até lá, nenhum MRR, receita ou inadimplência será inventado para preencher o dashboard.</p>
          </div>
        </div>

        <div className="rounded-[26px] border border-line bg-panel p-5.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-fog">Provedor inicial</p>
          <p className="mt-2 font-display text-[24px] font-bold text-mint">Asaas</p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-fog">Direção Brazil-first, mantendo um contrato interno neutro para permitir outro provider no futuro sem redesenhar o Platform Admin.</p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PreparedCard title="Assinaturas" sub="Plano, recorrência, status e próxima cobrança." />
        <PreparedCard title="Cobranças" sub="Faturas/charges preservadas por competência e vencimento." />
        <PreparedCard title="Pagamentos" sub="Recebidos, falhos, estornados e seus eventos externos." />
        <PreparedCard title="Receita SaaS" sub="MRR, recebido, a receber e inadimplência somente com fonte factual." />
      </section>

      <section className="rounded-[24px] border border-line bg-panel p-5 md:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-aqua">Boundary financeiro</p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="rounded-2xl border border-line bg-deep/55 p-4"><p className="font-display text-[14px] font-semibold">Financeiro da clínica</p><p className="mt-2 text-[11px] leading-relaxed text-fog">Pacientes → sessões/pacotes → recebimentos da própria clínica.</p></div>
          <div className="rounded-2xl border border-mint/20 bg-mint/[0.04] p-4"><p className="font-display text-[14px] font-semibold text-mint">Financeiro da plataforma</p><p className="mt-2 text-[11px] leading-relaxed text-fog">Cliente MedicsPro → assinatura → cobrança → pagamento → renovação.</p></div>
        </div>
      </section>
    </PlatformAdminShell>
  );
}

function PreparedCard({ title, sub }: { title: string; sub: string }) {
  return <article className="rounded-[20px] border border-line bg-panel p-4.5"><div className="flex items-start justify-between gap-3"><p className="font-display text-[15px] font-semibold">{title}</p><span className="rounded-full border border-line px-2 py-1 text-[9px] font-semibold text-fog">em preparação</span></div><p className="mt-2 text-[11px] leading-relaxed text-fog">{sub}</p></article>;
}

function AccessDenied() {
  return <div className="app-surface min-h-screen grid place-items-center p-5"><div className="w-full max-w-lg rounded-2xl border border-pulse/30 bg-panel p-7"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pulse">Acesso negado</p><h1 className="mt-2 font-display text-2xl font-bold">Platform Admin obrigatório</h1><Link to="/platform" className="mt-6 inline-flex rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-fog hover:text-paper">Voltar para a central</Link></div></div>;
}
