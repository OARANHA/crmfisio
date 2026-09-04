import { useState } from 'react';
import { supabase, type User } from '../lib/supabaseClient';
import { Btn, Card, CardHead, Field, Input } from '../lib/ui';
import { IconShield } from '../components/icons';

type Props = {
  principal: User;
  onSignOut: () => Promise<void>;
};

export function PlatformAdminConsole({ principal, onSignOut }: Props) {
  const [clinicName, setClinicName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const provision = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const idempotencyKey = `platform-${crypto.randomUUID()}`;
      const { data, error: invokeError } = await supabase.functions.invoke('provision-clinic', {
        body: {
          idempotency_key: idempotencyKey,
          clinic: { name: clinicName.trim(), cnpj: cnpj.trim() || undefined },
          owner: {
            name: ownerName.trim(),
            email: ownerEmail.trim().toLowerCase(),
            temporary_password: temporaryPassword,
          },
        },
      });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setResult(`Clínica provisionada com segurança. ID: ${data?.clinic_id ?? 'confirmado pelo servidor'}`);
      setClinicName('');
      setCnpj('');
      setOwnerName('');
      setOwnerEmail('');
      setTemporaryPassword('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível provisionar a clínica.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-surface min-h-screen p-5 md:p-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel px-5 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-mint/10 text-mint"><IconShield className="h-5 w-5" /></div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mint">Administração da plataforma</p>
            <h1 className="font-display text-2xl font-bold">MedicsPro Control</h1>
            <p className="text-[12px] text-fog">{principal.email} · domínio separado das clínicas</p>
          </div>
          <Btn className="ml-auto" variant="ghost" onClick={() => void onSignOut()}>Sair</Btn>
        </header>

        <Card>
          <CardHead title="Provisionar nova clínica" sub="cria tenant + primeiro owner de forma idempotente e auditável" />
          <form onSubmit={provision} className="grid gap-4 p-5 md:grid-cols-2">
            <Field label="Nome da clínica"><Input value={clinicName} onChange={(e) => setClinicName(e.target.value)} required minLength={2} maxLength={160} /></Field>
            <Field label="CNPJ (opcional)"><Input value={cnpj} onChange={(e) => setCnpj(e.target.value)} placeholder="00.000.000/0000-00" /></Field>
            <Field label="Nome do proprietário"><Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required minLength={2} maxLength={160} /></Field>
            <Field label="E-mail do proprietário"><Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} required /></Field>
            <Field label="Senha temporária"><Input type="password" value={temporaryPassword} onChange={(e) => setTemporaryPassword(e.target.value)} required minLength={10} /></Field>
            <div className="flex items-end"><Btn type="submit" disabled={busy || !clinicName || !ownerName || !ownerEmail || temporaryPassword.length < 10}>{busy ? 'Provisionando…' : 'Criar clínica'}</Btn></div>
          </form>
          {(result || error) && (
            <div className={`mx-5 mb-5 rounded-xl border px-4 py-3 text-[13px] ${error ? 'border-amber/40 bg-amber/5 text-amber' : 'border-mint/40 bg-mint/5 text-mint'}`}>
              {error ?? result}
            </div>
          )}
        </Card>

        <Card>
          <CardHead title="Governança por padrão" sub="novos tenants nascem com automações pausadas" />
          <div className="grid gap-3 p-5 text-[13px] text-fog md:grid-cols-3">
            <div className="rounded-xl border border-line bg-deep p-4"><strong className="block text-paper">Sem acesso implícito</strong><span className="mt-1 block">platform_admin não recebe prontuário nem financeiro das clínicas.</span></div>
            <div className="rounded-xl border border-line bg-deep p-4"><strong className="block text-paper">Owner real</strong><span className="mt-1 block">o primeiro proprietário nasce como usuário Auth vinculado ao tenant.</span></div>
            <div className="rounded-xl border border-line bg-deep p-4"><strong className="block text-paper">Automação segura</strong><span className="mt-1 block">mensagens ficam pausadas até configuração operacional da clínica.</span></div>
          </div>
        </Card>
      </div>
    </div>
  );
}
