import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlatformAdminShell } from '../components/PlatformAdminShell';
import { platformSupabase } from '../lib/platformSupabaseClient';
import {
  isPlatformAdmin,
  loadPlatformAuditLog,
  loadPlatformAutomationRuns,
  loadPlatformAutomationSettings,
  loadPlatformClinics,
  type PlatformAuditEntry,
  type PlatformAutomationRun,
  type PlatformAutomationSetting,
  type PlatformClinicSummary,
} from '../lib/platformAdmin';
import { loadClinicAccessRequests, type ClinicAccessRequest } from '../lib/platformAccessRequests';

type DashboardData = {
  clinics: PlatformClinicSummary[];
  pendingRequests: ClinicAccessRequest[];
  settings: PlatformAutomationSetting[];
  runs: PlatformAutomationRun[];
  audit: PlatformAuditEntry[];
};

const EMPTY_DATA: DashboardData = { clinics: [], pendingRequests: [], settings: [], runs: [], audit: [] };

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function auditLabel(action: string) {
  const labels: Record<string, string> = {
    'clinic.suspended': 'Clínica suspensa',
    'clinic.reactivated': 'Clínica reativada',
    'clinic.provisioned': 'Clínica provisionada',
    'clinic.provision_review_sync_pending': 'Revisão de onboarding pendente',
    'platform_admin.activated': 'Platform Admin ativado',
  };
  return labels[action] ?? action.split('.').join(' · ');
}

export function PlatformAdminHomePage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [data, setData] = useState<DashboardData>(EMPTY_DATA);

  const refresh = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      const [clinics, pendingRequests, settings, runs, audit] = await Promise.all([
        loadPlatformClinics(),
        loadClinicAccessRequests('pending'),
        loadPlatformAutomationSettings(),
        loadPlatformAutomationRuns(12),
        loadPlatformAuditLog(6),
      ]);
      setData({ clinics, pendingRequests, settings, runs, audit });
    } catch (cause) {
      console.error('[Platform Admin] cockpit load:', cause);
      setError('Não foi possível carregar todos os indicadores da plataforma.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  const validate = useCallback(async () => {
    try {
      const allowed = await isPlatformAdmin();
      setAuthorized(allowed);
      if (allowed) await refresh();
    } catch (cause) {
      console.error('[Platform Admin] home authorization:', cause);
      setAuthorized(false);
    }
  }, [refresh]);

  useEffect(() => {
    let active = true;
    void platformSupabase.auth.getSession().then(({ data: sessionData }) => {
      if (!active) return;
      if (!sessionData.session) setAuthorized(false);
      else void validate();
    });
    const { data: listener } = platformSupabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (!session) {
        setAuthorized(false);
        setData(EMPTY_DATA);
      } else {
        void validate();
      }
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [validate]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const { error: signInError } = await platformSupabase.auth.signInWithPassword({ email: email.trim(), password });
    if (signInError) {
      setError(signInError.message);
      setAuthorized(false);
      return;
    }
    await validate();
  };

  const activeClinics = useMemo(() => data.clinics.filter((clinic) => clinic.lifecycleStatus === 'active').length, [data.clinics]);
  const suspendedClinics = data.clinics.length - activeClinics;
  const masterAutomation = data.settings.find((setting) => setting.key === 'automation.enabled');
  const pausedAutomations = data.settings.filter((setting) => !setting.enabled).length;
  const activeAutomations = data.settings.length - pausedAutomations;
  const failedRuns = data.runs.filter((run) => run.workerFailed > 0 || ['failed', 'error'].includes(run.status.toLowerCase())).length;
  const automationHealthy = Boolean(masterAutomation?.enabled) && failedRuns === 0;
  const latestRun = data.runs[0] ?? null;
  const recentClinics = useMemo(() => [...data.clinics].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6), [data.clinics]);
  const activePercent = data.clinics.length ? Math.round((activeClinics / data.clinics.length) * 100) : 0;
  const onboardingAttention = data.pendingRequests.length > 0;

  if (authorized === null) return <div className="app-surface min-h-screen grid place-items-center text-fog">Validando sessão da plataforma…</div>;

  if (!authorized) {
    return (
      <div className="app-surface min-h-screen grid place-items-center p-5">
        <form onSubmit={signIn} className="w-full max-w-md overflow-hidden rounded-[28px] border border-line bg-panel shadow-[0_28px_90px_rgba(3,16,48,0.13)]">
          <div className="border-b border-line/70 bg-gradient-to-br from-mint/[0.10] via-panel to-panel px-7 py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mint">MedicsPro Platform</p>
            <h1 className="mt-2 font-display text-[27px] font-bold tracking-tight">Administração da plataforma</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-fog">Acesso separado do ambiente das clínicas, reservado à governança do SaaS.</p>
          </div>
          <div className="p-7">
            {error && <div className="mb-5 rounded-xl border border-amber/35 bg-amber/[0.05] p-3 text-[12.5px] text-amber">{error}</div>}
            <label className="block text-[12px] font-semibold text-paper/80">Email
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="mt-4 block text-[12px] font-semibold text-paper/80">Senha
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            <button className="mt-6 w-full rounded-xl bg-mint px-4 py-3.5 font-display font-semibold text-on-accent" disabled={!email || !password}>Entrar no cockpit</button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <PlatformAdminShell
      eyebrow="MedicsPro Platform Admin"
      title="Visão geral"
      description="Cockpit executivo do SaaS com clientes, onboarding, automações e governança baseados somente em dados reais."
      hideDesktopHeader
      actions={<button type="button" onClick={() => void refresh()} disabled={loadingData} className="rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[11px] font-semibold text-fog transition hover:border-mint/35 hover:text-paper disabled:opacity-50">{loadingData ? 'Atualizando…' : 'Atualizar dados'}</button>}
    >
      {error && <div className="rounded-[16px] border border-amber/35 bg-amber/[0.05] px-4 py-3 text-[12px] text-amber">{error}</div>}

      <section className="grid gap-4 2xl:grid-cols-[1.65fr_0.65fr]">
        <div className="relative overflow-hidden rounded-[28px] border border-mint/20 bg-gradient-to-br from-mint/[0.14] via-panel to-panel p-6 md:p-8">
          <div className="pointer-events-none absolute -right-20 -top-16 h-72 w-72 rounded-full bg-aqua/[0.10] blur-3xl" />
          <div className="pointer-events-none absolute bottom-0 right-20 h-28 w-28 rounded-full bg-amber/[0.06] blur-2xl" />
          <div className="relative max-w-4xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-mint">Cockpit executivo</p>
            <h2 className="mt-3 font-display text-[30px] font-bold leading-tight tracking-tight md:text-[38px]">O MedicsPro em uma leitura clara, viva e acionável.</h2>
            <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-fog">Veja a base de clientes, pendências de onboarding, saúde das automações, atividade recente e o que precisa de atenção. Comercial e receita entram com números somente quando suas fontes reais estiverem conectadas.</p>
            <div className="mt-6 flex flex-wrap gap-2">
              <Link to="/platform/provisionar" className="rounded-xl bg-mint px-4 py-3 text-[11.5px] font-semibold text-on-accent shadow-sm">Analisar solicitações →</Link>
              <Link to="/platform/modulos" className="rounded-xl border border-line bg-panel/80 px-4 py-3 text-[11.5px] font-semibold text-paper">Gerenciar clientes</Link>
              <Link to="/platform/governanca" className="rounded-xl border border-aqua/25 bg-aqua/[0.05] px-4 py-3 text-[11.5px] font-semibold text-aqua">Ver governança</Link>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-line bg-panel p-5 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-fog">Saúde da plataforma</p><p className={`mt-2 font-display text-[27px] font-bold ${automationHealthy ? 'text-mint' : 'text-amber'}`}>{automationHealthy ? 'Operacional' : 'Requer atenção'}</p></div>
            <span className={`grid h-11 w-11 place-items-center rounded-full border ${automationHealthy ? 'border-mint/25 bg-mint/[0.08] text-mint' : 'border-amber/25 bg-amber/[0.08] text-amber'}`}>{automationHealthy ? '✓' : '!'}</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-[10.5px]">
            <MiniStat label="Automações ativas" value={`${activeAutomations}/${data.settings.length}`} tone="mint" />
            <MiniStat label="Falhas recentes" value={String(failedRuns)} tone={failedRuns ? 'pulse' : 'aqua'} />
            <MiniStat label="Fila onboarding" value={String(data.pendingRequests.length)} tone={onboardingAttention ? 'amber' : 'mint'} />
            <MiniStat label="Base ativa" value={`${activePercent}%`} tone="aqua" />
          </div>
          <p className="mt-4 border-t border-line/60 pt-3 text-[10px] text-fog">{latestRun ? `Último ciclo: ${formatDate(latestRun.startedAt)}` : 'Nenhum ciclo recente disponível.'}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <MetricCard label="Clínicas ativas" value={String(activeClinics)} detail={`${data.clinics.length} no total`} tone="mint" icon="◇" />
        <MetricCard label="Solicitações" value={String(data.pendingRequests.length)} detail="aguardando decisão" tone={onboardingAttention ? 'amber' : 'aqua'} icon="＋" />
        <MetricCard label="Suspensas" value={String(suspendedClinics)} detail="lifecycle controlado" tone={suspendedClinics ? 'amber' : 'fog'} icon="‖" />
        <MetricCard label="Base ativa" value={`${activePercent}%`} detail="proporção operacional" tone="aqua" icon="↗" />
        <MetricCard label="Automações" value={String(activeAutomations)} detail={`${pausedAutomations} pausada(s)`} tone="mint" icon="⌁" />
        <MetricCard label="Falhas de ciclo" value={String(failedRuns)} detail={`em ${data.runs.length} execuções`} tone={failedRuns ? 'pulse' : 'aqua'} icon="!" />
      </section>

      <section className="grid gap-4 2xl:grid-cols-[1.25fr_0.75fr]">
        <div className="rounded-[26px] border border-line bg-panel p-5 md:p-6">
          <div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-aqua">Pulso operacional</p><h3 className="mt-1 font-display text-[20px] font-bold">Último ciclo da plataforma</h3><p className="mt-1 text-[11.5px] text-fog">Leitura factual do run mais recente do orquestrador.</p></div><Link to="/platform/governanca" className="text-[11px] font-semibold text-aqua">Detalhes →</Link></div>
          {latestRun ? (
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <PulseCard label="Clínicas processadas" value={latestRun.clinicsProcessed} tone="mint" />
              <PulseCard label="Confirmações enfileiradas" value={latestRun.queuedConfirmations} tone="aqua" />
              <PulseCard label="NPS enfileirados" value={latestRun.queuedNps} tone="amber" />
              <PulseCard label="WhatsApp processados" value={latestRun.workerProcessed} tone="aqua" />
              <PulseCard label="WhatsApp enviados" value={latestRun.workerSent} tone="mint" />
              <PulseCard label="Falhas do worker" value={latestRun.workerFailed} tone={latestRun.workerFailed ? 'pulse' : 'mint'} />
            </div>
          ) : <div className="mt-5 rounded-2xl border border-dashed border-line p-7 text-center text-fog">Ainda não há execução operacional recente disponível.</div>}
        </div>

        <div className="rounded-[26px] border border-line bg-panel p-5 md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-amber">Distribuição</p>
          <h3 className="mt-1 font-display text-[20px] font-bold">Base de clientes</h3>
          <div className="mx-auto mt-5 grid h-44 w-44 place-items-center rounded-full" style={{ background: `conic-gradient(var(--color-mint) 0 ${activePercent}%, var(--color-amber) ${activePercent}% 100%)` }}>
            <div className="grid h-32 w-32 place-items-center rounded-full bg-panel text-center shadow-inner"><div><p className="text-[10px] text-fog">Ativas</p><p className="font-display text-[30px] font-bold">{activeClinics}</p><p className="text-[10px] text-fog">de {data.clinics.length}</p></div></div>
          </div>
          <div className="mt-5 space-y-2.5 text-[11px]"><LegendRow label="Ativas" value={activeClinics} tone="mint" /><LegendRow label="Suspensas" value={suspendedClinics} tone="amber" /><LegendRow label="Em análise" value={data.pendingRequests.length} tone="aqua" /></div>
        </div>
      </section>

      <section className="rounded-[26px] border border-line bg-panel p-5 md:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-fog">Áreas de negócio</p>
        <h3 className="mt-1 font-display text-[20px] font-bold">Quatro frentes, uma operação</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
          <BusinessAreaCard to="/platform" eyebrow="Ativo" title="Visão geral" description="Indicadores reais e saúde operacional do SaaS." tone="mint" />
          <BusinessAreaCard to="/platform/comercial" eyebrow="Fonte em preparação" title="Comercial" description="Leads, qualificação, oportunidades e conversões quando o bridge entrar." tone="aqua" />
          <BusinessAreaCard to="/platform/modulos" eyebrow="Ativo" title="Clientes & Plataforma" description="Lifecycle, módulos, entitlements e operação da base." tone="amber" />
          <BusinessAreaCard to="/platform/receita" eyebrow="Integração futura" title="Receita & Assinaturas" description="Assinaturas, pagamentos e MRR após integração factual com billing." tone="pulse" />
        </div>
      </section>

      <section className="grid gap-4 2xl:grid-cols-2">
        <div className="rounded-[26px] border border-line bg-panel p-5 md:p-6">
          <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-amber">Onboarding</p><h3 className="mt-1 font-display text-[20px] font-bold">Solicitações pendentes</h3></div><Link to="/platform/provisionar" className="text-[11px] font-semibold text-amber">Abrir fila →</Link></div>
          <div className="mt-4 space-y-2">
            {data.pendingRequests.slice(0, 4).map((request) => <Link key={request.id} to="/platform/provisionar" className="flex items-center gap-3 rounded-2xl border border-line/70 bg-deep/40 px-4 py-3.5 hover:border-amber/30"><div className="grid h-9 w-9 place-items-center rounded-xl bg-amber/[0.08] font-display font-bold text-amber">{request.clinicName.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate font-display text-[13px] font-semibold">{request.clinicName}</p><p className="truncate text-[10.5px] text-fog">{request.ownerName} · {request.ownerEmail}</p></div><span className="rounded-full border border-amber/25 bg-amber/[0.06] px-2 py-1 text-[9.5px] font-semibold text-amber">pendente</span></Link>)}
            {!data.pendingRequests.length && <div className="rounded-2xl border border-dashed border-line p-7 text-center text-[11.5px] text-fog">Nenhuma solicitação pendente.</div>}
          </div>
        </div>

        <div className="rounded-[26px] border border-line bg-panel p-5 md:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-aqua">Governança</p><h3 className="mt-1 font-display text-[20px] font-bold">Atividade recente</h3></div><Link to="/platform/governanca" className="text-[11px] font-semibold text-aqua">Auditoria →</Link></div>
          <div className="mt-4 grid gap-2 xl:grid-cols-2">
            {data.audit.slice(0, 6).map((entry) => <div key={entry.id} className="rounded-2xl border border-line/65 bg-deep/40 px-3.5 py-3"><div className="flex items-start gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-aqua" /><div className="min-w-0 flex-1"><p className="truncate text-[11.5px] font-semibold text-paper">{auditLabel(entry.action)}</p><p className="mt-0.5 truncate text-[9.5px] text-fog">{entry.entityType} · {entry.entityKey}</p></div><span className="shrink-0 text-[9px] text-fog">{formatDate(entry.createdAt)}</span></div></div>)}
            {!data.audit.length && <div className="col-span-full rounded-2xl border border-dashed border-line p-5 text-center text-[11.5px] text-fog">Sem atividade recente disponível.</div>}
          </div>
        </div>
      </section>

      <section className="rounded-[26px] border border-line bg-panel p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-fog">Clientes & Plataforma</p><h3 className="mt-1 font-display text-[20px] font-bold">Clínicas recentes</h3></div><div className="flex gap-2"><Link to="/platform/modulos" className="rounded-xl border border-line bg-deep/45 px-3.5 py-2.5 text-[11px] font-semibold text-paper">Gerenciar base</Link><Link to="/platform/provisionar" className="rounded-xl bg-mint px-3.5 py-2.5 text-[11px] font-semibold text-on-accent">Novo onboarding</Link></div></div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
          {recentClinics.map((clinic) => <div key={clinic.id} className="flex items-center gap-3 rounded-2xl border border-line/65 bg-deep/40 p-3.5"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-panel font-display text-[12px] font-bold text-mint">{clinic.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold text-paper">{clinic.name}</p><p className="mt-0.5 text-[9.5px] text-fog">desde {formatDate(clinic.createdAt)}</p></div><span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${clinic.lifecycleStatus === 'active' ? 'border-mint/30 bg-mint/[0.07] text-mint' : 'border-amber/30 bg-amber/[0.07] text-amber'}`}>{clinic.lifecycleStatus === 'active' ? 'ativa' : 'suspensa'}</span></div>)}
          {!recentClinics.length && <div className="col-span-full py-6 text-center text-[11.5px] text-fog">Nenhuma clínica disponível.</div>}
        </div>
      </section>
    </PlatformAdminShell>
  );
}

function toneText(tone: string) { return tone === 'aqua' ? 'text-aqua' : tone === 'amber' ? 'text-amber' : tone === 'pulse' ? 'text-pulse' : tone === 'fog' ? 'text-fog' : 'text-mint'; }
function MetricCard({ label, value, detail, tone, icon }: { label: string; value: string; detail: string; tone: 'mint' | 'aqua' | 'amber' | 'pulse' | 'fog'; icon: string }) { return <article className="rounded-[22px] border border-line bg-panel p-4.5"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold text-fog">{label}</p><p className={`mt-2 font-display text-[29px] font-bold tracking-tight ${toneText(tone)}`}>{value}</p><p className="mt-1 text-[10.5px] text-fog">{detail}</p></div><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line bg-deep ${toneText(tone)}`}>{icon}</span></div></article>; }
function MiniStat({ label, value, tone }: { label: string; value: string; tone: 'mint' | 'aqua' | 'amber' | 'pulse' }) { return <div className="rounded-xl border border-line/60 bg-deep/50 p-3"><p className="text-[9.5px] text-fog">{label}</p><p className={`mt-1 font-display text-[18px] font-bold ${toneText(tone)}`}>{value}</p></div>; }
function PulseCard({ label, value, tone }: { label: string; value: number; tone: 'mint' | 'aqua' | 'amber' | 'pulse' }) { return <div className="rounded-2xl border border-line/65 bg-deep/35 p-4"><p className="text-[10px] text-fog">{label}</p><p className={`mt-2 font-display text-[23px] font-bold ${toneText(tone)}`}>{value}</p></div>; }
function LegendRow({ label, value, tone }: { label: string; value: number; tone: 'mint' | 'amber' | 'aqua' }) { const dot = tone === 'mint' ? 'bg-mint' : tone === 'amber' ? 'bg-amber' : 'bg-aqua'; return <div className="flex items-center gap-2.5"><span className={`h-2.5 w-2.5 rounded-full ${dot}`} /><span className="flex-1 text-fog">{label}</span><span className="font-display font-bold text-paper">{value}</span></div>; }
function BusinessAreaCard({ to, eyebrow, title, description, tone }: { to: string; eyebrow: string; title: string; description: string; tone: 'mint' | 'aqua' | 'amber' | 'pulse' }) { return <Link to={to} className="group rounded-2xl border border-line/70 bg-deep/35 p-4 transition hover:-translate-y-0.5 hover:border-line2"><div className="flex items-start gap-3"><span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${tone === 'mint' ? 'bg-mint' : tone === 'aqua' ? 'bg-aqua' : tone === 'amber' ? 'bg-amber' : 'bg-pulse'}`} /><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><p className="font-display text-[14px] font-bold">{title}</p><span className="ml-auto text-fog transition group-hover:translate-x-0.5">→</span></div><p className="mt-2 text-[10.5px] leading-relaxed text-fog">{description}</p><p className={`mt-3 text-[9.5px] font-semibold ${toneText(tone)}`}>{eyebrow}</p></div></div></Link>; }
