import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Btn, Card, CardHead, Field, Input } from '../lib/ui';
import { PulseMark } from '../components/Ecg';
import { IconLock, IconShield } from '../components/icons';

type ProvisionResult = {
  clinic_id?: string;
  owner_user_id?: string;
  idempotent?: boolean;
  error?: string;
};

const newIdempotencyKey = () => `clinic-${crypto.randomUUID()}`;

export function PlatformAdminPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [authBusy, setAuthBusy] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [clinicName, setClinicName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setAuthenticated(Boolean(data.session));
      setAuthBusy(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      setAuthenticated(Boolean(session));
      setAuthBusy(false);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const canSubmit = useMemo(() => (
    clinicName.trim().length >= 2 &&
    ownerName.trim().length >= 2 &&
    /^\S+@\S+\.\S+$/.test(ownerEmail.trim()) &&
    temporaryPassword.length >= 10
  ), [clinicName, ownerName, ownerEmail, temporaryPassword]);

  const signIn = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setAuthBusy(false);
    if (error) setMessage({ kind: 'warn', text: error.message });
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthenticated(false);
    setMessage(null);
  };

  const provision = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke<ProvisionResult>('provision-clinic', {
        body: {
          idempotency_key: idempotencyKey,
          clinic: { name: clinicName.trim(), cnpj: cnpj.trim() || undefined },
          owner: {
            email: ownerEmail.trim().toLowerCase(),
            name: ownerName.trim(),
            temporary_password: temporaryPassword,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.clinic_id || !data?.owner_user_id) throw new Error('Provisionamento concluído sem os identificadores esperados.');

      setMessage({ kind: 'ok', text: `Clínica criada com segurança. ID: ${data.clinic_id}` });
      setClinicName('');
      setCnpj('');
      setOwnerName('');
      setOwnerEmail('');
      setTemporaryPassword('');
      setIdempotencyKey(newIdempotencyKey());
    } catch (error) {
      setMessage({ kind: 'warn', text: error instanceof Error ? error.message : 'Não foi possível provisionar a clínica.' });
    } finally {
      setBusy(false);
    }
  };

  if (authBusy) {
    return <div className="app-surface min-h-screen grid place-items-center text-fog">Validando sessão da plataforma…</div>;
  }

  if (!authenticated) {
    return (
      <div className="app-surface min-h-screen grid place-items-center p-5">
        <Card className="w-full max-w-md">
          <CardHead title="Administração MedicsPro" sub="domínio separado das clínicas" right={<IconShield className="h-5 w-5 text-mint" />} />
          <form onSubmit={signIn} className="p-5 space-y-4">
            <div className="flex items-center gap-2 pb-2"><PulseMark className="w-7 h-6" /><span className="font-display font-bold">MEDICSPRO<span className="text-pulse">.</span></span></div>
            <Field label="E-mail da plataforma"><Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></Field>
            <Field label="Senha"><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></Field>
            {message && <p className="rounded-xl border border-amber/30 bg-amber/5 px-3 py-2 text-[12.5px] text-amber">{message.text}</p>}
            <Btn type="submit" disabled={authBusy || !email || !password} className="w-full justify-center"><IconLock className="h-4 w-4" /> Entrar na plataforma</Btn>
            <p className="text-[11.5px] leading-relaxed text-fog">Esta entrada não concede acesso aos dados clínicos de nenhuma clínica. A autorização real continua sendo validada pelo servidor.</p>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="app-surface min-h-screen p-5 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-start gap-3">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-mint">Administração da plataforma</p>
            <h1 className="mt-1 font-display text-3xl font-bold">Provisionamento de clínicas</h1>
            <p className="mt-1 text-[13.5px] text-fog">Crie a clínica e o primeiro owner em um fluxo server-side idempotente e auditável.</p>
          </div>
          <Btn variant="ghost" className="ml-auto" onClick={() => void signOut()}>Sair</Btn>
        </header>

        {message && (
          <div className={`rounded-xl border px-4 py-3 text-[13px] ${message.kind === 'ok' ? 'border-mint/30 bg-mint/5 text-mint' : 'border-amber/30 bg-amber/5 text-amber'}`}>
            {message.text}
          </div>
        )}

        <Card>
          <CardHead title="Nova clínica" sub="o usuário nasce como owner e as automações permanecem pausadas até configuração" right={<IconShield className="h-5 w-5 text-mint" />} />
          <form onSubmit={provision} className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="Nome da clínica"><Input value={clinicName} onChange={(event) => setClinicName(event.target.value)} placeholder="Clínica Exemplo" required /></Field>
            <Field label="CNPJ (opcional)"><Input value={cnpj} onChange={(event) => setCnpj(event.target.value)} placeholder="00.000.000/0000-00" /></Field>
            <Field label="Nome do proprietário"><Input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Nome completo" required /></Field>
            <Field label="E-mail do proprietário"><Input type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} placeholder="owner@clinica.com.br" required /></Field>
            <Field label="Senha temporária"><Input type="password" value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} minLength={10} required /></Field>
            <Field label="Chave idempotente"><Input value={idempotencyKey} onChange={(event) => setIdempotencyKey(event.target.value)} required /></Field>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3 border-t border-line/60 pt-4">
              <Btn type="submit" disabled={!canSubmit || busy}>{busy ? 'Provisionando…' : 'Criar clínica e owner'}</Btn>
              <p className="text-[11.5px] text-fog">A senha temporária deve ser trocada pelo owner. Nenhuma permissão clínica é concedida ao platform admin.</p>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
