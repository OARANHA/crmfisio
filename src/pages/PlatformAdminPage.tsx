import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Btn, Card, CardHead, Field, Input } from '../lib/ui';

type PlatformContext = {
  actor: { id: string; email: string };
  summary: { active_clinics: number; total_clinics: number; pending_provisioning: number; failed_provisioning: number };
  clinics: Array<{ id: string; name: string; cnpj: string | null; created_at: string; deleted_at: string | null }>;
  provisioning_requests: Array<{
    id: string;
    clinic_name: string;
    cnpj: string | null;
    owner_email: string;
    owner_name: string;
    status: string;
    error_message: string | null;
    clinic_id: string | null;
    created_at: string;
    completed_at: string | null;
  }>;
  audit: Array<{ id: string; action: string; target_type: string; target_id: string | null; detail: unknown; created_at: string }>;
};

const invoke = async <T,>(name: string, options?: { method?: string; body?: unknown }): Promise<T> => {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) throw new Error('Sessão ausente');
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const response = await fetch(`${baseUrl}/functions/v1/${name}`, {
    method: options?.method ?? 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: anonKey,
      'Content-Type': 'application/json',
    },
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error || `Falha HTTP ${response.status}`);
  return payload as T;
};

export function PlatformAdminPage() {
  const [context, setContext] = useState<PlatformContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [clinicName, setClinicName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [provisioning, setProvisioning] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setContext(await invoke<PlatformContext>('platform-context'));
    } catch (err) {
      setContext(null);
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o console');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) {
      setError(signInError.message);
      return;
    }
    await load();
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setContext(null);
  };

  const provision = async (event: React.FormEvent) => {
    event.preventDefault();
    setProvisioning(true);
    setError(null);
    try {
      await invoke('provision-clinic', {
        method: 'POST',
        body: {
          idempotency_key: crypto.randomUUID(),
          clinic: { name: clinicName, cnpj },
          owner: { name: ownerName, email: ownerEmail, temporary_password: temporaryPassword },
        },
      });
      setClinicName('');
      setCnpj('');
      setOwnerName('');
      setOwnerEmail('');
      setTemporaryPassword('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no provisionamento');
    } finally {
      setProvisioning(false);
    }
  };

  if (loading) return <div className="app-surface min-h-screen grid place-items-center text-fog">Carregando administração da plataforma…</div>;

  if (!context) {
    return (
      <div className="app-surface min-h-screen grid place-items-center p-5">
        <Card className="w-full max-w-md">
          <CardHead title="MedicsPro Platform Admin" sub="domínio separado da administração interna das clínicas" />
          <form className="p-5 space-y-4" onSubmit={signIn}>
            {error && <div className="rounded-xl border border-amber/40 bg-amber/5 px-4 py-3 text-[13px] text-amber">{error}</div>}
            <Field label="Email"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
            <Field label="Senha"><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></Field>
            <Btn className="w-full" type="submit">Entrar no Platform Admin</Btn>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-surface min-h-screen p-5 md:p-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-mint">Administração da plataforma</p>
            <h1 className="mt-1 font-display text-3xl font-bold">MedicsPro Platform Admin</h1>
            <p className="mt-1 text-[13px] text-fog">{context.actor.email} · sem acesso implícito ao prontuário das clínicas</p>
          </div>
          <Btn className="ml-auto" variant="ghost" onClick={signOut}>Sair</Btn>
        </div>

        {error && <div className="rounded-xl border border-amber/40 bg-amber/5 px-4 py-3 text-[13px] text-amber">{error}</div>}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ['Clínicas ativas', context.summary.active_clinics],
            ['Clínicas registradas', context.summary.total_clinics],
            ['Provisionamentos abertos', context.summary.pending_provisioning],
            ['Falhas de provisionamento', context.summary.failed_provisioning],
          ].map(([label, value]) => <Card key={String(label)} className="p-4"><p className="text-[12px] text-fog">{label}</p><p className="mt-2 font-display text-3xl font-bold">{value}</p></Card>)}
        </div>

        <div className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
          <Card>
            <CardHead title="Provisionar nova clínica" sub="cria tenant + primeiro owner em fluxo server-side idempotente" />
            <form className="p-5 space-y-4" onSubmit={provision}>
              <Field label="Nome da clínica"><Input value={clinicName} onChange={(event) => setClinicName(event.target.value)} required /></Field>
              <Field label="CNPJ"><Input value={cnpj} onChange={(event) => setCnpj(event.target.value)} placeholder="Opcional" /></Field>
              <Field label="Nome do primeiro owner"><Input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} required /></Field>
              <Field label="Email do owner"><Input type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} required /></Field>
              <Field label="Senha temporária"><Input type="password" minLength={10} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} required /></Field>
              <Btn className="w-full" type="submit" disabled={provisioning}>{provisioning ? 'Provisionando…' : 'Criar clínica com segurança'}</Btn>
              <p className="text-[11px] leading-relaxed text-fog">A clínica nasce com automações pausadas. Ativação de módulos, automações e rollout devem ser revisados antes do go-live.</p>
            </form>
          </Card>

          <div className="space-y-5">
            <Card>
              <CardHead title="Clínicas" sub="visão de governança SaaS; não concede acesso aos dados internos" />
              <div className="divide-y divide-line/60">
                {context.clinics.map((clinic) => (
                  <div key={clinic.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5">
                    <div className="min-w-0 flex-1"><p className="font-display font-semibold text-[14px]">{clinic.name}</p><p className="mt-1 font-mono text-[10px] text-fog">{clinic.cnpj || 'CNPJ não informado'} · {clinic.id}</p></div>
                    <span className={`text-[11px] font-semibold ${clinic.deleted_at ? 'text-fog' : 'text-mint'}`}>{clinic.deleted_at ? 'inativa' : 'ativa'}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card>
              <CardHead title="Provisionamentos recentes" sub="histórico operacional e falhas preservadas" />
              <div className="divide-y divide-line/60">
                {context.provisioning_requests.length === 0 ? <p className="p-5 text-[13px] text-fog">Nenhum provisionamento registrado.</p> : context.provisioning_requests.map((request) => (
                  <div key={request.id} className="px-5 py-3.5">
                    <div className="flex flex-wrap items-center gap-3"><p className="font-display font-semibold text-[13.5px]">{request.clinic_name}</p><span className="font-mono text-[10px] text-fog">{request.status}</span></div>
                    <p className="mt-1 text-[12px] text-fog">{request.owner_name} · {request.owner_email}</p>
                    {request.error_message && <p className="mt-1 text-[11px] text-amber">{request.error_message}</p>}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
