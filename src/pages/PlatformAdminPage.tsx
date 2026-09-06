import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { PlatformAdminShell } from '../components/PlatformAdminShell';
import { platformSupabase } from '../lib/platformSupabaseClient';
import {
  isPlatformAdmin,
  loadPlatformAuditLog,
  loadPlatformAutomationRuns,
  loadPlatformAutomationSettings,
  setPlatformAutomationSetting,
  type PlatformAuditEntry,
  type PlatformAutomationKey,
  type PlatformAutomationRun,
  type PlatformAutomationSetting,
} from '../lib/platformAdmin';

const SETTING_META: Record<PlatformAutomationKey, { title: string; description: string; group: string; critical?: boolean }> = {
  'automation.enabled': {
    title: 'Automação global',
    description: 'Chave-mestra do orquestrador. Desligar pausa os ciclos de negócio sem remover o scheduler do servidor.',
    group: 'Orquestração',
    critical: true,
  },
  'finance.overdue': {
    title: 'Marcação de pagamentos atrasados',
    description: 'Atualiza recebíveis vencidos antes das demais automações.',
    group: 'Financeiro',
  },
  'automation.core_tick': {
    title: 'Ciclo operacional principal',
    description: 'Executa confirmações/NPS e cria o run que encadeia recuperação de agenda e reativação.',
    group: 'Comunicação',
  },
  'waitlist.recovery': {
    title: 'Recuperação da fila de espera',
    description: 'Tenta reaproveitar vagas canceladas conforme as regras operacionais existentes.',
    group: 'Comunicação',
  },
  'reactivation.auto': {
    title: 'Reativação automática',
    description: 'Enfileira reativações elegíveis usando o outbox canônico de WhatsApp.',
    group: 'Comunicação',
  },
  'evolution.worker': {
    title: 'Evolution Worker',
    description: 'Processa a fila wa_logs e envia mensagens pelo provedor configurado.',
    group: 'Mensageria',
    critical: true,
  },
  'nexus.self_assessment_processor': {
    title: 'Nexus · processor de autoavaliações',
    description: 'Transforma submissões PHQ-9/GAD-7 em resultados clínicos finalizados e red flags quando aplicável.',
    group: 'Nexus',
  },
};

const ORDER: PlatformAutomationKey[] = [
  'automation.enabled',
  'finance.overdue',
  'automation.core_tick',
  'waitlist.recovery',
  'reactivation.auto',
  'evolution.worker',
  'nexus.self_assessment_processor',
];

function Toggle({ enabled, disabled, onClick }: { enabled: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      disabled={disabled}
      onClick={onClick}
      className={`relative h-7 w-12 rounded-full border transition-colors disabled:cursor-wait disabled:opacity-60 ${enabled ? 'border-mint/60 bg-mint/25' : 'border-line bg-deep'}`}
    >
      <span className={`absolute top-1 h-5 w-5 rounded-full transition-all ${enabled ? 'left-6 bg-mint' : 'left-1 bg-fog/70'}`} />
    </button>
  );
}

function runStatusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'success' || normalized === 'completed') return 'border-mint/35 bg-mint/10 text-mint';
  if (normalized === 'failed' || normalized === 'error') return 'border-pulse/35 bg-pulse/10 text-pulse';
  if (normalized === 'running' || normalized === 'processing') return 'border-aqua/35 bg-aqua/10 text-aqua';
  return 'border-line bg-deep text-fog';
}

export function PlatformAdminPage() {
  const [session, setSession] = useState<Session | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [settings, setSettings] = useState<PlatformAutomationSetting[]>([]);
  const [runs, setRuns] = useState<PlatformAutomationRun[]>([]);
  const [audit, setAudit] = useState<PlatformAuditEntry[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [busyKey, setBusyKey] = useState<PlatformAutomationKey | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      const allowed = await isPlatformAdmin();
      setAuthorized(allowed);
      if (!allowed) {
        setSettings([]);
        setRuns([]);
        setAudit([]);
        return;
      }
      const [nextSettings, nextRuns, nextAudit] = await Promise.all([
        loadPlatformAutomationSettings(),
        loadPlatformAutomationRuns(20),
        loadPlatformAuditLog(40),
      ]);
      setSettings(nextSettings);
      setRuns(nextRuns);
      setAudit(nextAudit);
    } catch (cause) {
      console.error('[Platform Admin] load:', cause);
      setAuthorized(false);
      setError('Não foi possível validar a administração da plataforma.');
    } finally {
      setLoadingData(false);
    }
  }, []);

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
      setAuthorized(null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session) {
      setAuthorized(null);
      setSettings([]);
      setRuns([]);
      setAudit([]);
      return;
    }
    void refresh();
  }, [session?.user.id, refresh]);

  const settingMap = useMemo(() => new Map(settings.map((item) => [item.key, item])), [settings]);
  const latestRun = runs[0] ?? null;
  const failedRuns = useMemo(() => runs.filter((run) => run.workerFailed > 0 || ['failed', 'error'].includes(run.status.toLowerCase())), [runs]);
  const activeAutomations = settings.filter((setting) => setting.enabled).length;
  const pausedAutomations = settings.length - activeAutomations;
  const masterEnabled = settingMap.get('automation.enabled')?.enabled !== false;
  const healthPercent = settings.length ? Math.round((activeAutomations / settings.length) * 100) : 0;

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
      setAudit(await loadPlatformAuditLog(40));
    } catch (cause) {
      console.error('[Platform Admin] setting:', cause);
      setError('Não foi possível alterar a configuração. Nenhuma permissão é concedida pela interface.');
    } finally {
      setBusyKey(null);
    }
  };

  if (loadingAuth) return <div className="app-surface min-h-screen grid place-items-center text-fog">Validando sessão…</div>;

  if (!session) {
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
            <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 outline-none transition focus:border-mint" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            <label className="mt-4 block text-[12px] font-semibold text-paper/80">Senha</label>
            <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 outline-none transition focus:border-mint" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            <button className="mt-6 w-full rounded-xl bg-mint px-4 py-3.5 font-display font-semibold text-on-accent shadow-sm disabled:opacity-50" disabled={!email || !password}>Entrar na governança</button>
          </div>
        </form>
      </div>
    );
  }

  if (loadingData || authorized === null) return <div className="app-surface min-h-screen grid place-items-center text-fog">Validando privilégios da plataforma…</div>;

  if (!authorized) {
    return (
      <div className="app-surface min-h-screen grid place-items-center p-5">
        <div className="w-full max-w-lg rounded-[24px] border border-pulse/30 bg-panel p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pulse">Acesso negado</p>
          <h1 className="mt-2 font-display text-2xl font-bold">Esta conta não é Platform Admin</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-fog">Ter perfil owner/admin em uma clínica não concede administração do SaaS.</p>
          {error && <p className="mt-3 text-[12px] text-amber">{error}</p>}
          <button onClick={() => void platformSupabase.auth.signOut()} className="mt-6 rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-fog hover:text-paper">Sair</button>
        </div>
      </div>
    );
  }

  return (
    <PlatformAdminShell
      eyebrow="MedicsPro Platform Admin"
      title="Governança"
      description="Controle automações, acompanhe a saúde operacional e revise cada mudança administrativa em uma visão executiva única."
      actions={(
        <button onClick={() => void refresh()} disabled={loadingData} className="rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[11px] font-semibold text-fog transition hover:border-mint/35 hover:text-paper disabled:opacity-50">
          {loadingData ? 'Atualizando…' : 'Atualizar dados'}
        </button>
      )}
    >
      {error && <div className="rounded-[16px] border border-amber/35 bg-amber/[0.05] px-4 py-3 text-[12px] text-amber">{error}</div>}

      <section className="grid gap-4 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="relative overflow-hidden rounded-[26px] border border-mint/20 bg-gradient-to-br from-mint/[0.10] via-panel to-panel p-6 md:p-7">
          <div className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full bg-mint/[0.08] blur-3xl" />
          <div className="relative">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">Controle operacional</p>
            <h2 className="mt-2 max-w-3xl font-display text-[27px] font-bold leading-tight tracking-tight md:text-[32px]">Saúde da plataforma sem perder rastreabilidade.</h2>
            <p className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-fog">Acompanhe orquestração, mensageria, automações Nexus e execução recente sem misturar este domínio com permissões internas das clínicas.</p>
          </div>
        </div>

        <div className="rounded-[26px] border border-line bg-panel p-5 shadow-[0_14px_36px_rgba(3,16,48,0.04)]">
          <div className="flex items-start justify-between gap-3">
            <div><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog">Estado geral</p><p className={`mt-2 font-display text-[25px] font-bold ${masterEnabled && failedRuns.length === 0 ? 'text-mint' : 'text-amber'}`}>{masterEnabled && failedRuns.length === 0 ? 'Saudável' : 'Atenção'}</p></div>
            <span className={`grid h-10 w-10 place-items-center rounded-full border ${masterEnabled && failedRuns.length === 0 ? 'border-mint/25 bg-mint/[0.08] text-mint' : 'border-amber/25 bg-amber/[0.08] text-amber'}`}>{masterEnabled && failedRuns.length === 0 ? '✓' : '!'}</span>
          </div>
          <div className="mt-5 h-2 overflow-hidden rounded-full bg-deep"><div className="h-full rounded-full bg-mint" style={{ width: `${healthPercent}%` }} /></div>
          <div className="mt-4 grid grid-cols-2 gap-3"><MiniMetric label="Ativas" value={String(activeAutomations)} /><MiniMetric label="Pausadas" value={String(pausedAutomations)} /></div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <GovernanceMetric label="Orquestrador" value={masterEnabled ? 'Ativo' : 'Pausado'} detail="chave-mestra operacional" tone={masterEnabled ? 'mint' : 'amber'} />
        <GovernanceMetric label="Automações" value={String(activeAutomations)} detail={`${pausedAutomations} pausada(s)`} tone="aqua" />
        <GovernanceMetric label="Falhas recentes" value={String(failedRuns.length)} detail={`entre ${runs.length} execuções carregadas`} tone={failedRuns.length ? 'pulse' : 'mint'} />
        <GovernanceMetric label="Último ciclo" value={`${latestRun?.clinicsProcessed ?? 0} clínicas`} detail={latestRun ? new Date(latestRun.startedAt).toLocaleString('pt-BR') : 'sem execução recente'} tone="fog" />
      </section>

      <section className="rounded-[24px] border border-line bg-panel p-5 md:p-6 shadow-[0_12px_32px_rgba(3,16,48,0.03)]">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-aqua">Automações</p><h2 className="mt-1 font-display text-[19px] font-bold">Controles globais</h2><p className="mt-1 max-w-3xl text-[11.5px] leading-relaxed text-fog">O scheduler do servidor permanece ativo. Estes controles definem o que o orquestrador pode executar em cada ciclo.</p></div>
          <div className="rounded-full border border-line bg-deep/45 px-3 py-1.5 text-[10px] font-semibold text-fog">{settings.length} controles</div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {ORDER.map((key) => {
            const setting = settingMap.get(key);
            const meta = SETTING_META[key];
            if (!setting) return null;
            const dependencyBlocked = (key === 'waitlist.recovery' || key === 'reactivation.auto') && settingMap.get('automation.core_tick')?.enabled === false;
            return (
              <article key={key} className={`rounded-[18px] border p-4 ${setting.enabled ? 'border-line/70 bg-deep/38' : 'border-amber/20 bg-amber/[0.025]'}`}>
                <div className="flex items-start gap-3">
                  <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-[12px] ${setting.enabled ? 'border-mint/20 bg-mint/[0.06] text-mint' : 'border-line bg-panel text-fog'}`}>{setting.enabled ? '✓' : '‖'}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><p className="font-display text-[13.5px] font-semibold">{meta.title}</p>{meta.critical && <span className="rounded-full border border-pulse/20 bg-pulse/[0.04] px-2 py-0.5 text-[9px] font-semibold text-pulse">crítico</span>}{dependencyBlocked && <span className="rounded-full border border-amber/25 bg-amber/[0.05] px-2 py-0.5 text-[9px] font-semibold text-amber">dependência pausada</span>}</div>
                    <p className="mt-1 text-[11px] leading-relaxed text-fog">{meta.description}</p>
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-line/55 pt-3"><span className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-fog">{meta.group}</span><div className="flex items-center gap-2"><span className={`text-[10.5px] font-semibold ${setting.enabled ? 'text-mint' : 'text-fog'}`}>{setting.enabled ? 'Ativo' : 'Pausado'}</span><Toggle enabled={setting.enabled} disabled={busyKey !== null} onClick={() => void toggle(key)} /></div></div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-[24px] border border-line bg-panel p-5 md:p-6">
          <div className="flex flex-wrap items-start gap-3"><div className="min-w-0 flex-1"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-aqua">Observabilidade</p><h2 className="mt-1 font-display text-[19px] font-bold">Execuções recentes</h2><p className="mt-1 text-[11.5px] text-fog">Telemetria operacional do domínio Platform Admin.</p></div>{latestRun && <span className={`rounded-full border px-2.5 py-1 text-[9.5px] font-semibold ${runStatusClass(latestRun.status)}`}>{latestRun.status}</span>}</div>
          <div className="mt-5 overflow-x-auto rounded-[18px] border border-line/70">
            <table className="min-w-full text-left text-[10.5px]">
              <thead className="bg-deep/75 text-fog"><tr><th className="px-3 py-3 font-semibold">Início</th><th className="px-3 py-3 font-semibold">Status</th><th className="px-3 py-3 font-semibold">Trigger</th><th className="px-3 py-3 font-semibold">Clínicas</th><th className="px-3 py-3 font-semibold">WA</th><th className="px-3 py-3 font-semibold">Falhas</th></tr></thead>
              <tbody className="divide-y divide-line/60 bg-panel/40">
                {runs.length === 0 ? <tr><td colSpan={6} className="px-3 py-7 text-center text-fog">Nenhuma execução recente disponível.</td></tr> : runs.map((run) => <tr key={run.id} className="transition hover:bg-deep/35"><td className="px-3 py-3 text-fog">{new Date(run.startedAt).toLocaleString('pt-BR')}</td><td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${runStatusClass(run.status)}`}>{run.status}</span></td><td className="px-3 py-3 text-fog">{run.triggerSource}</td><td className="px-3 py-3 text-paper">{run.clinicsProcessed}</td><td className="px-3 py-3 text-paper">{run.workerSent}</td><td className={`px-3 py-3 font-semibold ${run.workerFailed > 0 ? 'text-pulse' : 'text-mint'}`}>{run.workerFailed}</td></tr>)}
              </tbody>
            </table>
          </div>
          {failedRuns.some((run) => run.errorMessage) && <div className="mt-4 rounded-[16px] border border-pulse/25 bg-pulse/[0.04] p-3"><p className="text-[11px] font-semibold text-pulse">Falhas recentes registradas</p><div className="mt-2 space-y-1.5">{failedRuns.filter((run) => run.errorMessage).slice(0, 3).map((run) => <p key={run.id} className="text-[9.5px] text-fog">{new Date(run.startedAt).toLocaleString('pt-BR')} · {run.errorMessage}</p>)}</div></div>}
        </div>

        <div className="rounded-[24px] border border-line bg-panel p-5 md:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-aqua">Auditoria</p>
          <h2 className="mt-1 font-display text-[19px] font-bold">Mudanças de governança</h2>
          <p className="mt-1 text-[11.5px] text-fog">Registro append-only das ações administrativas recentes.</p>
          <div className="mt-5 space-y-2.5">
            {audit.length === 0 ? <div className="rounded-[16px] border border-dashed border-line p-6 text-center text-[11.5px] text-fog">Nenhuma alteração registrada.</div> : audit.slice(0, 12).map((entry) => <div key={entry.id} className="rounded-[16px] border border-line/65 bg-deep/38 p-3.5"><div className="flex items-start gap-3"><span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-aqua" /><div className="min-w-0 flex-1"><p className="truncate text-[11.5px] font-semibold">{entry.entityKey}</p><p className="mt-1 break-words text-[10px] leading-relaxed text-fog">{entry.action} · {JSON.stringify(entry.detail)}</p><p className="mt-2 text-[9px] text-fog/70">{new Date(entry.createdAt).toLocaleString('pt-BR')}</p></div></div></div>)}
          </div>
        </div>
      </section>
    </PlatformAdminShell>
  );
}

function GovernanceMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'mint' | 'aqua' | 'amber' | 'pulse' | 'fog' }) {
  const toneClass = tone === 'mint' ? 'text-mint' : tone === 'aqua' ? 'text-aqua' : tone === 'amber' ? 'text-amber' : tone === 'pulse' ? 'text-pulse' : 'text-paper';
  return <div className="rounded-[20px] border border-line bg-panel p-4.5"><p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-fog">{label}</p><p className={`mt-2 font-display text-[22px] font-bold tracking-tight ${toneClass}`}>{value}</p><p className="mt-1 text-[10.5px] leading-relaxed text-fog">{detail}</p></div>;
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-[14px] border border-line/70 bg-deep/45 p-3"><p className="text-[9.5px] text-fog">{label}</p><p className="mt-1 font-display text-[17px] font-bold">{value}</p></div>;
}
