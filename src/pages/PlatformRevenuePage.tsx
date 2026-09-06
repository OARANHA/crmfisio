import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlatformAdminShell } from '../components/PlatformAdminShell';
import { getCachedPlatformAdminAccess, validatePlatformAdminAccess } from '../lib/platformAdminAccess';

export function PlatformRevenuePage() {
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
      title="Receita & Assinaturas"
      description="Backoffice financeiro do MedicsPro como SaaS, separado do financeiro interno das clínicas."
    >
      <section className="grid gap-4 2xl:grid-cols-[1.55fr_0.7fr]">
        <div className="relative overflow-hidden rounded-[28px] border border-pulse/20 bg-gradient-to-br from-pulse/[0.09] via-panel to-panel p-6 md:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-72 w-72 rounded-full bg-pulse/[0.08] blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-24 h-32 w-32 rounded-full bg-amber/[0.07] blur-2xl" />
          <div className="relative max-w-4xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-pulse">Billing da plataforma</p>
            <h2 className="mt-3 font-display text-[30px] font-bold leading-tight tracking-tight md:text-[38px]">Cobrar, receber, renovar e crescer sem perder rastreabilidade.</h2>
            <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-fog">Esta área será o centro financeiro do SaaS MedicsPro. O gateway processa a cobrança; o Platform Admin mantém a visão do cliente, assinatura, competência, pagamento e histórico de eventos.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <StatusPill tone="pulse" label="Billing SaaS" value="Preparado" />
              <StatusPill tone="amber" label="Asaas" value="Integração pendente" />
              <StatusPill tone="aqua" label="Ledger interno" value="A modelar" />
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-line bg-panel p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-fog">Provedor inicial</p>
              <p className="mt-2 font-display text-[27px] font-bold text-mint">Asaas</p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-full border border-mint/25 bg-mint/[0.08] text-mint">A</span>
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-fog">Direção Brazil-first para cobrança recorrente. O contrato interno continuará neutro para permitir outro provider no futuro sem redesenhar o produto.</p>
          <div className="mt-5 space-y-2.5 border-t border-line/60 pt-4">
            <ProviderRow label="API / webhooks" value="não conectado" tone="amber" />
            <ProviderRow label="Métricas reais" value="não disponíveis" tone="fog" />
            <ProviderRow label="Dados fictícios" value="bloqueados" tone="mint" />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <PreparedCard tone="pulse" icon="◌" title="Assinaturas" sub="Plano, recorrência, status, ciclo e próxima cobrança." />
        <PreparedCard tone="amber" icon="▣" title="Cobranças" sub="Faturas preservadas por competência, vencimento e status." />
        <PreparedCard tone="mint" icon="✓" title="Pagamentos" sub="Recebidos, falhos, estornados e seus eventos externos." />
        <PreparedCard tone="aqua" icon="↗" title="Receita SaaS" sub="MRR, recebido, a receber e inadimplência somente com fonte factual." />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[26px] border border-line bg-panel p-5 md:p-6">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-aqua">Lifecycle financeiro</p>
              <h3 className="mt-1 font-display text-[20px] font-bold">O dinheiro entra em um fluxo controlado, não em um booleano “pago”.</h3>
              <p className="mt-2 max-w-3xl text-[11.5px] leading-relaxed text-fog">A fonte canônica futura preservará cada transição para permitir conciliação, auditoria, inadimplência gradual, upgrade, downgrade, cancelamento, estorno e chargeback.</p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <FlowStep index="01" title="Conta" sub="cliente/pagador" tone="aqua" />
            <FlowStep index="02" title="Assinatura" sub="plano e ciclo" tone="pulse" />
            <FlowStep index="03" title="Cobrança" sub="competência" tone="amber" />
            <FlowStep index="04" title="Pagamento" sub="evento liquidado" tone="mint" />
            <FlowStep index="05" title="Renovação" sub="continuidade" tone="aqua" />
          </div>
        </div>

        <div className="rounded-[26px] border border-line bg-panel p-5 md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-amber">Métricas futuras</p>
          <h3 className="mt-1 font-display text-[20px] font-bold">Espaço pronto, números ainda não.</h3>
          <p className="mt-2 text-[11.5px] leading-relaxed text-fog">MRR, receita recebida, valor em aberto, inadimplência e churn só aparecem quando a fonte financeira estiver conectada e reconciliada.</p>
          <div className="mt-5 grid grid-cols-2 gap-3">
            <MetricPlaceholder label="MRR" />
            <MetricPlaceholder label="Recebido" />
            <MetricPlaceholder label="Em aberto" />
            <MetricPlaceholder label="Inadimplência" />
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-line bg-panel p-5 md:p-6">
        <div className="flex flex-wrap items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mint">Boundary financeiro</p>
            <h3 className="mt-1 font-display text-[19px] font-bold">Dois financeiros, duas verdades de negócio.</h3>
          </div>
          <Link to="/platform/modulos" className="rounded-xl border border-line bg-deep px-4 py-3 text-[11.5px] font-semibold text-paper">Ver clientes & plataforma →</Link>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <div className="rounded-[20px] border border-line bg-deep/55 p-5">
            <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-aqua/[0.08] text-aqua">C</span><p className="font-display text-[15px] font-semibold">Financeiro da clínica</p></div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-fog">Pacientes → sessões/pacotes → recebimentos da própria clínica. Esse domínio permanece dentro do tenant.</p>
          </div>
          <div className="rounded-[20px] border border-pulse/20 bg-pulse/[0.035] p-5">
            <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-pulse/[0.09] text-pulse">M</span><p className="font-display text-[15px] font-semibold">Financeiro MedicsPro</p></div>
            <p className="mt-3 text-[11.5px] leading-relaxed text-fog">Cliente MedicsPro → assinatura → cobrança → pagamento → renovação. Esse é o domínio desta área.</p>
          </div>
        </div>
      </section>
    </PlatformAdminShell>
  );
}

function toneClass(tone: string) {
  if (tone === 'pulse') return 'text-pulse border-pulse/25 bg-pulse/[0.06]';
  if (tone === 'amber') return 'text-amber border-amber/25 bg-amber/[0.06]';
  if (tone === 'aqua') return 'text-aqua border-aqua/25 bg-aqua/[0.06]';
  if (tone === 'mint') return 'text-mint border-mint/25 bg-mint/[0.06]';
  return 'text-fog border-line bg-deep/55';
}

function StatusPill({ tone, label, value }: { tone: string; label: string; value: string }) {
  return <div className={`rounded-xl border px-3.5 py-2.5 ${toneClass(tone)}`}><p className="text-[9px] font-semibold uppercase tracking-[0.11em] opacity-75">{label}</p><p className="mt-0.5 text-[11px] font-semibold">{value}</p></div>;
}

function ProviderRow({ label, value, tone }: { label: string; value: string; tone: string }) {
  return <div className="flex items-center justify-between gap-4 text-[10.5px]"><span className="text-fog">{label}</span><span className={tone === 'mint' ? 'font-semibold text-mint' : tone === 'amber' ? 'font-semibold text-amber' : 'font-semibold text-fog'}>{value}</span></div>;
}

function PreparedCard({ title, sub, tone, icon }: { title: string; sub: string; tone: string; icon: string }) {
  return <article className="rounded-[22px] border border-line bg-panel p-5"><div className="flex items-start justify-between gap-3"><span className={`grid h-9 w-9 place-items-center rounded-xl border ${toneClass(tone)}`}>{icon}</span><span className="rounded-full border border-line px-2 py-1 text-[9px] font-semibold text-fog">em preparação</span></div><p className="mt-4 font-display text-[16px] font-semibold">{title}</p><p className="mt-2 text-[11px] leading-relaxed text-fog">{sub}</p></article>;
}

function FlowStep({ index, title, sub, tone }: { index: string; title: string; sub: string; tone: string }) {
  return <div className="rounded-[18px] border border-line bg-deep/45 p-4"><p className={`text-[9px] font-bold uppercase tracking-[0.12em] ${tone === 'pulse' ? 'text-pulse' : tone === 'amber' ? 'text-amber' : tone === 'mint' ? 'text-mint' : 'text-aqua'}`}>{index}</p><p className="mt-2 font-display text-[14px] font-semibold">{title}</p><p className="mt-1 text-[10px] text-fog">{sub}</p></div>;
}

function MetricPlaceholder({ label }: { label: string }) {
  return <div className="rounded-[18px] border border-line bg-deep/45 p-4"><p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-fog">{label}</p><p className="mt-2 font-display text-[20px] font-bold text-paper/35">—</p><p className="mt-1 text-[9.5px] text-fog">aguardando fonte real</p></div>;
}

function AccessDenied() {
  return <div className="app-surface min-h-screen grid place-items-center p-5"><div className="w-full max-w-lg rounded-2xl border border-pulse/30 bg-panel p-7"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pulse">Acesso negado</p><h1 className="mt-2 font-display text-2xl font-bold">Platform Admin obrigatório</h1><Link to="/platform" className="mt-6 inline-flex rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-fog hover:text-paper">Voltar para a central</Link></div></div>;
}
