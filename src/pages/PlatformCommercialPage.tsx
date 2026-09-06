import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlatformAdminShell } from '../components/PlatformAdminShell';
import { getCachedPlatformAdminAccess, validatePlatformAdminAccess } from '../lib/platformAdminAccess';

export function PlatformCommercialPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(() => getCachedPlatformAdminAccess());

  useEffect(() => {
    let active = true;
    void validatePlatformAdminAccess()
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
      <section className="grid gap-4 2xl:grid-cols-[1.55fr_0.7fr]">
        <div className="relative overflow-hidden rounded-[28px] border border-aqua/20 bg-gradient-to-br from-aqua/[0.11] via-panel to-panel p-6 md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-aqua/[0.09] blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-24 h-32 w-32 rounded-full bg-mint/[0.07] blur-2xl" />
          <div className="relative max-w-4xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-aqua">Aquisição & conversão</p>
            <h2 className="mt-3 font-display text-[30px] font-bold leading-tight tracking-tight md:text-[38px]">Da captação à decisão comercial, sem transformar o Platform Admin em CRM.</h2>
            <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-fog">O site e o n8n já formam a fundação de entrada comercial. Esta área será a leitura executiva da aquisição, qualificação e conversão quando o bridge factual com o CRM estiver conectado.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <StatusPill tone="mint" label="Entrada" value="Site ativo" />
              <StatusPill tone="aqua" label="Orquestração" value="n8n" />
              <StatusPill tone="amber" label="CRM bridge" value="Pendente" />
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-line bg-panel p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-fog">Status comercial</p><p className="mt-2 font-display text-[27px] font-bold text-aqua">Preparado</p></div>
            <span className="grid h-11 w-11 place-items-center rounded-full border border-aqua/25 bg-aqua/[0.08] text-aqua">↗</span>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-fog">A estrutura visual está pronta. Os números entram somente quando o Platform Admin puder consumir uma fonte comercial canônica e auditável.</p>
          <div className="mt-5 space-y-2.5 border-t border-line/60 pt-4">
            <IntegrationRow label="Site" value="ativo" tone="mint" />
            <IntegrationRow label="n8n" value="fundação ativa" tone="aqua" />
            <IntegrationRow label="CRM / read model" value="não conectado" tone="amber" />
            <IntegrationRow label="Métricas factuais" value="aguardando fonte" tone="fog" />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PreparedCard step="01" tone="mint" title="Leads" sub="Novos contatos vindos do site e demais canais." />
        <PreparedCard step="02" tone="aqua" title="Qualificação" sub="Score, SLA e estágio comercial normalizados pelo n8n/CRM." />
        <PreparedCard step="03" tone="amber" title="Oportunidades" sub="Demonstrações, negociações e negócios ganhos." />
        <PreparedCard step="04" tone="pulse" title="Prontos para onboarding" sub="Venda aprovada com ação explícita para provisioning." />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[26px] border border-line bg-panel p-5 md:p-6">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-mint/20 bg-mint/[0.07] text-mint">✓</span>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mint">Boundary comercial</p>
              <h3 className="mt-1 font-display text-[20px] font-bold">O lead não vira clínica automaticamente.</h3>
              <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-fog">O pipeline termina em um estado equivalente a <code className="text-paper">ready_for_provisioning</code>. Tenant, primeiro owner e lifecycle continuam dentro do onboarding controlado da plataforma.</p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <BoundaryTag text="CRM = pipeline operacional" />
            <BoundaryTag text="Platform Admin = cockpit executivo" />
            <BoundaryTag text="Onboarding = criação do tenant" />
          </div>
        </div>

        <div className="rounded-[26px] border border-aqua/20 bg-aqua/[0.04] p-5 md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-aqua">Quando a fonte entrar</p>
          <h3 className="mt-1 font-display text-[18px] font-bold">KPIs que passam a fazer sentido</h3>
          <div className="mt-4 grid grid-cols-2 gap-2 text-[10.5px]">
            <FutureMetric label="Leads" />
            <FutureMetric label="Qualificados" />
            <FutureMetric label="Conversão" />
            <FutureMetric label="Tempo até venda" />
          </div>
          <Link to="/platform/provisionar" className="mt-5 inline-flex rounded-xl border border-aqua/25 bg-panel px-4 py-3 text-[11.5px] font-semibold text-aqua">Abrir onboarding →</Link>
        </div>
      </section>
    </PlatformAdminShell>
  );
}

function toneText(tone: string) {
  if (tone === 'aqua') return 'text-aqua';
  if (tone === 'amber') return 'text-amber';
  if (tone === 'pulse') return 'text-pulse';
  return 'text-mint';
}

function StatusPill({ tone, label, value }: { tone: string; label: string; value: string }) {
  return <span className="rounded-full border border-line bg-panel/80 px-3 py-2 text-[10px] font-semibold text-fog"><span className={toneText(tone)}>{label}</span> · {value}</span>;
}

function IntegrationRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="flex items-center justify-between gap-3 text-[10.5px]"><span className="text-fog">{label}</span><span className={`font-semibold ${toneText(tone)}`}>{value}</span></div>;
}

function PreparedCard({ step, tone, title, sub }: { step: string; tone: string; title: string; sub: string }) {
  return <article className="rounded-[22px] border border-line bg-panel p-4.5"><div className="flex items-start justify-between gap-3"><span className={`grid h-8 w-8 place-items-center rounded-xl bg-deep text-[10px] font-bold ${toneText(tone)}`}>{step}</span><span className="rounded-full border border-line px-2 py-1 text-[9px] font-semibold text-fog">em preparação</span></div><p className="mt-4 font-display text-[15px] font-semibold">{title}</p><p className="mt-2 text-[11px] leading-relaxed text-fog">{sub}</p></article>;
}

function BoundaryTag({ text }: { text: string }) {
  return <span className="rounded-full border border-line bg-deep/55 px-3 py-2 text-[10px] font-semibold text-fog">{text}</span>;
}

function FutureMetric({ label }: { label: string }) {
  return <div className="rounded-xl border border-line bg-panel px-3 py-3"><p className="text-fog">{label}</p><p className="mt-1 font-display text-[13px] font-semibold text-paper">aguardando fonte</p></div>;
}

function AccessDenied() {
  return <div className="app-surface min-h-screen grid place-items-center p-5"><div className="w-full max-w-lg rounded-2xl border border-pulse/30 bg-panel p-7"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pulse">Acesso negado</p><h1 className="mt-2 font-display text-2xl font-bold">Platform Admin obrigatório</h1><Link to="/platform" className="mt-6 inline-flex rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-fog hover:text-paper">Voltar para a central</Link></div></div>;
}
