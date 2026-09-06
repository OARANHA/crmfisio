import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PlatformAdminShell } from '../components/PlatformAdminShell';
import { platformSupabase } from '../lib/platformSupabaseClient';
import { getCachedPlatformAdminAccess, validatePlatformAdminAccess } from '../lib/platformAdminAccess';
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
  const [authorized, setAuthorized] = useState<boolean | null>(() => getCachedPlatformAdminAccess());
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
    void validatePlatformAdminAccess()
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
        <div className="w-full max-w-lg rounded-[24px] border border-pulse/30 bg-panel p-7 shadow-[0_24px_80px_rgba(3,16,48,0.10)]">
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
      title="Onboarding"
      description="Conduza cada nova clínica da solicitação ao primeiro acesso sem perder aprovação humana, idempotência ou auditoria."
      actions={(
        <button type="button" onClick={() => void refreshQueue()} disabled={loadingQueue} className="rounded-xl border border-line bg-panel px-3.5 py-2.5 text-[11px] font-semibold text-fog transition hover:border-mint/35 hover:text-paper disabled:opacity-50">
          {loadingQueue ? 'Atualizando…' : 'Atualizar fila'}
        </button>
      )}
    >
      {message && (
        <div className={`rounded-[16px] border px-4 py-3 text-[12px] ${message.kind === 'ok' ? 'border-mint/30 bg-mint/[0.06] text-mint' : 'border-amber/30 bg-amber/[0.06] text-amber'}`}>
          {message.text}
        </div>
      )}

      <section className="relative overflow-hidden rounded-[26px] border border-mint/20 bg-gradient-to-br from-mint/[0.10] via-panel to-panel p-6 md:p-7">
        <div className="pointer-events-none absolute -right-14 -top-20 h-60 w-60 rounded-full bg-mint/[0.08] blur-3xl" />
        <div className="relative grid gap-6 xl:grid-cols-[1.25fr_0.75fr] xl:items-end">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-mint">Entrada controlada</p>
            <h2 className="mt-2 max-w-3xl font-display text-[26px] font-bold leading-tight tracking-tight md:text-[31px]">Da intenção comercial a uma clínica pronta para operar.</h2>
            <p className="mt-3 max-w-2xl text-[12.5px] leading-relaxed text-fog">A solicitação pública não cria tenant. A criação só acontece depois da sua análise, com owner inicial e credencial temporária controlados server-side.</p>
          </div>
          <div className="grid grid-cols-3 gap-2.5">
            <FlowStep index="01" label="Analisar" active={Boolean(accessRequestId)} />
            <FlowStep index="02" label="Provisionar" active={Boolean(accessRequestId && temporaryPassword)} />
            <FlowStep index="03" label="Configurar" active={false} />
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <OnboardingMetric label="Na fila" value={String(requests.length)} detail="solicitações aguardando decisão" tone={requests.length ? 'amber' : 'mint'} />
        <OnboardingMetric label="Origem atual" value={accessRequestId ? 'Solicitação' : 'Manual'} detail={accessRequestId ? 'dados de entrada preservados' : 'cadastro iniciado pelo Platform Admin'} tone="aqua" />
        <OnboardingMetric label="Boundary" value="Server-side" detail="idempotência + auditoria + tenant separado" tone="mint" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-[24px] border border-line bg-panel p-5 shadow-[0_12px_32px_rgba(3,16,48,0.035)]">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-aqua">Fila de entrada</p>
              <h2 className="mt-1 font-display text-[19px] font-bold">Solicitações pendentes</h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-fog">Nenhuma clínica ou usuário é criado antes da sua decisão.</p>
            </div>
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${requests.length ? 'border-amber/30 bg-amber/[0.08] text-amber' : 'border-mint/30 bg-mint/[0.08] text-mint'}`}>{requests.length} pendente(s)</span>
          </div>

          <div className="mt-5 space-y-3">
            {!loadingQueue && requests.length === 0 && (
              <div className="rounded-[18px] border border-dashed border-line px-5 py-9 text-center">
                <div className="mx-auto grid h-10 w-10 place-items-center rounded-full border border-mint/25 bg-mint/[0.06] text-mint">✓</div>
                <p className="mt-3 text-[12px] font-semibold text-paper">Fila em dia</p>
                <p className="mt-1 text-[11px] text-fog">Nenhuma solicitação aguardando análise.</p>
              </div>
            )}
            {requests.map((request) => {
              const selected = request.id === accessRequestId;
              return (
                <article key={request.id} className={`rounded-[18px] border p-4 transition ${selected ? 'border-mint/35 bg-mint/[0.055] shadow-[0_8px_24px_rgba(3,16,48,0.04)]' : 'border-line/70 bg-deep/45 hover:border-aqua/25'}`}>
                  <div className="flex items-start gap-3">
                    <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-display text-[12px] font-bold ${selected ? 'border-mint/30 bg-mint/[0.08] text-mint' : 'border-line bg-panel text-aqua'}`}>{request.clinicName.slice(0, 2).toUpperCase()}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-display text-[14px] font-semibold">{request.clinicName}</p>
                        {selected && <span className="rounded-full border border-mint/30 bg-mint/[0.07] px-2 py-0.5 text-[9.5px] font-semibold text-mint">em análise</span>}
                      </div>
                      <p className="mt-1 truncate text-[11px] text-fog">{request.ownerName} · {request.ownerEmail}</p>
                      {request.ownerPhone && <p className="mt-0.5 text-[10.5px] text-fog">{request.ownerPhone}</p>}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-fog/80">
                        <span>CNPJ: {request.cnpj || 'não informado'}</span>
                        <span>{formatRequestedAt(request.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-2 border-t border-line/55 pt-3">
                    <button type="button" onClick={() => selectRequest(request)} className="flex-1 rounded-xl bg-mint px-3 py-2.5 text-[10.5px] font-semibold text-on-accent">{selected ? 'Selecionada' : 'Analisar'}</button>
                    <button type="button" onClick={() => void rejectRequest(request)} className="rounded-xl border border-pulse/30 px-3 py-2.5 text-[10.5px] font-semibold text-pulse transition hover:bg-pulse/[0.05]">Rejeitar</button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        <div className="rounded-[24px] border border-line bg-panel p-5 md:p-6 shadow-[0_12px_32px_rgba(3,16,48,0.035)]">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mint">Provisionamento</p>
              <h2 className="mt-1 font-display text-[20px] font-bold">{accessRequestId ? 'Aprovar e criar clínica' : 'Provisionamento manual'}</h2>
              <p className="mt-1 text-[11.5px] leading-relaxed text-fog">O primeiro owner recebe uma senha temporária e precisa substituí-la no primeiro acesso.</p>
            </div>
            {accessRequestId && <button type="button" onClick={clearForm} className="rounded-xl border border-line bg-deep/45 px-3 py-2 text-[10.5px] font-semibold text-fog hover:text-paper">Limpar seleção</button>}
          </div>

          {accessRequestId && (
            <div className="mt-5 rounded-[18px] border border-aqua/20 bg-aqua/[0.045] p-4">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl border border-aqua/25 bg-aqua/[0.08] text-aqua">↗</div>
                <div>
                  <p className="text-[11px] font-semibold text-paper">Solicitação pública selecionada</p>
                  <p className="mt-0.5 text-[10.5px] text-fog">Os dados de identidade permanecem somente leitura durante a aprovação.</p>
                </div>
              </div>
            </div>
          )}

          <form onSubmit={provision} className="mt-5 grid gap-4 md:grid-cols-2">
            <Field label="Nome da clínica" value={clinicName} onChange={setClinicName} readOnly={Boolean(accessRequestId)} required />
            <Field label="CNPJ (opcional)" value={cnpj} onChange={setCnpj} readOnly={Boolean(accessRequestId)} />
            <Field label="Nome do proprietário" value={ownerName} onChange={setOwnerName} readOnly={Boolean(accessRequestId)} required />
            <Field label="E-mail do proprietário" value={ownerEmail} onChange={setOwnerEmail} readOnly={Boolean(accessRequestId)} required type="email" />
            <Field label="Senha temporária" value={temporaryPassword} onChange={setTemporaryPassword} required type="password" hint="mínimo de 10 caracteres" minLength={10} />
            <Field label="Chave idempotente" value={idempotencyKey} onChange={setIdempotencyKey} readOnly={Boolean(accessRequestId)} required hint="protege contra criação duplicada" mono />

            <div className="md:col-span-2 grid gap-3 sm:grid-cols-3">
              <SafetyItem icon="✓" title="Aprovação humana" detail="nenhum tenant nasce da solicitação pública" />
              <SafetyItem icon="↺" title="Idempotência" detail="repetições não criam clínicas duplicadas" />
              <SafetyItem icon="⌁" title="Auditoria" detail="ações administrativas permanecem rastreáveis" />
            </div>

            <div className="md:col-span-2 flex flex-wrap items-center gap-3 border-t border-line/60 pt-5">
              <button type="submit" disabled={!canSubmit || busy} className="rounded-xl bg-mint px-5 py-3.5 font-display text-[12px] font-semibold text-on-accent shadow-sm transition disabled:cursor-not-allowed disabled:opacity-45">
                {busy ? 'Provisionando…' : accessRequestId ? 'Aprovar e criar clínica' : 'Criar clínica e owner'}
              </button>
              <p className="max-w-md text-[10.5px] leading-relaxed text-fog">Depois da criação, módulos e lifecycle continuam sob controle do Platform Admin. A ação não concede acesso do Platform Admin ao tenant.</p>
            </div>
          </form>
        </div>
      </section>
    </PlatformAdminShell>
  );
}

function FlowStep({ index, label, active }: { index: string; label: string; active: boolean }) {
  return <div className={`rounded-[16px] border p-3 ${active ? 'border-mint/30 bg-mint/[0.08]' : 'border-line/70 bg-panel/55'}`}><p className={`text-[9.5px] font-bold ${active ? 'text-mint' : 'text-fog'}`}>{index}</p><p className="mt-1 text-[11px] font-semibold text-paper">{label}</p></div>;
}

function OnboardingMetric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: 'mint' | 'aqua' | 'amber' }) {
  const toneClass = tone === 'mint' ? 'text-mint' : tone === 'aqua' ? 'text-aqua' : 'text-amber';
  return <div className="rounded-[20px] border border-line bg-panel p-4.5"><p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-fog">{label}</p><p className={`mt-2 font-display text-[22px] font-bold tracking-tight ${toneClass}`}>{value}</p><p className="mt-1 text-[10.5px] leading-relaxed text-fog">{detail}</p></div>;
}

function Field({ label, value, onChange, type = 'text', readOnly = false, required = false, hint, mono = false, minLength }: { label: string; value: string; onChange: (value: string) => void; type?: string; readOnly?: boolean; required?: boolean; hint?: string; mono?: boolean; minLength?: number }) {
  return <label className="text-[11.5px] font-semibold text-paper/80">{label}<input className={`mt-2 w-full rounded-xl border border-line bg-deep/70 px-4 py-3 font-normal outline-none transition focus:border-mint read-only:cursor-not-allowed read-only:opacity-70 ${mono ? 'font-mono text-[10.5px]' : ''}`} type={type} minLength={minLength} value={value} onChange={(event) => onChange(event.target.value)} readOnly={readOnly} required={required} />{hint && <span className="mt-1.5 block text-[9.5px] font-normal text-fog">{hint}</span>}</label>;
}

function SafetyItem({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return <div className="rounded-[16px] border border-line/70 bg-deep/45 p-3.5"><div className="flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg border border-mint/20 bg-mint/[0.06] text-mint">{icon}</span><p className="text-[10.5px] font-semibold text-paper">{title}</p></div><p className="mt-2 text-[9.5px] leading-relaxed text-fog">{detail}</p></div>;
}
