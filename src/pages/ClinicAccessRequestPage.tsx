import { useMemo, useState } from 'react';
import { platformSupabase } from '../lib/platformSupabaseClient';

type RequestResult = { accepted?: boolean; request_id?: string; duplicate?: boolean; error?: string };

export function ClinicAccessRequestPage() {
  const [clinicName, setClinicName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'warn'; text: string } | null>(null);

  const canSubmit = useMemo(() => (
    clinicName.trim().length >= 2 && ownerName.trim().length >= 2 && /^\S+@\S+\.\S+$/.test(ownerEmail.trim())
  ), [clinicName, ownerName, ownerEmail]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const { data, error } = await platformSupabase.functions.invoke<RequestResult>('request-clinic-access', {
        body: {
          clinic_name: clinicName.trim(),
          cnpj: cnpj.trim() || undefined,
          owner_name: ownerName.trim(),
          owner_email: ownerEmail.trim().toLowerCase(),
          owner_phone: ownerPhone.trim() || undefined,
          website,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (!data?.accepted) throw new Error('Solicitação não confirmada.');
      setMessage({
        kind: 'ok',
        text: data.duplicate
          ? 'Já existe uma solicitação pendente com estes dados. Ela continua na fila de análise.'
          : 'Solicitação enviada. A equipe MedicsPro analisará o cadastro antes de liberar o acesso.',
      });
      if (!data.duplicate) {
        setClinicName(''); setCnpj(''); setOwnerName(''); setOwnerEmail(''); setOwnerPhone('');
      }
    } catch (error) {
      console.error('[MedicsPro] clinic access request:', error);
      setMessage({ kind: 'warn', text: error instanceof Error ? error.message : 'Não foi possível enviar a solicitação.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-surface min-h-screen grid place-items-center p-5 md:p-8">
      <div className="w-full max-w-3xl rounded-2xl border border-line bg-panel p-6 shadow-xl md:p-8">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.14em] text-mint">MedicsPro</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">Solicitar acesso para sua clínica</h1>
        <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-fog">
          Envie os dados básicos. Nenhuma conta clínica é criada automaticamente: a solicitação passa por análise da administração da plataforma.
        </p>

        {message && (
          <div className={`mt-5 rounded-xl border px-4 py-3 text-[12.5px] ${message.kind === 'ok' ? 'border-mint/30 bg-mint/5 text-mint' : 'border-amber/30 bg-amber/5 text-amber'}`}>
            {message.text}
          </div>
        )}

        <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="text-[12px] font-semibold text-paper/80">Nome da clínica
            <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" value={clinicName} onChange={(e) => setClinicName(e.target.value)} required />
          </label>
          <label className="text-[12px] font-semibold text-paper/80">CNPJ (opcional)
            <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
          </label>
          <label className="text-[12px] font-semibold text-paper/80">Responsável
            <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required />
          </label>
          <label className="text-[12px] font-semibold text-paper/80">E-mail
            <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required />
          </label>
          <label className="text-[12px] font-semibold text-paper/80 md:col-span-2">Telefone / WhatsApp (opcional)
            <input className="mt-2 w-full rounded-xl border border-line bg-deep px-4 py-3 font-normal outline-none focus:border-mint" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} />
          </label>
          <label className="hidden" aria-hidden="true">Website
            <input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
          <div className="md:col-span-2 border-t border-line/60 pt-4">
            <button type="submit" disabled={!canSubmit || busy} className="rounded-xl bg-mint px-5 py-3 font-display font-semibold text-on-accent disabled:opacity-50">
              {busy ? 'Enviando…' : 'Enviar solicitação'}
            </button>
            <p className="mt-3 text-[10.5px] leading-relaxed text-fog/80">
              O envio não cria acesso automático nem concede permissões. Os dados são usados apenas para análise do onboarding MedicsPro.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}
