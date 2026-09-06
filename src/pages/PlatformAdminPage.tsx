import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { PlatformAdminShell } from '../components/PlatformAdminShell';
import { platformSupabase } from '../lib/platformSupabaseClient';
import {
  loadPlatformAuditLog,
  loadPlatformAutomationRuns,
  loadPlatformAutomationSettings,
  setPlatformAutomationSetting,
  type PlatformAuditEntry,
  type PlatformAutomationKey,
  type PlatformAutomationRun,
  type PlatformAutomationSetting,
} from '../lib/platformAdmin';
import { getCachedPlatformAdminAccess, validatePlatformAdminAccess } from '../lib/platformAdminAccess';

const SETTING_META: Record<PlatformAutomationKey, { title: string; description: string; group: string; critical?: boolean }> = {
  'automation.enabled': { title: 'Automação global', description: 'Chave-mestra do orquestrador da plataforma.', group: 'Orquestração', critical: true },
  'finance.overdue': { title: 'Marcação de pagamentos atrasados', description: 'Atualiza recebíveis vencidos antes das demais automações.', group: 'Financeiro' },
  'automation.core_tick': { title: 'Ciclo operacional principal', description: 'Executa confirmações/NPS e encadeia rotinas operacionais.', group: 'Comunicação' },
  'waitlist.recovery': { title: 'Recuperação da fila de espera', description: 'Tenta reaproveitar vagas canceladas conforme regras existentes.', group: 'Comunicação' },
  'reactivation.auto': { title: 'Reativação automática', description: 'Enfileira reativações elegíveis usando o outbox de WhatsApp.', group: 'Comunicação' },
  'evolution.worker': { title: 'Evolution Worker', description: 'Processa wa_logs e envia mensagens pelo provedor configurado.', group: 'Mensageria', critical: true },
  'nexus.self_assessment_processor': { title: 'Nexus · autoavaliações', description: 'Processa PHQ-9/GAD-7 e gera resultados clínicos e red flags quando aplicável.', group: 'Nexus' },
};

const ORDER: PlatformAutomationKey[] = [
  'automation.enabled', 'finance.overdue', 'automation.core_tick', 'waitlist.recovery', 'reactivation.auto', 'evolution.worker', 'nexus.self_assessment_processor',
];

const AUDIT_STEP = 10;

function Toggle({ enabled, disabled, onClick }: { enabled: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={enabled} disabled={disabled} onClick={onClick} className={`relative h-7 w-12 rounded-full border transition disabled:cursor-wait disabled:opacity-60 ${enabled ? 'border-mint/60 bg-mint/25' : 'border-line bg-deep'}`}>
      <span className={`absolute top-1 h-5 w-5 rounded-full transition-all ${enabled ? 'left-6 bg-mint' : 'left-1 bg-fog/70'}`} />
    </button>
  );
}

function runStatusClass(status: string) {
  const value = status.toLowerCase();
  if (value === 'success' || value === 'completed') return 'border-mint/35 bg-mint/10 text-mint';
  if (value === 'failed' || value === 'error') return 'border-pulse/35 bg-pulse/10 text-pulse';
  if (value === 'running' || value === 'processing') return 'border-aqua/35 bg-aqua/10 text-aqua';
  return 'border-line bg-deep text-fog';
}

function auditTitle(action: string) {
  return action.split('.').join(' · ');
}

export function PlatformAdminPage() {
  const cachedAccess = getCachedPlatformAdminAccess();
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(cachedAccess === null);
  const [authorized, setAuthorized] = useState<boolean | null>(cachedAccess);
  const [settings, setSettings] = useState<PlatformAutomationSetting[]>([]);
  const [runs, setRuns] = useState<PlatformAutomationRun[]>([]);
  const [audit, setAudit] = useState<PlatformAuditEntry[]>([]);
  const [auditLimit, setAuditLimit] = useState(AUDIT_STEP);
  const [loadingData, setLoadingData] = useState(false);
  const [loadingMoreAudit, setLoadingMoreAudit] = useState(false);
  const [busyKey, setBusyKey] = useState<PlatformAutomationKey | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (nextAuditLimit = AUDIT_STEP) => {
    setLoadingData(true);
    setError(null);
    try {
      const allowed = await validatePlatformAdminAccess();
      setAuthorized(allowed);
      if (!allowed) {
        setSettings([]); setRuns([]); setAudit([]);
        return;
      }
      const [nextSettings, nextRuns, nextAudit] = await Promise.all([
        loadPlatformAutomationSettings(),
        loadPlatformAutomationRuns(12),
        loadPlatformAuditLog(nextAuditLimit),
      ]);
      setSettings(nextSettings);
      setRuns(nextRuns);
      setAudit(nextAudit);
      setAuditLimit(nextAuditLimit);
    } catch (cause) {
      console.error('[Platform Admin] governance load:', cause);
      setError('Não foi possível carregar a governança da plataforma.');
    } finally {
      setLoadingData(false);
    }
  }, []);

  const loadMoreAudit = async () => {
    const nextLimit = auditLimit + AUDIT_STEP;
    setLoadingMoreAudit(true);
    try {
      const nextAudit = await loadPlatformAuditLog(nextLimit);
      setAudit(nextAudit);
      setAuditLimit(nextLimit);
    } catch (cause) {
      console.error('[Platform Admin] audit pagination:', cause);
      setError('Não foi possível carregar mais registros de auditoria.');
    } finally {
      setLoadingMoreAudit(false);
    }
  };

  useEffect(() => {
    let active = true;
    void platformSupabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoadingAuth(false);
    });
    const { data: listener } = platformSupabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (!nextSession) setAuthorized(null);
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!session) {
      if (authorized !== true) {
        setAuthorized(null); setSettings([]); setRuns([]); setAudit([]);
      }
      return;
    }
    void refresh(AUDIT_STEP);
  }, [session?.user.id, refresh]);

  const settingMap = useMemo(() => new Map(settings.map((item) => [item.key, item])), [settings]);
  const latestRun = runs[0] ?? null;
  const failedRuns = useMemo(() => runs.filter((run) => run.workerFailed > 0 || ['failed', 'error'].includes(run.status.toLowerCase())), [runs]);
  const activeAutomations = settings.filter((setting) => setting.enabled).length;
  const pausedAutomations = settings.length - activeAutomations;
  const masterEnabled = settingMap.get('automation.enabled')?.enabled !== false;
  const healthPercent = settings.length ? Math.round((activeAutomations / settings.length) * 100) : 0;
  const healthy = masterEnabled && failedRuns.length === 0;

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const { error: signInError } = await platformSupabase.auth.signInWithPassword({ email, password });
    if (signInError) setError(signInError.message);
  };

  const toggle = async (key: PlatformAutomationKey) => {
    const current = settingMap.get(key);
    if (!current || busyKey) return;
    const next = !current.enabled;
    const meta = SETTING_META[key];
    if (meta.critical && !next && !window.confirm(`Desativar “${meta.title}”? A mudança afeta a plataforma inteira.`)) return;
    setBusyKey(key);
    setError(null);
    try {
      const updated = await setPlatformAutomationSetting(key, next);
      setSettings((items) => items.map((item) => item.key === key ? updated : item));
      setAudit(await loadPlatformAuditLog(AUDIT_STEP));
      setAuditLimit(AUDIT_STEP);
    } catch (cause) {
      console.error('[Platform Admin] setting:', cause);
      setError('Não foi possível alterar a configuração.');
    } finally {
      setBusyKey(null);
    }
  };

  if (loadingAuth && authorized !== true) return <div className="app-surface min-h-screen grid place-items-center text-fog">Validando sessão…</div>;

  if (!session && authorized !== true) {
    return (
      <div className="app-surface min-h-screen grid place-items-center p-5">
        <form onSubmit={signIn} className="w-full max-w-md overflow-hidden rounded-[28px] border border-line bg-panel shadow-[0_28px_90px_rgba(3,16,48,0.13)]">
          <div className="border-b border-line/70 bg-gradient-to-br from-mint/[0.10] via-panel to-panel px-7 py-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-mint">MedicsPro Platform</p>
            <h1 className="mt-2 font-display text-[27px] font-bold tracking-tight">Governança da plataforma</h1>
            <p className="mt-2 text-[13px] leading-relaxed text-fog">Domínio separado da administração interna das clínicas.</p>
          </div>
          <div className="p-7">
            {error && <div className="mb-5 rounded-xl border border-amber/35 bg-amber/[0.05] p-3 text-[12.5px] text-amber">{error}</div>}
            <label className="block text-[12px] font-semibold text-paper/80">Email</label>
            <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 outline-none focus:border-mint" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label className="mt-4 block text-[12px] font-semibold text-paper/80">Senha</label>
            <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 outline-none focus:border-mint" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button className="mt-6 w-full rounded-xl bg-mint px-4 py-3.5 font-display font-semibold text-on-accent" disabled={!email || !password}>Entrar na governança</button>
          </div>
        </form>
      </div>
    );
  }

  if (authorized === null) return <div className="app-surface min-h-screen grid place-items-center text-fog">Validando privilégios da plataforma…</div>;
  if (!authorized) return <div className="app-surface min-h-screen grid place-items-center p-5"><div className="w-full max-w-lg rounded-[24px] border border-pulse/30 bg-panel p-7"><p className="text-pulse">Acesso negado</p><h1 className="mt-2 font-display text-2xl font-bold">Esta conta não é Platform Admin</h1></div></div>;

  return (
    <PlatformAdminShell eyebrow="MedicsPro Platform Admin" title="Governança" description="Controle automações, acompanhe a saúde operacional e revise mudanças administrativas sem transformar a tela em um log infinito." actions={<button onClick={() => void refresh(AUDIT_STEP)} disabled={loadingData} className="rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[11px] font-semibold text-fog hover:border-mint/35 hover:text-paper disabled:opacity-50">Atualizar dados</button>}>
      {error && <div className="rounded-[16px] border border-amber/35 bg-amber/[0.05] px-4 py-3 text-[12px] text-amber">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[1.5fr_0.5fr]">
        <div className="relative overflow-hidden rounded-[26px] border border-mint/20 bg-gradient-to-br from-mint/[0.12] via-panel to-panel p-6 md:p-7">
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-aqua/[0.08] blur-3xl" />
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">Controle operacional</p>
          <h2 className="mt-2 max-w-4xl font-display text-[29px] font-bold leading-tight tracking-tight md:text-[35px]">Saúde, automação e rastreabilidade em uma leitura executiva.</h2>
          <p className="mt-3 max-w-3xl text-[12.5px] leading-relaxed text-fog">A plataforma mostra o que está ativo, o que falhou e o que mudou — com histórico sob demanda, sem carregar centenas de eventos na primeira renderização.</p>
        </div>
        <div className="rounded-[26px] border border-line bg-panel p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog">Estado geral</p>
          <p className={`mt-2 font-display text-[26px] font-bold ${healthy ? 'text-mint' : 'text-amber'}`}>{healthy ? 'Saudável' : 'Atenção'}</p>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-deep"><div className={`h-full rounded-full ${healthy ? 'bg-mint' : 'bg-amber'}`} style={{ width: `${healthPercent}%` }} /></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><MiniMetric label="Ativas" value={String(activeAutomations)} /><MiniMetric label="Pausadas" value={String(pausedAutomations)} /></div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GovernanceMetric label="Orquestrador" value={masterEnabled ? 'Ativo' : 'Pausado'} detail="chave-mestra" tone={masterEnabled ? 'mint' : 'amber'} />
        <GovernanceMetric label="Automações" value={String(activeAutomations)} detail={`${pausedAutomations} pausada(s)`} tone="aqua" />
        <GovernanceMetric label="Falhas recentes" value={String(failedRuns.length)} detail={`últimas ${runs.length} execuções`} tone={failedRuns.length ? 'pulse' : 'mint'} />
        <GovernanceMetric label="Último ciclo" value={`${latestRun?.clinicsProcessed ?? 0} clínicas`} detail={latestRun ? new Date(latestRun.startedAt).toLocaleString('pt-BR') : 'sem execução'} tone="fog" />
      </section>

      <section className="rounded-[24px] border border-line bg-panel p-5 md:p-6">
        <div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-aqua">Automações</p><h2 className="mt-1 font-display text-[20px] font-bold">Controles globais</h2><p className="mt-1 text-[11.5px] text-fog">Mudanças críticas continuam exigindo confirmação explícita.</p></div><span className="rounded-full border border-line bg-deep px-3 py-1.5 text-[10px] font-semibold text-fog">{activeAutomations}/{settings.length} ativas</span></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {ORDER.map((key) => {
            const setting = settingMap.get(key);
            const meta = SETTING_META[key];
            if (!setting) return null;
            const blocked = (key === 'waitlist.recovery' || key === 'reactivation.auto') && settingMap.get('automation.core_tick')?.enabled === false;
            return <article key={key} className="rounded-[18px] border border-line/70 bg-deep/35 p-4"><div className="flex items-start gap-3"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-display text-[14px] font-semibold">{meta.title}</p>{meta.critical && <span className="rounded-full border border-pulse/25 bg-pulse/[0.05] px-2 py-0.5 text-[9px] font-semibold text-pulse">crítico</span>}{blocked && <span className="rounded-full border border-amber/30 px-2 py-0.5 text-[9px] font-semibold text-amber">dependência pausada</span>}</div><p className="mt-1 text-[11px] leading-relaxed text-fog">{meta.description}</p><p className="mt-3 text-[9.5px] uppercase tracking-[0.1em] text-aqua">{meta.group}</p></div><Toggle enabled={setting.enabled} disabled={busyKey !== null} onClick={() => void toggle(key)} /></div></article>;
          })}
        </div>
      </section>

      <section className="grid gap-4 2xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-[24px] border border-line bg-panel p-5 md:p-6">
          <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-aqua">Observabilidade</p><h2 className="mt-1 font-display text-[20px] font-bold">Execuções recentes</h2></div>{latestRun && <span className={`rounded-full border px-2.5 py-1 text-[9.5px] font-semibold ${runStatusClass(latestRun.status)}`}>{latestRun.status}</span>}</div>
          <div className="mt-4 overflow-x-auto rounded-[16px] border border-line/70"><table className="min-w-[760px] w-full text-left text-[10.5px]"><thead className="bg-deep text-fog"><tr><th className="px-3 py-3">Início</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Trigger</th><th className="px-3 py-3">Clínicas</th><th className="px-3 py-3">WA</th><th className="px-3 py-3">Falhas</th></tr></thead><tbody className="divide-y divide-line/60">{runs.map((run) => <tr key={run.id}><td className="px-3 py-3 text-fog">{new Date(run.startedAt).toLocaleString('pt-BR')}</td><td className="px-3 py-3"><span className={`rounded-full border px-2 py-0.5 text-[9px] font-semibold ${runStatusClass(run.status)}`}>{run.status}</span></td><td className="px-3 py-3 text-fog">{run.triggerSource}</td><td className="px-3 py-3">{run.clinicsProcessed}</td><td className="px-3 py-3">{run.workerSent}</td><td className={`px-3 py-3 font-semibold ${run.workerFailed ? 'text-pulse' : 'text-mint'}`}>{run.workerFailed}</td></tr>)}{!runs.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-fog">Sem execuções recentes.</td></tr>}</tbody></table></div>
        </div>

        <div className="rounded-[24px] border border-line bg-panel p-5 md:p-6">
          <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-amber">Auditoria</p><h2 className="mt-1 font-display text-[20px] font-bold">Mudanças de governança</h2><p className="mt-1 text-[11px] text-fog">Carregadas em blocos de {AUDIT_STEP} para preservar desempenho e legibilidade.</p></div><span className="rounded-full border border-line bg-deep px-2.5 py-1 text-[9.5px] text-fog">{audit.length} exibidas</span></div>
          <div className="mt-4 space-y-2.5">{audit.map((entry) => <article key={entry.id} className="rounded-[16px] border border-line/70 bg-deep/35 p-3.5"><div className="flex items-start gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-aqua" /><div className="min-w-0 flex-1"><p className="truncate text-[11.5px] font-semibold">{auditTitle(entry.action)}</p><p className="mt-1 truncate text-[9.5px] text-fog">{entry.entityType} · {entry.entityKey}</p><p className="mt-2 text-[9px] text-fog">{new Date(entry.createdAt).toLocaleString('pt-BR')}</p></div></div></article>)}{!audit.length && <div className="rounded-xl border border-dashed border-line p-6 text-center text-fog">Nenhuma mudança registrada.</div>}</div>
          {audit.length >= auditLimit && <button type="button" onClick={() => void loadMoreAudit()} disabled={loadingMoreAudit} className="mt-4 w-full rounded-xl border border-line bg-deep px-4 py-3 text-[11px] font-semibold text-paper transition hover:border-aqua/35 disabled:opacity-50">{loadingMoreAudit ? 'Carregando…' : `Carregar mais ${AUDIT_STEP}`}</button>}
        </div>
      </section>
    </PlatformAdminShell>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-deep/55 p-3"><p className="text-[9.5px] text-fog">{label}</p><p className="mt-1 font-display text-[18px] font-bold">{value}</p></div>;
}

function GovernanceMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'mint' | 'aqua' | 'amber' | 'pulse' | 'fog' }) {
  const toneClass = tone === 'mint' ? 'text-mint' : tone === 'aqua' ? 'text-aqua' : tone === 'amber' ? 'text-amber' : tone === 'pulse' ? 'text-pulse' : 'text-fog';
  return <article className="rounded-[20px] border border-line bg-panel p-4"><p className="text-[10px] font-semibold text-fog">{label}</p><p className={`mt-2 font-display text-[24px] font-bold ${toneClass}`}>{value}</p><p className="mt-1 text-[10.5px] text-fog">{detail}</p></article>;
}
