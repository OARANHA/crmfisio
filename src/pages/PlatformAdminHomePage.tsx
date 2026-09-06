import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

const EMPTY_DATA: DashboardData = {
  clinics: [],
  pendingRequests: [],
  settings: [],
  runs: [],
  audit: [],
};

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
  const latestRun = data.runs[0] ?? null;
  const failedRuns = data.runs.filter((run) => run.workerFailed > 0 || ['failed', 'error'].includes(run.status.toLowerCase())).length;
  const automationHealthy = Boolean(masterAutomation?.enabled) && failedRuns === 0;
  const recentClinics = useMemo(() => [...data.clinics].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)).slice(0, 5), [data.clinics]);

  if (authorized === null) return <div className="app-surface min-h-screen grid place-items-center text-fog">Validando sessão da plataforma…</div>;

  if (!authorized) {
    return (
      <div className="app-surface min-h-screen grid place-items-center p-5">
        <form onSubmit={signIn} className="w-full max-w-md overflow-hidden rounded-[24px] border border-line bg-panel shadow-[0_24px_80px_rgba(3,16,48,0.12)]">
          <div className="border-b border-line/70 bg-gradient-to-br from-aqua/[0.09] via-panel to-panel px-7 py-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mint">MedicsPro Platform</p>
            <h1 className="mt-2 font-display text-[26px] font-bold tracking-tight">Administração da plataforma</h1>
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
    <div className="app-surface min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[1500px]">
        <aside className="hidden w-[245px] shrink-0 border-r border-line/70 bg-deep/75 p-5 lg:flex lg:flex-col">
          <Link to="/platform" className="rounded-2xl border border-aqua/20 bg-panel/75 p-4">
            <p className="font-display text-[17px] font-bold tracking-tight">MedicsPro<span className="text-mint">.</span></p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.15em] text-fog">Platform Admin</p>
          </Link>
          <nav className="mt-6 space-y-1.5 text-[12px] font-semibold">
            <Link to="/platform" className="flex items-center gap-3 rounded-xl border border-aqua/25 bg-aqua/[0.07] px-3 py-3 text-paper"><span className="text-aqua">◆</span> Visão geral</Link>
            <Link to="/platform/provisionar" className="flex items-center gap-3 rounded-xl px-3 py-3 text-fog transition hover:bg-panel hover:text-paper"><span>＋</span> Onboarding</Link>
            <Link to="/platform/modulos" className="flex items-center gap-3 rounded-xl px-3 py-3 text-fog transition hover:bg-panel hover:text-paper"><span>◫</span> Módulos e planos</Link>
            <Link to="/platform/governanca" className="flex items-center gap-3 rounded-xl px-3 py-3 text-fog transition hover:bg-panel hover:text-paper"><span>⌁</span> Governança</Link>
          </nav>
          <div className="mt-auto rounded-2xl border border-line/70 bg-panel/55 p-4">
            <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-fog">Operação</p>
            <p className={`mt-2 text-[12px] font-semibold ${automationHealthy ? 'text-mint' : 'text-amber'}`}>{automationHealthy ? 'Plataforma operacional' : 'Requer atenção'}</p>
            <p className="mt-1 text-[10.5px] leading-relaxed text-fog">{pausedAutomations} automação(ões) pausada(s) · {failedRuns} ciclo(s) com falha recente.</p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 border-b border-line/70 bg-deep/90 px-5 py-4 backdrop-blur-xl md:px-7">
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-mint">MedicsPro Platform Admin</p>
                <h1 className="mt-0.5 font-display text-[21px] font-bold tracking-tight">Cockpit da plataforma</h1>
              </div>
              <button type="button" onClick={() => void refresh()} disabled={loadingData} className="rounded-xl border border-line bg-panel/70 px-3 py-2 text-[11px] font-semibold text-fog transition hover:border-aqua/30 hover:text-paper disabled:opacity-50">{loadingData ? 'Atualizando…' : 'Atualizar dados'}</button>
              <button onClick={() => void platformSupabase.auth.signOut()} className="rounded-xl border border-line px-3 py-2 text-[11px] font-semibold text-pulse transition hover:bg-pulse/[0.05]">Sair</button>
            </div>
          </header>

          <main className="space-y-5 p-5 md:p-7">
            {error && <div className="rounded-xl border border-amber/35 bg-amber/[0.05] px-4 py-3 text-[12px] text-amber">{error}</div>}

            <section className="overflow-hidden rounded-[24px] border border-aqua/20 bg-gradient-to-br from-aqua/[0.09] via-panel to-panel p-5 md:p-6">
              <div className="flex flex-wrap items-start gap-4">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-aqua">Visão executiva</p>
                  <h2 className="mt-2 max-w-3xl font-display text-[27px] font-bold tracking-tight md:text-[31px]">Controle o crescimento do MedicsPro sem perder governança.</h2>
                  <p className="mt-2 max-w-3xl text-[12.5px] leading-relaxed text-fog">Onboarding, clínicas, módulos, automações e auditoria reunidos em uma visão operacional única.</p>
                </div>
                <Link to="/platform/provisionar" className="rounded-xl bg-mint px-4 py-3 font-display text-[12px] font-semibold text-on-accent shadow-sm">Analisar solicitações</Link>
              </div>
            </section>

            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Clínicas ativas" value={String(activeClinics)} detail={`${data.clinics.length} cadastrada(s) no total`} tone="mint" />
              <MetricCard label="Solicitações pendentes" value={String(data.pendingRequests.length)} detail="aguardando sua análise" tone={data.pendingRequests.length ? 'amber' : 'aqua'} />
              <MetricCard label="Clínicas suspensas" value={String(suspendedClinics)} detail="lifecycle controlado pela plataforma" tone={suspendedClinics ? 'amber' : 'fog'} />
              <MetricCard label="Saúde operacional" value={automationHealthy ? 'OK' : 'Atenção'} detail={latestRun ? `último ciclo ${formatDate(latestRun.startedAt)}` : 'sem ciclo recente'} tone={automationHealthy ? 'mint' : 'amber'} />
            </section>

            <section className="grid gap-4 xl:grid-cols-[1.35fr_0.65fr]">
              <div className="rounded-[22px] border border-line bg-panel p-5">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-aqua">Onboarding</p>
                    <h3 className="mt-1 font-display text-[18px] font-bold">Solicitações de acesso</h3>
                    <p className="mt-1 text-[11.5px] text-fog">Fila real de entrada comercial antes do provisionamento.</p>
                  </div>
                  <Link to="/platform/provisionar" className="text-[11px] font-semibold text-aqua hover:text-paper">Abrir fila →</Link>
                </div>
                <div className="mt-4 space-y-2">
                  {data.pendingRequests.slice(0, 5).map((request) => (
                    <Link key={request.id} to="/platform/provisionar" className="flex flex-wrap items-center gap-3 rounded-xl border border-line/70 bg-deep/55 px-4 py-3 transition hover:border-aqua/30 hover:bg-raise/30">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-[13px] font-semibold">{request.clinicName}</p>
                        <p className="mt-0.5 truncate text-[10.5px] text-fog">{request.ownerName} · {request.ownerEmail}</p>
                      </div>
                      <div className="text-right"><span className="rounded-full border border-amber/30 bg-amber/[0.07] px-2 py-1 text-[9.5px] font-semibold text-amber">pendente</span><p className="mt-1 font-mono text-[9px] text-fog">{formatDate(request.createdAt)}</p></div>
                    </Link>
                  ))}
                  {!loadingData && data.pendingRequests.length === 0 && <div className="rounded-xl border border-dashed border-line p-5 text-center text-[11.5px] text-fog">Nenhuma solicitação pendente neste momento.</div>}
                </div>
              </div>

              <div className="rounded-[22px] border border-line bg-panel p-5">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-aqua">Ações rápidas</p>
                <h3 className="mt-1 font-display text-[18px] font-bold">Operação SaaS</h3>
                <div className="mt-4 space-y-2">
                  <QuickAction to="/platform/provisionar" title="Aprovar nova clínica" sub="Solicitação → owner → primeiro acesso" />
                  <QuickAction to="/platform/modulos" title="Ajustar módulos" sub="Nexus, Financeiro, CRM, WhatsApp e mais" />
                  <QuickAction to="/platform/governanca" title="Revisar automações" sub={`${pausedAutomations} pausada(s) · ${failedRuns} falha(s) recente(s)`} />
                </div>
              </div>
            </section>

            <section className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-[22px] border border-line bg-panel p-5">
                <div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-aqua">Base de clientes</p><h3 className="mt-1 font-display text-[18px] font-bold">Clínicas recentes</h3></div><Link to="/platform/modulos" className="text-[11px] font-semibold text-aqua hover:text-paper">Gerenciar →</Link></div>
                <div className="mt-4 divide-y divide-line/60">
                  {recentClinics.map((clinic) => <div key={clinic.id} className="flex items-center gap-3 py-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-deep font-display text-[12px] font-bold text-aqua">{clinic.name.slice(0, 2).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-[12px] font-semibold text-paper">{clinic.name}</p><p className="mt-0.5 text-[9.5px] font-mono text-fog">desde {formatDate(clinic.createdAt)}</p></div><span className={`rounded-full border px-2 py-1 text-[9px] font-semibold ${clinic.lifecycleStatus === 'active' ? 'border-mint/30 bg-mint/[0.07] text-mint' : 'border-amber/30 bg-amber/[0.07] text-amber'}`}>{clinic.lifecycleStatus === 'active' ? 'ativa' : 'suspensa'}</span></div>)}
                  {!recentClinics.length && <div className="py-6 text-center text-[11.5px] text-fog">Nenhuma clínica disponível.</div>}
                </div>
              </div>

              <div className="rounded-[22px] border border-line bg-panel p-5">
                <div className="flex items-center justify-between gap-3"><div><p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-aqua">Governança</p><h3 className="mt-1 font-display text-[18px] font-bold">Atividade recente</h3></div><Link to="/platform/governanca" className="text-[11px] font-semibold text-aqua hover:text-paper">Auditoria →</Link></div>
                <div className="mt-4 space-y-2">
                  {data.audit.slice(0, 6).map((entry) => <div key={entry.id} className="rounded-xl border border-line/70 bg-deep/45 px-3.5 py-3"><div className="flex items-start gap-3"><span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-aqua" /><div className="min-w-0 flex-1"><p className="truncate text-[11.5px] font-semibold text-paper">{auditLabel(entry.action)}</p><p className="mt-0.5 truncate font-mono text-[9.5px] text-fog">{entry.entityType} · {entry.entityKey}</p></div><span className="shrink-0 font-mono text-[9px] text-fog">{formatDate(entry.createdAt)}</span></div></div>)}
                  {!data.audit.length && <div className="rounded-xl border border-dashed border-line p-5 text-center text-[11.5px] text-fog">Sem atividade recente disponível.</div>}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'mint' | 'aqua' | 'amber' | 'fog' }) {
  const toneClass = tone === 'mint' ? 'text-mint' : tone === 'aqua' ? 'text-aqua' : tone === 'amber' ? 'text-amber' : 'text-fog';
  return <article className="rounded-[20px] border border-line bg-panel p-4.5 shadow-[0_10px_30px_rgba(3,16,48,0.035)]"><p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-fog">{label}</p><p className={`mt-2 font-display text-[29px] font-bold tracking-tight ${toneClass}`}>{value}</p><p className="mt-1 text-[10.5px] leading-relaxed text-fog">{detail}</p></article>;
}

function QuickAction({ to, title, sub }: { to: string; title: string; sub: string }) {
  return <Link to={to} className="block rounded-xl border border-line/70 bg-deep/50 p-3.5 transition hover:border-aqua/30 hover:bg-raise/35"><div className="flex items-center gap-3"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-aqua/20 bg-aqua/[0.06] text-aqua">→</div><div className="min-w-0"><p className="text-[11.5px] font-semibold text-paper">{title}</p><p className="mt-0.5 text-[10px] leading-relaxed text-fog">{sub}</p></div></div></Link>;
}
