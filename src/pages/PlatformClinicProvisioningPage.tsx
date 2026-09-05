import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { platformSupabase } from '../lib/platformSupabaseClient';
import { isPlatformAdmin } from '../lib/platformAdmin';
import {
  loadClinicAccessRequests,
  rejectClinicAccessRequest,
  type ClinicAccessRequest,
} from '../lib/platformAccessRequests';

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
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);
  const [requests, setRequests] = useState<ClinicAccessRequest[]>([]);
  const [accessRequestId, setAccessRequestId] = useState<string | null>(null);
  const [clinicName, setClinicName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey);

  const refreshQueue = async () => {
    setLoadingQueue(true);
    try {
      setRequests(await loadClinicAccessRequests('pending'));
    } catch (error) {
      console.error('[Platform Admin] access request queue:', error);
      setMessage({ kind: 'warn', text: 'Não foi possível carregar a fila de solicitações.' });
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    let active = true;
    void isPlatformAdmin()
      .then((allowed) => {
        if (!active) return;
        setAuthorized(allowed);
        if (allowed) void refreshQueue();
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

  const clearForm = () => {
    setAccessRequestId(null);
    setClinicName('');
    setCnpj('');
    setOwnerName('');
    setOwnerEmail('');
    setTemporaryPassword('');
    setIdempotencyKey(newIdempotencyKey());
  };

  const selectRequest = (request: ClinicAccessRequest) => {
    setAccessRequestId(request.id);
    setClinicName(request.clinicName);
    setCnpj(request.cnpj ?? '');
    setOwnerName(request.ownerName);
    setOwnerEmail(request.ownerEmail);
    setTemporaryPassword('');
    setIdempotencyKey(`access-${request.id}`);
    setMessage(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const rejectRequest = async (request: ClinicAccessRequest) => {
    const note = window.prompt(`Motivo da rejeição de “${request.clinicName}” (opcional):`) ?? '';
    if (!window.confirm(`Rejeitar a solicitação de ${request.clinicName}?`)) return;
    try {
      await rejectClinicAccessRequest(request.id, note);
      if (accessRequestId === request.id) clearForm();
      await refreshQueue();
      setMessage({ kind: 'ok', text: 'Solicitação rejeitada e registrada na auditoria.' });
    } catch (error) {
      console.error('[Platform Admin] reject access request:', error);
      setMessage({ kind: 'warn', text: 'Não foi possível rejeitar a solicitação.' });
    }
  };

  const provision = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || busy || !authorized) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await platformSupabase.functions.invoke<ProvisionResult>('provision-clinic', {
        body: {
          idempotency_key: idempotencyKey.trim(),
          access_request_id: accessRequestId ?? undefined,
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
      clearForm();
      await refreshQueue();
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
        <div className="mx-auto flex max-w-6xl items-center gap-4">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mint">MedicsPro Platform Admin</p>
            <h1 className="font-display text-xl font-bold">Onboarding de clínicas</h1>
          </div>
          <Link to="/platform" className="ml-auto rounded-xl border border-line px-3 py-2 text-[12px] font-semibold text-fog hover:bg-raise hover:text-paper">Governança</Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-6 p-5 md:p-8">
        <section className="rounded-2xl border border-line bg-panel p-5 md:p-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-aqua">Aprovação</p>
            <h2 className="mt-1 font-display text-xl font-bold">{accessRequestId ? 'Aprovar solicitação e provisionar' : 'Provisionamento manual'}</h2>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-relaxed text-fog">A criação efetiva continua server-side, idempotente e auditável. A senha temporária só é definida pelo Platform Admin no momento da aprovação.</p>
          </div>

          {message && (
            <div className={`mt-5 rounded-xl border px-4 py-3 text-[12.5px] ${message.kind === 'ok' ? 'border-mint/30 bg-mint/5 text-mint' : 'border-amber/30 bg-amber/5 text-amber'}`}>
              {message.text}
            </div>
          )}

          <form onSubmit={provision} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-[12px] font-semibold text-paper/80">Nome da clínica
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" value={clinicName} onChange={(e) => setClinicName(e.target.value)} readOnly={Boolean(accessRequestId)} required />
            </label>
            <label className="text-[12px] font-semibold text-paper/80">CNPJ (opcional)
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" value={cnpj} onChange={(e) => setCnpj(e.target.value)} readOnly={Boolean(accessRequestId)} />
            </label>
            <label className="text-[12px] font-semibold text-paper/80">Nome do proprietário
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} readOnly={Boolean(accessRequestId)} required />
            </label>
            <label className="text-[12px] font-semibold text-paper/80">E-mail do proprietário
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} readOnly={Boolean(accessRequestId)} required />
            </label>
            <label className="text-[12px] font-semibold text-paper/80">Senha temporária
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" type="password" minLength={10} value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} required />
            </label>
            <label className="text-[12px] font-semibold text-paper/80">Chave idempotente
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-mono text-[11px] font-normal outline-none focus:border-mint" value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} readOnly={Boolean(accessRequestId)} required />
            </label>
            <div className="md:col-span-2 flex flex-wrap items-center gap-3 border-t border-line/60 pt-4">
              <button type="submit" disabled={!canSubmit || busy} className="rounded-xl bg-mint px-4 py-3 font-display font-semibold text-on-accent disabled:opacity-50">{busy ? 'Provisionando…' : accessRequestId ? 'Aprovar e criar clínica' : 'Criar clínica e owner'}</button>
              {accessRequestId && <button type="button" onClick={clearForm} className="rounded-xl border border-line px-4 py-3 text-[12px] font-semibold text-fog hover:text-paper">Cancelar seleção</button>}
              <p className="max-w-2xl text-[11.5px] leading-relaxed text-fog">O owner será obrigado a trocar a senha temporária no primeiro acesso. Platform Admin não recebe acesso implícito ao tenant.</p>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-line bg-panel p-5 md:p-6">
          <div className="flex flex-wrap items-start gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-aqua">Fila de entrada</p>
              <h2 className="mt-1 font-display text-xl font-bold">Solicitações pendentes</h2>
              <p className="mt-1 text-[12.5px] text-fog">Pedidos públicos não criam conta nem clínica até você aprovar.</p>
            </div>
            <button type="button" onClick={() => void refreshQueue()} disabled={loadingQueue} className="ml-auto rounded-xl border border-line px-3 py-2 text-[12px] font-semibold text-fog hover:text-paper disabled:opacity-50">{loadingQueue ? 'Atualizando…' : 'Atualizar'}</button>
          </div>

          <div className="mt-5 space-y-3">
            {!loadingQueue && requests.length === 0 && <p className="rounded-xl border border-line bg-deep p-4 text-[12px] text-fog">Nenhuma solicitação pendente.</p>}
            {requests.map((request) => (
              <article key={request.id} className="rounded-xl border border-line bg-deep p-4">
                <div className="flex flex-wrap items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-display text-[15px] font-semibold">{request.clinicName}</p>
                    <p className="mt-1 text-[11.5px] text-fog">{request.ownerName} · {request.ownerEmail}{request.ownerPhone ? ` · ${request.ownerPhone}` : ''}</p>
                    <p className="mt-1 font-mono text-[9.5px] text-fog/70">CNPJ: {request.cnpj || 'não informado'} · solicitado {new Date(request.createdAt).toLocaleString('pt-BR')}</p>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => selectRequest(request)} className="rounded-lg bg-mint px-3 py-2 text-[11px] font-semibold text-on-accent">Analisar / aprovar</button>
                    <button type="button" onClick={() => void rejectRequest(request)} className="rounded-lg border border-pulse/35 px-3 py-2 text-[11px] font-semibold text-pulse">Rejeitar</button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
