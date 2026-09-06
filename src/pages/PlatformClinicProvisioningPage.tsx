import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlatformAdminShell } from '../components/PlatformAdminShell';
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

function formatRequestedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

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
    <PlatformAdminShell
      eyebrow="MedicsPro Platform Admin"
      title="Onboarding de clínicas"
      description="Transforme solicitações em clínicas operacionais mantendo aprovação humana, idempotência e trilha de auditoria."
      actions={(
        <button type="button" onClick={() => void refreshQueue()} disabled={loadingQueue} className="rounded-xl border border-line bg-panel/70 px-3 py-2 text-[11px] font-semibold text-fog transition hover:border-aqua/30 hover:text-paper disabled:opacity-50">
          {loadingQueue ? 'Atualizando…' : 'Atualizar fila'}
        </button>
      )}
    >
      {message && (
        <div className={`rounded-xl border px-4 py-3 text-[12px] ${message.kind === 'ok' ? 'border-mint/30 bg-mint/[0.05] text-mint' : 'border-amber/30 bg-amber/[0.05] text-amber'}`}>
          {message.text}
        </div>
      )}

      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-[20px] border border-line bg-panel p-4">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-fog">Fila comercial</p>
          <p className="mt-2 font-display text-[28px] font-bold tracking-tight">{requests.length}</p>
          <p className="mt-1 text-[11px] text-fog">solicitação(ões) aguardando análise</p>
        </div>
        <div className="rounded-[20px] border border-line bg-panel p-4">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-fog">Seleção atual</p>
          <p className={`mt-2 font-display text-[18px] font-bold ${accessRequestId ? 'text-aqua' : 'text-paper'}`}>{accessRequestId ? 'Solicitação pública' : 'Manual'}</p>
          <p className="mt-1 text-[11px] text-fog">dados públicos ficam bloqueados contra edição na aprovação</p>
        </div>
        <div className="rounded-[20px] border border-line bg-panel p-4">
          <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-fog">Boundary</p>
          <p className="mt-2 font-display text-[18px] font-bold text-mint">Server-side</p>
          <p className="mt-1 text-[11px] text-fog">criação idempotente, auditável e separada do tenant</p>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[22px] border border-line bg-panel p-5">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-aqua">Fila de entrada</p>
              <h2 className="mt-1 font-display text-[18px] font-bold">Solicitações pendentes</h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-fog">Pedidos públicos não criam clínica nem usuário até a sua aprovação.</p>
            </div>
            <span className={`rounded-full border px-2 py-1 text-[9.5px] font-semibold ${requests.length ? 'border-amber/30 bg-amber/[0.07] text-amber' : 'border-mint/30 bg-mint/[0.07] text-mint'}`}>{requests.length} pendente(s)</span>
          </div>

          <div className="mt-4 space-y-2.5">
            {!loadingQueue && requests.length === 0 && (
              <div className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[11.5px] text-fog">Nenhuma solicitação pendente neste momento.</div>
            )}
            {requests.map((request) => {
              const selected = request.id === accessRequestId;
              return (
                <article key={request.id} className={`rounded-xl border p-4 transition ${selected ? 'border-aqua/35 bg-aqua/[0.05]' : 'border-line/70 bg-deep/50'}`}>
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display text-[14px] font-semibold">{request.clinicName}</p>
                        {selected && <span className="rounded-full border border-aqua/30 px-2 py-0.5 text-[9px] font-semibold text-aqua">em análise</span>}
                      </div>
                      <p className="mt-1 text-[11px] text-fog">{request.ownerName} · {request.ownerEmail}</p>
                      {request.ownerPhone && <p className="mt-0.5 text-[10.5px] text-fog">{request.ownerPhone}</p>}
                      <p className="mt-2 font-mono text-[9px] text-fog/70">CNPJ: {request.cnpj || 'não informado'} · {formatRequestedAt(request.createdAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => selectRequest(request)} className="rounded-lg bg-mint px-3 py-2 text-[10.5px] font-semibold text-on-accent">Analisar</button>
                      <button type="button" onClick={() => void rejectRequest(request)} className="rounded-lg border border-pulse/35 px-3 py-2 text-[10.5px] font-semibold text-pulse">Rejeitar</button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="rounded-[22px] border border-line bg-panel p-5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-mint">Provisionamento</p>
              <h2 className="mt-1 font-display text-[18px] font-bold">{accessRequestId ? 'Aprovar e criar clínica' : 'Provisionamento manual'}</h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-fog">O primeiro owner recebe senha temporária e deve alterá-la no primeiro acesso.</p>
            </div>
            {accessRequestId && <button type="button" onClick={clearForm} className="rounded-lg border border-line px-3 py-2 text-[10.5px] font-semibold text-fog hover:text-paper">Limpar seleção</button>}
          </div>

          <form onSubmit={provision} className="mt-5 grid gap-4 md:grid-cols-2">
            <label className="text-[11.5px] font-semibold text-paper/80">Nome da clínica
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none transition focus:border-mint read-only:cursor-not-allowed read-only:opacity-75" value={clinicName} onChange={(e) => setClinicName(e.target.value)} readOnly={Boolean(accessRequestId)} required />
            </label>
            <label className="text-[11.5px] font-semibold text-paper/80">CNPJ (opcional)
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none transition focus:border-mint read-only:cursor-not-allowed read-only:opacity-75" value={cnpj} onChange={(e) => setCnpj(e.target.value)} readOnly={Boolean(accessRequestId)} />
            </label>
            <label className="text-[11.5px] font-semibold text-paper/80">Nome do proprietário
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none transition focus:border-mint read-only:cursor-not-allowed read-only:opacity-75" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} readOnly={Boolean(accessRequestId)} required />
            </label>
            <label className="text-[11.5px] font-semibold text-paper/80">E-mail do proprietário
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none transition focus:border-mint read-only:cursor-not-allowed read-only:opacity-75" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} readOnly={Boolean(accessRequestId)} required />
            </label>
            <label className="text-[11.5px] font-semibold text-paper/80">Senha temporária
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none transition focus:border-mint" type="password" minLength={10} value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} required />
              <span className="mt-1 block text-[9.5px] font-normal text-fog">mínimo de 10 caracteres</span>
            </label>
            <label className="text-[11.5px] font-semibold text-paper/80">Chave idempotente
              <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-mono text-[10.5px] font-normal outline-none transition focus:border-mint read-only:cursor-not-allowed read-only:opacity-75" value={idempotencyKey} onChange={(e) => setIdempotencyKey(e.target.value)} readOnly={Boolean(accessRequestId)} required />
              <span className="mt-1 block text-[9.5px] font-normal text-fog">protege contra criação duplicada</span>
            </label>

            <div className="md:col-span-2 rounded-xl border border-aqua/20 bg-aqua/[0.04] p-3 text-[10.5px] leading-relaxed text-fog">
              <strong className="font-semibold text-paper/85">Fluxo seguro:</strong> solicitação → aprovação → criação server-side → primeiro owner → troca obrigatória de senha → configuração de módulos. Platform Admin não recebe acesso implícito ao tenant.
            </div>

            <div className="md:col-span-2 flex flex-wrap items-center gap-3 border-t border-line/60 pt-4">
              <button type="submit" disabled={!canSubmit || busy} className="rounded-xl bg-mint px-4 py-3 font-display text-[12px] font-semibold text-on-accent shadow-sm disabled:opacity-50">
                {busy ? 'Provisionando…' : accessRequestId ? 'Aprovar e criar clínica' : 'Criar clínica e owner'}
              </button>
              <p className="text-[10.5px] text-fog">A operação só é enviada quando todos os dados mínimos estão válidos.</p>
            </div>
          </form>
        </div>
      </section>
    </PlatformAdminShell>
  );
}
