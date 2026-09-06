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
        loadPlatformAuditLog(10),
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
  const failedRuns = data.runs.filter((run) => run.workerFailed > 0 || ['failed', 'error'].includes(run.status.toLowerCase())).length;
  const automationHealthy = Boolean(masterAutomation?.enabled) && failedRuns === 0;
  const latestRun = data.runs[0] ?? null;
  const recentClinics = useMemo(() => [...data.clinics].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 6), [data.clinics]);
  const activePercent = data.clinics.length ? Math.round((activeClinics / data.clinics.length) * 100) : 0;

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
            {error && <div className="mb-5 rounded-xl border border-amber/35 bg-amber/5 p-3 text-[12.5px] text-amber">{error}</div>}
            <label className="block text-[12px] font-semibold text-paper/80">Email
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none transition focus:border-mint" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="mt-4 block text-[12px] font-semibold text-paper/80">Senha
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none transition focus:border-mint" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </label>
            <button className="mt-6 w-full rounded-xl bg-mint px-4 py-3.5 font-display font-semibold text-on-accent shadow-sm disabled:opacity-50" disabled={!email || !password}>Entrar no cockpit</button>
            <p className="mt-4 text-center text-[10.5px] leading-relaxed text-fog">Owner/admin de clínica não recebe privilégios de Platform Admin.</p>
          </div>
        </form>
      </div>
    );
  }

  return (
    <PlatformAdminShell
      eyebrow="MedicsPro Platform Admin"
      title="Visão geral"
      description="Cockpit executivo do SaaS com dados reais de clínicas, onboarding e saúde operacional."
      actions={<button type="button" onClick={() => void refresh()} disabled={loadingData} className="rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[11px] font-semibold text-fog transition hover:border-mint/35 hover:text-paper disabled:opacity-50">{loadingData ? 'Atualizando…' : 'Atualizar dados'}</button>}
    >
      {error && <div className="rounded-xl border border-amber/35 bg-amber/[0.05] px-4 py-3 text-[12px] text-amber">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[1.65fr_0.75fr]">
        <div className="relative overflow-hidden rounded-[26px] border border-mint/20 bg-gradient-to-br from-mint/[0.12] via-panel to-panel p-6 md:p-7">
          <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-mint/[0.08] blur-2xl" />
          <div className="relative max-w-3xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-mint">Cockpit executivo</p>
            <h2 className="mt-3 font-display text-[28px] font-bold leading-tight tracking-tight md:text-[34px]">O MedicsPro em uma visão simples, viva e acionável.</h2>
            <p className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-fog">Clínicas, onboarding e governança já refletem dados reais. Comercial e receita permanecem preparados, sem métricas fictícias, até as integrações chegarem.</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Link to="/platform/provisionar" className="rounded-xl bg-mint px-4 py-3 text-[11.5px] font-semibold text-on-accent shadow-sm">Analisar solicitações →</Link>
              <Link to="/platform/modulos" className="rounded-xl border border-line bg-panel/80 px-4 py-3 text-[11.5px] font-semibold text-paper">Gerenciar clínicas</Link>
            </div>
          </div>
        </div>

        <div className="rounded-[26px] border border-line bg-panel p-5.5 shadow-[0_14px_36px_rgba(3,16,48,0.045)]">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-fog">Saúde da plataforma</p>
              <p className={`mt-2 font-display text-[25px] font-bold ${automationHealthy ? 'text-mint' : 'text-amber'}`}>{automationHealthy ? 'Operacional' : 'Atenção'}</p>
            </div>
            <span className={`grid h-9 w-9 place-items-center rounded-full border ${automationHealthy ? 'border-mint/25 bg-mint/[0.08] text-mint' : 'border-amber/25 bg-amber/[0.08] text-amber'}`}>{automationHealthy ? '✓' : '!'}</span>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 text-[10.5px]">
            <MiniStat label="Automações pausadas" value={String(pausedAutomations)} />
            <MiniStat label="Falhas recentes" value={String(failedRuns)} />
          </div>
          <p className="mt-4 border-t border-line/60 pt-3 text-[10px] text-fog">{latestRun ? `Último ciclo: ${formatDate(latestRun.startedAt)}` : 'Nenhum ciclo recente disponível.'}</p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Clínicas ativas" value={String(activeClinics)} detail={`${data.clinics.length} cadastrada(s) no total`} tone="mint" />
        <MetricCard label="Solicitações pendentes" value={String(data.pendingRequests.length)} detail="aguardando análise" tone={data.pendingRequests.length ? 'amber' : 'aqua'} />
        <MetricCard label="Clínicas suspensas" value={String(suspendedClinics)} detail="lifecycle sob controle" tone={suspendedClinics ? 'amber' : 'fog'} />
        <MetricCard label="Base ativa" value={`${activePercent}%`} detail="proporção de clínicas ativas" tone={activePercent === 100 ? 'mint' : 'aqua'} />
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[24px] border border-line bg-panel p-5 md:p-6">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-fog">Áreas de negócio</p>
              <h3 className="mt-1 font-display text-[19px] font-bold">Quatro frentes, uma operação</h3>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <AreaCard to="/platform" title="Visão geral" description="Indicadores reais e saúde operacional do SaaS." status="Ativo" />
            <AreaCard to="/platform/comercial" title="Comercial" description="Estrutura pronta para leads, oportunidades e conversões." status="Fonte em preparação" />
            <AreaCard to="/platform/modulos" title="Clientes & Plataforma" description="Lifecycle, módulos, entitlements e operação da base." status="Ativo" />
            <AreaCard to="/platform/receita" title="Receita & Assinaturas" description="Estrutura pronta para billing e Asaas, sem MRR fictício." status="Integração futura" />
          </div>
        </div>

        <div className="rounded-[24px] border border-line bg-panel p-5 md:p-6">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-fog">Governança</p><h3 className="mt-1 font-display text-[19px] font-bold">Atividade recente</h3></div>
            <Link to="/platform/governanca" className="text-[11px] font-semibold text-mint hover:text-paper">Auditoria →</Link>
          </div>
          <div className="mt-4 space-y-2">
            {data.audit.slice(0, 6).map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-line/65 bg-deep/40 px-3.5 py-3">
                <div className="flex items-start gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-mint" /><div className="min-w-0 flex-1"><p className="truncate text-[11.5px] font-semibold text-paper">{auditLabel(entry.action)}</p><p className="mt-0.5 truncate text-[9.5px] text-fog">{entry.entityType} · {entry.entityKey}</p></div><span className="shrink-0 text-[9px] text-fog">{formatDate(entry.createdAt)}</span></div>
              </div>
            ))}
            {!data.audit.length && <div className="rounded-2xl border border-dashed border-line p-5 text-center text-[11.5px] text-fog">Sem atividade recente disponível.</div>}
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-line bg-panel p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-fog">Clientes & Plataforma</p><h3 className="mt-1 font-display text-[19px] font-bold">Clínicas recentes</h3></div>
          <div className="flex gap-2"><Link to="/platform/modulos" className="rounded-xl border border-line bg-deep/45 px-3.5 py-2.5 text-[11px] font-semibold text-paper">Gerenciar base</Link><Link to="/platform/provisionar" className="rounded-xl bg-mint px-3.5 py-2.5 text-[11px] font-semibold text-on-accent">Novo onboarding</Link></div>
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {recentClinics.map((clinic) => (
            <div key={clinic.id} className="flex items-center gap-3 rounded-2xl border border-line/65 bg-deep/40 p-3.5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-line bg-panel font-display text-[12px] font-bold text-mint">{clinic.name.slice(0, 2).toUpperCase()}</div>
              <div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold text-paper">{clinic.name}</p><p className="mt-0.5 text-[9.5px] text-fog">desde {formatDate(clinic.createdAt)}</p></div>
              <span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${clinic.lifecycleStatus === 'active' ? 'border-mint/30 bg-mint/[0.07] text-mint' : 'border-amber/30 bg-amber/[0.07] text-amber'}`}>{clinic.lifecycleStatus === 'active' ? 'ativa' : 'suspensa'}</span>
            </div>
          ))}
          {!recentClinics.length && <div className="col-span-full py-6 text-center text-[11.5px] text-fog">Nenhuma clínica disponível.</div>}
        </div>
      </section>
    </PlatformAdminShell>
  );
}

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'mint' | 'aqua' | 'amber' | 'fog' }) {
  const toneClass = tone === 'mint' ? 'text-mint' : tone === 'aqua' ? 'text-aqua' : tone === 'amber' ? 'text-amber' : 'text-fog';
  return <article className="rounded-[22px] border border-line bg-panel p-4.5 shadow-[0_10px_28px_rgba(3,16,48,0.03)]"><p className="text-[10px] font-semibold text-fog">{label}</p><p className={`mt-2 font-display text-[29px] font-bold tracking-tight ${toneClass}`}>{value}</p><p className="mt-1 text-[10.5px] leading-relaxed text-fog">{detail}</p></article>;
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-deep/55 p-3"><p className="text-[9.5px] text-fog">{label}</p><p className="mt-1 font-display text-[17px] font-bold">{value}</p></div>;
}

function AreaCard({ to, title, description, status }: { to: string; title: string; description: string; status: string }) {
  return <Link to={to} className="group rounded-2xl border border-line bg-deep/35 p-4 transition hover:border-mint/30 hover:bg-raise/25"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="font-display text-[14px] font-bold">{title}</p><p className="mt-2 text-[10.5px] leading-relaxed text-fog">{description}</p><p className="mt-3 text-[9.5px] font-semibold text-mint">{status}</p></div><span className="text-fog transition group-hover:text-mint">→</span></div></Link>;
}
