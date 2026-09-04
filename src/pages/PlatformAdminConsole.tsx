import { useEffect, useState } from 'react';
import { supabase, type User } from '../lib/supabaseClient';
import { Btn, Card, CardHead, Field, Input } from '../lib/ui';
import { IconShield } from '../components/icons';

type Props = {
  principal: User;
  onSignOut: () => Promise<void>;
};

type ClinicOverview = {
  id: string;
  name: string;
  cnpj: string | null;
  createdAt: string;
  owner: { name: string; email: string; active: boolean } | null;
  automationActive: boolean;
};

type PlatformOverview = {
  summary: {
    clinics: number;
    activeOwners: number;
    automationEnabled: number;
    automationPaused: number;
  };
  clinics: ClinicOverview[];
};

export function PlatformAdminConsole({ principal, onSignOut }: Props) {
  const [clinicName, setClinicName] = useState('');
  const [cnpj, setCnpj] = useState('');
  const [ownerName, setOwnerName] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [temporaryPassword, setTemporaryPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overview, setOverview] = useState<PlatformOverview | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadOverview = async () => {
    setOverviewLoading(true);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('platform-admin-overview', { body: {} });
      if (invokeError) throw invokeError;
      if (data?.error) throw new Error(data.error);
      setOverview(data as PlatformOverview);
    } catch (e) {
      console.error('[PlatformAdmin] overview:', e);
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o panorama da plataforma.');
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    void loadOverview();
  }, []);

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
      await loadOverview();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível provisionar a clínica.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="app-surface min-h-screen p-5 md:p-8">
      <div className="mx-auto max-w-6xl space-y-5">
        <header className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel px-5 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-mint/10 text-mint"><IconShield className="h-5 w-5" /></div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-mint">Administração da plataforma</p>
            <h1 className="font-display text-2xl font-bold">MedicsPro Control</h1>
            <p className="text-[12px] text-fog">{principal.email} · domínio separado das clínicas</p>
          </div>
          <Btn className="ml-auto" variant="ghost" onClick={() => void onSignOut()}>Sair</Btn>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Clínicas', overview?.summary.clinics ?? 0],
            ['Owners ativos', overview?.summary.activeOwners ?? 0],
            ['Automações ligadas', overview?.summary.automationEnabled ?? 0],
            ['Automações pausadas', overview?.summary.automationPaused ?? 0],
          ].map(([label, value]) => (
            <Card key={String(label)} className="p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fog">{label}</p>
              <p className="mt-2 font-display text-3xl font-bold text-paper">{overviewLoading ? '—' : value}</p>
            </Card>
          ))}
        </section>

        <Card>
          <CardHead
            title="Clínicas da plataforma"
            sub="visão operacional sem acesso implícito a prontuário ou financeiro"
            right={<Btn variant="ghost" onClick={() => void loadOverview()} disabled={overviewLoading}>{overviewLoading ? 'Atualizando…' : 'Atualizar'}</Btn>}
          />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="border-b border-line bg-deep/70 text-left text-[11px] uppercase tracking-[0.06em] text-fog">
                  <th className="px-5 py-3">Clínica</th>
                  <th className="px-5 py-3">Owner</th>
                  <th className="px-5 py-3">Automação</th>
                  <th className="px-5 py-3">Criada em</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.clinics ?? []).map((clinic) => (
                  <tr key={clinic.id} className="border-b border-line/60 last:border-0">
                    <td className="px-5 py-4">
                      <p className="font-display font-semibold text-paper">{clinic.name}</p>
                      <p className="mt-1 font-mono text-[10.5px] text-fog">{clinic.cnpj || 'CNPJ não informado'}</p>
                    </td>
                    <td className="px-5 py-4">
                      {clinic.owner ? (
                        <>
                          <p className="font-semibold text-paper">{clinic.owner.name}</p>
                          <p className="mt-1 text-[11.5px] text-fog">{clinic.owner.email} · {clinic.owner.active ? 'ativo' : 'inativo'}</p>
                        </>
                      ) : <span className="text-amber">Owner não encontrado</span>}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-semibold ${clinic.automationActive ? 'border-mint/35 bg-mint/10 text-mint' : 'border-amber/35 bg-amber/10 text-amber'}`}>
                        {clinic.automationActive ? 'Ligada' : 'Pausada'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-fog">{new Date(clinic.createdAt).toLocaleDateString('pt-BR')}</td>
                  </tr>
                ))}
                {!overviewLoading && (overview?.clinics.length ?? 0) === 0 && (
                  <tr><td colSpan={4} className="px-5 py-8 text-center text-fog">Nenhuma clínica provisionada.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

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
