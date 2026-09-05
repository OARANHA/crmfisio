import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { isPlatformAdmin } from '../lib/platformAdmin';

type ProvisionResult = {
  clinic_id?: string;
  owner_user_id?: string;
  idempotent?: boolean;
  error?: string;
};

const newIdempotencyKey = () => `clinic-${crypto.randomUUID()}`;

export function PlatformClinicProvisioningPage() {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
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
    void isPlatformAdmin()
      .then((allowed) => {
        if (active) setAuthorized(allowed);
      })
      .catch((error) => {
        console.error('[Platform Admin] provisioning authorization:', error);
        if (active) setAuthorized(false);
      });
    return () => { active = false; };
  }, []);

  const canSubmit = useMemo(() => (
    clinicName.trim().length >= 2 &&
    ownerName.trim().length >= 2 &&
    /^\S+@\S+\.\S+$/.test(ownerEmail.trim()) &&
    temporaryPassword.length >= 10 &&
    idempotencyKey.trim().length >= 8
  ), [clinicName, ownerName, ownerEmail, temporaryPassword, idempotencyKey]);

  const provision = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || busy || !authorized) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke<ProvisionResult>('provision-clinic', {
        body: {
          idempotency_key: idempotencyKey.trim(),
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
      if (!data?.clinic_id || !data?.owner_user_id) {
        throw new Error('Provisionamento concluído sem os identificadores esperados.');
      }

      setMessage({
        kind: 'ok',
        text: data.idempotent
          ? `Solicitação já concluída com segurança. Clínica: ${data.clinic_id}`
          : `Clínica criada com segurança. Clínica: ${data.clinic_id}`,
      });
      setClinicName('');
      setCnpj('');
      setOwnerName('');
      setOwnerEmail('');
      setTemporaryPassword('');
      setIdempotencyKey(newIdempotencyKey());
    } catch (error) {
      console.error('[Platform Admin] provision clinic:', error);
      setMessage({ kind: 'warn', text: error instanceof Error ? error.message : 'Não foi possível provisionar a clínica.' });
    } finally {
      setBusy(false);
    }
  };

  if (authorized === null) {
    return <div className="app-surface min-h-screen grid place-items-center text-fog">Validando privilégios da plataforma…</div>;
  }

  if (!authorized) {
    return (
      <div className="app-surface min-h-screen grid place-items-center p-5">
        <div className="w-full max-w-lg rounded-2xl border border-pulse/30 bg-panel p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-pulse">Acesso negado</p>
          <h1 className="mt-2 font-display text-2xl font-bold">Platform Admin obrigatório</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-fog">Provisionar clínicas é uma ação do domínio SaaS e não pode ser executada por owner/admin de clínica.</p>
          <Link to="/platform" className="mt-6 inline-flex rounded-xl border border-line px-4 py-2.5 text-[13px] font-semibold text-fog hover:text-paper">Voltar ao Platform Admin</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app-surface min-h-screen">
      <header className="border-b border-line/70 bg-deep/90 px-5 py-4 backdrop-blur md:px-8">
        <div className="mx-auto flex max-w-5xl items-center gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mint">MedicsPro Platform Admin</p>
            <h1 className="font-display text-xl font-bold">Provisionar clínica</h1>
          </div>
          <Link to="/platform" className="ml-auto rounded-xl border border-line px-3 py-2 text-[12px] font-semibold text-fog hover:bg-raise hover:text-paper">Governança</Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl p-5 md:p-8">
        <section className="rounded-2xl border border-line bg-panel p-5 md:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-aqua">Onboarding SaaS</p>
            <h2 className="mt-1 font-display text-xl font-bold">Nova clínica + primeiro owner</h2>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-fog">Fluxo server-side idempotente e auditável. A nova clínica nasce com automações pausadas até revisão operacional.</p>
          </div>

          {message && (
            <div className={`mt-5 rounded-xl border px-4 py-3 text-[12.5px] ${message.kind === 'ok' ? 'border-mint/30 bg-mint/5 text-mint' : 'border-amber/30 bg-amber/5 text-amber'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={provision} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-[12px] font-semibold text-paper/80">Nome da clínica
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" value={clinicName} onChange={(event) => setClinicName(event.target.value)} required />
            </label>
            <label className="text-[12px] font-semibold text-paper/80">CNPJ (opcional)
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" value={cnpj} onChange={(event) => setCnpj(event.target.value)} />
            </label>
            <label className="text-[12px] font-semibold text-paper/80">Nome do proprietário
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" value={ownerName} onChange={(event) => setOwnerName(event.target.value)} required />
            </label>
            <label className="text-[12px] font-semibold text-paper/80">E-mail do proprietário
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" type="email" value={ownerEmail} onChange={(event) => setOwnerEmail(event.target.value)} required />
            </label>
            <label className="text-[12px] font-semibold text-paper/80">Senha temporária
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" type="password" minLength={10} value={temporaryPassword} onChange={(event) => setTemporaryPassword(event.target.value)} required />
            </label>
            <label className="text-[12px] font-semibold text-paper/80">Chave idempotente
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-mono text-[11px] font-normal outline-none focus:border-mint" value={idempotencyKey} onChange={(event) => setIdempotencyKey(event.target.value)} required />
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3 border-t border-line/60 pt-4">
              <button type="submit" disabled={!canSubmit || busy} className="rounded-xl bg-mint px-4 py-3 font-display font-semibold text-on-accent disabled:opacity-50">{busy ? 'Provisionando…' : 'Criar clínica e owner'}</button>
              <p className="max-w-2xl text-[11.5px] leading-relaxed text-fog">O owner deve trocar a senha temporária. O Platform Admin continua sem acesso implícito a prontuário, agenda ou financeiro da clínica.</p>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
