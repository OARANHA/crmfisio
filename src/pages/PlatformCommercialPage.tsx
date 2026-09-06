import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlatformAdminShell } from '../components/PlatformAdminShell';
import { isPlatformAdmin } from '../lib/platformAdmin';

const PIPELINE_STEPS = [
  { key: 'lead', title: 'Leads', description: 'Entradas vindas do site e demais canais.', tone: 'aqua' },
  { key: 'qualified', title: 'Qualificação', description: 'Score, SLA e estágio comercial normalizados.', tone: 'mint' },
  { key: 'opportunity', title: 'Oportunidades', description: 'Demonstrações, negociações e negócios em andamento.', tone: 'amber' },
  { key: 'ready', title: 'Prontos para onboarding', description: 'Venda aprovada e pronta para provisioning.', tone: 'pulse' },
] as const;

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
      <section className="grid gap-4 2xl:grid-cols-[1.6fr_0.65fr]">
        <div className="relative overflow-hidden rounded-[28px] border border-aqua/20 bg-gradient-to-br from-aqua/[0.14] via-panel to-panel p-6 md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-16 h-72 w-72 rounded-full bg-aqua/[0.10] blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-28 h-32 w-32 rounded-full bg-mint/[0.07] blur-2xl" />
          <div className="relative max-w-4xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-aqua">Aquisição & conversão</p>
            <h2 className="mt-3 font-display text-[30px] font-bold leading-tight tracking-tight md:text-[38px]">Do primeiro contato à venda pronta para onboarding.</h2>
            <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-fog">O Platform Admin acompanha o funil em nível executivo. O CRM continua responsável por pipeline, cadência e histórico operacional; aqui entram somente estados consolidados e indicadores reais.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/platform/provisionar" className="rounded-xl bg-aqua px-4 py-3 text-[11.5px] font-semibold text-on-accent shadow-sm">Abrir onboarding →</Link>
              <Link to="/platform" className="rounded-xl border border-line bg-panel/80 px-4 py-3 text-[11.5px] font-semibold text-paper">Voltar à visão geral</Link>
            </div>
          </div>
        </div>

        <aside className="rounded-[28px] border border-line bg-panel p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-fog">Integração comercial</p>
              <p className="mt-2 font-display text-[27px] font-bold text-aqua">Preparada</p>
            </div>
            <span className="grid h-11 w-11 place-items-center rounded-full border border-aqua/25 bg-aqua/[0.08] text-aqua">↗</span>
          </div>
          <div className="mt-5 space-y-3">
            <StatusLine label="Site comercial" value="Ativo" tone="mint" />
            <StatusLine label="n8n comercial" value="Ativo" tone="mint" />
            <StatusLine label="CRM bridge" value="Pendente" tone="amber" />
            <StatusLine label="Métricas executivas" value="Aguardando fonte" tone="aqua" />
          </div>
          <p className="mt-5 border-t border-line/60 pt-4 text-[10.5px] leading-relaxed text-fog">Enquanto a fonte comercial consolidada não estiver conectada, esta página não exibe números artificiais.</p>
        </aside>
      </section>

      <section className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
        {PIPELINE_STEPS.map((step, index) => (
          <article key={step.key} className="relative overflow-hidden rounded-[22px] border border-line bg-panel p-5">
            <div className={`absolute inset-x-0 top-0 h-1 ${toneBg(step.tone)}`} />
            <div className="flex items-start gap-3">
              <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-deep font-display text-[12px] font-bold ${toneText(step.tone)}`}>{String(index + 1).padStart(2, '0')}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-display text-[16px] font-semibold">{step.title}</h3>
                  <span className="rounded-full border border-line px-2 py-1 text-[9px] font-semibold text-fog">em preparação</span>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-fog">{step.description}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[26px] border border-line bg-panel p-5 md:p-6">
          <div className="flex flex-wrap items-start gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mint">Fronteira de domínio</p>
              <h3 className="mt-1 font-display text-[20px] font-bold">O lead nunca vira clínica sozinho.</h3>
              <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-fog">A jornada comercial termina em um estado equivalente a <code className="rounded bg-deep px-1.5 py-0.5 text-paper">ready_for_provisioning</code>. A partir daí, criação de tenant, primeiro owner, módulos e lifecycle continuam sob controle do Platform Admin.</p>
            </div>
            <Link to="/platform/provisionar" className="rounded-xl border border-mint/25 bg-mint/[0.06] px-4 py-3 text-[11.5px] font-semibold text-mint">Abrir onboarding →</Link>
          </div>
        </div>

        <div className="rounded-[26px] border border-line bg-panel p-5 md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber">Quando o CRM entrar</p>
          <h3 className="mt-1 font-display text-[20px] font-bold">O que aparecerá aqui</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <FutureMetric title="Leads" detail="volume real por período" />
            <FutureMetric title="Qualificação" detail="score e SLA comercial" />
            <FutureMetric title="Conversão" detail="taxa factual por etapa" />
            <FutureMetric title="Origem" detail="canal e campanha" />
          </div>
        </div>
      </section>
    </PlatformAdminShell>
  );
}

function StatusLine({ label, value, tone }: { label: string; value: string; tone: 'mint' | 'amber' | 'aqua' }) {
  const toneClass = tone === 'mint' ? 'text-mint' : tone === 'amber' ? 'text-amber' : 'text-aqua';
  return <div className="flex items-center gap-3 rounded-xl border border-line/70 bg-deep/45 px-3.5 py-3"><span className={`h-2.5 w-2.5 rounded-full ${tone === 'mint' ? 'bg-mint' : tone === 'amber' ? 'bg-amber' : 'bg-aqua'}`} /><span className="flex-1 text-[11px] text-fog">{label}</span><span className={`text-[11px] font-semibold ${toneClass}`}>{value}</span></div>;
}

function FutureMetric({ title, detail }: { title: string; detail: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-deep/35 p-4"><p className="font-display text-[14px] font-semibold">{title}</p><p className="mt-1 text-[10.5px] text-fog">{detail}</p><p className="mt-3 text-[9.5px] font-semibold text-amber">fonte ainda não conectada</p></div>;
}

function toneText(tone: string) {
  if (tone === 'mint') return 'text-mint';
  if (tone === 'amber') return 'text-amber';
  if (tone === 'pulse') return 'text-pulse';
  return 'text-aqua';
}

function toneBg(tone: string) {
  if (tone === 'mint') return 'bg-mint';
  if (tone === 'amber') return 'bg-amber';
  if (tone === 'pulse') return 'bg-pulse';
  return 'bg-aqua';
}

function AccessDenied() {
  return <div className="app-surface min-h-screen grid place-items-center p-5"><div className="w-full max-w-lg rounded-2xl border border-pulse/30 bg-panel p-7"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pulse">Acesso negado</p><h1 className="mt-2 font-display text-2xl font-bold">Platform Admin obrigatório</h1><Link to="/platform" className="mt-6 inline-flex rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-fog hover:text-paper">Voltar para a central</Link></div></div>;
}
