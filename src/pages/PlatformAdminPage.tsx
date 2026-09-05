import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
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
      className={`relative h-7 w-12 rounded-full border transition-colors disabled:cursor-wait disabled:opacity-60 ${
        enabled ? 'border-mint/60 bg-mint/25' : 'border-line bg-deep'
      }`}
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

  if (loadingAuth) {
    return <div className="app-surface min-h-screen grid place-items-center text-fog">Validando sessão…</div>;
  }

  if (!session) {
    return (
      <div className="app-surface min-h-screen grid place-items-center p-5">
        <form onSubmit={signIn} className="w-full max-w-md rounded-2xl border border-line bg-panel p-7 shadow-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-mint">MedicsPro Platform</p>
          <h1 className="mt-2 font-display text-2xl font-bold">Administração da plataforma</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-fog">Domínio separado da administração interna das clínicas.</p>
          {error && <div className="mt-5 rounded-xl border border-amber/35 bg-amber/5 p-3 text-[12.5px] text-amber">{error}</div>}
          <label className="mt-6 block text-[12px] font-semibold text-paper/80">Email</label>
          <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 outline-none focus:border-mint" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <label className="mt-4 block text-[12px] font-semibold text-paper/80">Senha</label>
          <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 outline-none focus:border-mint" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          <button className="mt-6 w-full rounded-xl bg-mint px-4 py-3 font-display font-semibold text-on-accent disabled:opacity-50" disabled={!email || !password}>Entrar</button>
        </form>
      </div>
    );
  }

  if (loadingData || authorized === null) {
    return <div className="app-surface min-h-screen grid place-items-center text-fog">Validando privilégios da plataforma…</div>;
  }

  if (!authorized) {
    return (
      <div className="app-surface min-h-screen grid place-items-center p-5">
        <div className="w-full max-w-lg rounded-2xl border border-pulse/30 bg-panel p-7">
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
    <div className="app-surface min-h-screen">
      <header className="border-b border-line/70 bg-deep/90 px-5 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mint">MedicsPro Platform Admin</p>
            <h1 className="font-display text-xl font-bold">Governança da plataforma</h1>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[12px] text-fog">{session.user.email}</p>
            <button onClick={() => void platformSupabase.auth.signOut()} className="mt-1 text-[11px] font-semibold text-pulse hover:underline">Encerrar sessão</button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
        <section className="rounded-2xl border border-line bg-panel p-5 md:p-6">
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-aqua">Automação</p>
              <h2 className="mt-1 font-display text-xl font-bold">Controles globais</h2>
              <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-fog">O scheduler do servidor continua ativo. Estes controles governam o que o orquestrador pode executar em cada ciclo.</p>
            </div>
            <button onClick={() => void refresh()} disabled={loadingData} className="ml-auto rounded-xl border border-line px-3 py-2 text-[12px] font-semibold text-fog hover:bg-raise hover:text-paper disabled:opacity-50">Atualizar</button>
          </div>

          {error && <div className="mt-4 rounded-xl border border-amber/35 bg-amber/5 p-3 text-[12.5px] text-amber">{error}</div>}

          <div className="mt-5 divide-y divide-line/60">
            {ORDER.map((key) => {
              const setting = settingMap.get(key);
              const meta = SETTING_META[key];
              if (!setting) return null;
              const dependencyBlocked = (key === 'waitlist.recovery' || key === 'reactivation.auto') && settingMap.get('automation.core_tick')?.enabled === false;
              return (
                <div key={key} className="grid gap-3 py-4 md:grid-cols-[150px_1fr_auto] md:items-center">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog/80">{meta.group}</span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display text-[14px] font-semibold">{meta.title}</p>
                      {dependencyBlocked && <span className="rounded-full border border-amber/30 bg-amber/5 px-2 py-0.5 text-[10px] font-semibold text-amber">dependência pausada</span>}
                    </div>
                    <p className="mt-1 text-[12px] leading-relaxed text-fog">{meta.description}</p>
                    <p className="mt-1 font-mono text-[9.5px] text-fog/60">{key} · atualizado {new Date(setting.updatedAt).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="flex items-center gap-2 md:justify-end">
                    <span className={`text-[11px] font-semibold ${setting.enabled ? 'text-mint' : 'text-fog'}`}>{setting.enabled ? 'Ativo' : 'Pausado'}</span>
                    <Toggle enabled={setting.enabled} disabled={busyKey !== null} onClick={() => void toggle(key)} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5 md:p-6">
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-aqua">Observabilidade</p>
              <h2 className="mt-1 font-display text-xl font-bold">Saúde das automações</h2>
              <p className="mt-1 text-[12.5px] text-fog">Telemetria operacional da plataforma, visível somente no domínio Platform Admin.</p>
            </div>
            {latestRun && (
              <div className="ml-auto rounded-xl border border-line bg-deep px-3 py-2 text-right">
                <p className="font-mono text-[9.5px] uppercase tracking-[0.08em] text-fog">Último ciclo</p>
                <p className="mt-1 text-[12px] font-semibold text-paper">{new Date(latestRun.startedAt).toLocaleString('pt-BR')}</p>
              </div>
            )}
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-line bg-deep p-4">
              <p className="text-[10px] uppercase tracking-[0.08em] text-fog">Execuções carregadas</p>
              <p className="mt-2 font-display text-2xl font-bold">{runs.length}</p>
            </div>
            <div className="rounded-xl border border-line bg-deep p-4">
              <p className="text-[10px] uppercase tracking-[0.08em] text-fog">Com falha</p>
              <p className={`mt-2 font-display text-2xl font-bold ${failedRuns.length > 0 ? 'text-pulse' : 'text-mint'}`}>{failedRuns.length}</p>
            </div>
            <div className="rounded-xl border border-line bg-deep p-4">
              <p className="text-[10px] uppercase tracking-[0.08em] text-fog">Clínicas no último ciclo</p>
              <p className="mt-2 font-display text-2xl font-bold">{latestRun?.clinicsProcessed ?? 0}</p>
            </div>
          </div>

          <div className="mt-5 overflow-x-auto rounded-xl border border-line/70">
            <table className="min-w-full text-left text-[11px]">
              <thead className="bg-deep text-fog">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Início</th>
                  <th className="px-3 py-2.5 font-semibold">Status</th>
                  <th className="px-3 py-2.5 font-semibold">Trigger</th>
                  <th className="px-3 py-2.5 font-semibold">Clínicas</th>
                  <th className="px-3 py-2.5 font-semibold">WA enviados</th>
                  <th className="px-3 py-2.5 font-semibold">Falhas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line/60 bg-panel/40">
                {runs.length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-fog">Nenhuma execução recente disponível.</td></tr>
                ) : runs.map((run) => (
                  <tr key={run.id}>
                    <td className="px-3 py-3 font-mono text-[10px] text-fog">{new Date(run.startedAt).toLocaleString('pt-BR')}</td>
                    <td className="px-3 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${runStatusClass(run.status)}`}>{run.status}</span></td>
                    <td className="px-3 py-3 text-fog">{run.triggerSource}</td>
                    <td className="px-3 py-3 text-paper">{run.clinicsProcessed}</td>
                    <td className="px-3 py-3 text-paper">{run.workerSent}</td>
                    <td className={`px-3 py-3 font-semibold ${run.workerFailed > 0 ? 'text-pulse' : 'text-mint'}`}>{run.workerFailed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {failedRuns.some((run) => run.errorMessage) && (
            <div className="mt-4 rounded-xl border border-pulse/25 bg-pulse/[0.04] p-3">
              <p className="text-[11.5px] font-semibold text-pulse">Falhas recentes registradas</p>
              <div className="mt-2 space-y-1.5">
                {failedRuns.filter((run) => run.errorMessage).slice(0, 3).map((run) => (
                  <p key={run.id} className="font-mono text-[10px] text-fog">{new Date(run.startedAt).toLocaleString('pt-BR')} · {run.errorMessage}</p>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5 md:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-aqua">Auditoria</p>
            <h2 className="mt-1 font-display text-xl font-bold">Mudanças de governança</h2>
            <p className="mt-1 text-[12.5px] text-fog">Registro append-only das alterações feitas neste domínio administrativo.</p>
          </div>
          <div className="mt-5 divide-y divide-line/60">
            {audit.length === 0 ? (
              <p className="py-6 text-[12.5px] text-fog">Nenhuma alteração registrada.</p>
            ) : audit.map((entry) => (
              <div key={entry.id} className="grid gap-1 py-3 md:grid-cols-[170px_1fr]">
                <span className="font-mono text-[10px] text-fog">{new Date(entry.createdAt).toLocaleString('pt-BR')}</span>
                <div>
                  <p className="text-[12.5px] font-semibold">{entry.entityKey}</p>
                  <p className="mt-0.5 text-[11px] text-fog">{entry.action} · {JSON.stringify(entry.detail)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
