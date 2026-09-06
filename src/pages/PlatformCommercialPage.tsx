import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlatformAdminShell } from '../components/PlatformAdminShell';
import { isPlatformAdmin } from '../lib/platformAdmin';

export function PlatformCommercialPage() {
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
      title="Comercial"
      description="Visibilidade executiva da aquisição e conversão sem transformar o Platform Admin em um CRM completo."
    >
      <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="relative overflow-hidden rounded-[26px] border border-aqua/20 bg-gradient-to-br from-aqua/[0.09] via-panel to-panel p-6 md:p-7">
          <div className="pointer-events-none absolute -right-14 -top-16 h-56 w-56 rounded-full bg-aqua/[0.08] blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-aqua">Área preparada</p>
            <h2 className="mt-3 font-display text-[28px] font-bold leading-tight tracking-tight">Da captação ao onboarding, sem duplicar o CRM.</h2>
            <p className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-fog">O site e o n8n já formam a fundação de entrada comercial. Esta área receberá somente indicadores e estados factuais quando o bridge com o CRM estiver conectado.</p>
          </div>
        </div>

        <div className="rounded-[26px] border border-line bg-panel p-5.5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-fog">Status da integração</p>
          <p className="mt-2 font-display text-[24px] font-bold text-aqua">Preparada</p>
          <p className="mt-2 text-[11.5px] leading-relaxed text-fog">Sem métricas artificiais. Leads, qualificação, oportunidades e conversão aparecerão somente após a fonte comercial ser conectada ao Platform Admin.</p>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <PreparedCard title="Leads" sub="Novos contatos vindos do site e demais canais." />
        <PreparedCard title="Qualificação" sub="Score, SLA e estágio comercial normalizados pelo n8n/CRM." />
        <PreparedCard title="Oportunidades" sub="Negociações, demonstrações e negócios ganhos." />
        <PreparedCard title="Prontos para onboarding" sub="Venda aprovada com ação explícita para provisioning." />
      </section>

      <section className="rounded-[24px] border border-line bg-panel p-5 md:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mint">Próxima fronteira</p>
            <h3 className="mt-1 font-display text-[19px] font-bold">O lead não vira clínica automaticamente.</h3>
            <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-fog">A transição comercial termina em um estado equivalente a <code className="text-paper">ready_for_provisioning</code>. A criação de tenant e owner continua dentro do fluxo controlado de onboarding.</p>
          </div>
          <Link to="/platform/provisionar" className="rounded-xl border border-line bg-deep px-4 py-3 text-[11.5px] font-semibold text-paper">Abrir onboarding →</Link>
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
