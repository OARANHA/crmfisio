import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Card, CardHead, Chip, Select } from '../lib/ui';

type ConsentTemplate = {
  id: string;
  nome: string;
  versao: string;
  conteudo: string;
  obrigatorio: boolean;
};

type ConsentRow = {
  id: string;
  nome: string;
  versao: string;
  assinado: boolean;
  data_assinatura: string | null;
  conteudo_snapshot: string | null;
  canceled_at: string | null;
  cancel_reason: string | null;
};

export function PatientOperationalActions({ patient }: { patient: Patient }) {
  const { user, toast } = useApp();
  const nav = useNavigate();
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState(false);

  const db = supabase as any;

  const load = async () => {
    const [templateResult, consentResult] = await Promise.all([
      db.from('consent_templates').select('id,nome,versao,conteudo,obrigatorio').eq('ativo', true).order('nome'),
      db.from('consent_terms').select('id,nome,versao,assinado,data_assinatura,conteudo_snapshot,canceled_at,cancel_reason').eq('patient_id', patient.id).order('created_at', { ascending: false }),
    ]);
    if (templateResult.error) throw templateResult.error;
    if (consentResult.error) throw consentResult.error;
    setTemplates(templateResult.data ?? []);
    setConsents(consentResult.data ?? []);
    if (!templateId && templateResult.data?.[0]) setTemplateId(templateResult.data[0].id);
  };

  useEffect(() => {
    void load().catch((error) => {
      console.error('[MedicsPro] consentimentos do paciente:', error);
    });
  }, [patient.id]);

  const pending = useMemo(() => consents.find((c) => !c.assinado && !c.canceled_at), [consents]);
  const signed = useMemo(() => consents.find((c) => c.assinado && !c.canceled_at), [consents]);
  const canceled = useMemo(() => consents.filter((c) => !!c.canceled_at), [consents]);

  const createConsent = async () => {
    if (!templateId) return;
    setBusy(true);
    try {
      const { error } = await db.rpc('create_patient_consent', {
        p_patient_id: patient.id,
        p_template_id: templateId,
      });
      if (error) throw error;
      await load();
      toast('Consentimento gerado e aguardando aceite do paciente.');
    } catch (error) {
      console.error('[MedicsPro] gerar consentimento:', error);
      toast('Não foi possível gerar o consentimento.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const acceptConsent = async (id: string) => {
    if (!window.confirm('Confirma que o paciente leu o termo exibido e manifestou aceite?')) return;
    setBusy(true);
    try {
      const { error } = await db.rpc('accept_patient_consent', {
        p_consent_id: id,
        p_ip: null,
        p_user_agent: navigator.userAgent,
      });
      if (error) throw error;
      await load();
      toast('Aceite registrado com data, usuário e versão do termo.');
      window.setTimeout(() => window.location.reload(), 450);
    } catch (error) {
      console.error('[MedicsPro] aceitar consentimento:', error);
      toast('Não foi possível registrar o aceite.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const cancelConsent = async (id: string) => {
    if (!window.confirm('Cancelar este consentimento pendente? O registro ficará preservado como cancelado.')) return;
    setBusy(true);
    try {
      const { error } = await db.rpc('cancel_patient_consent', {
        p_consent_id: id,
        p_reason: 'Substituído por nova versão ou corrigido operacionalmente',
      });
      if (error) throw error;
      await load();
      toast('Consentimento pendente cancelado. Agora você pode gerar a versão correta.');
    } catch (error) {
      console.error('[MedicsPro] cancelar consentimento:', error);
      toast('Não foi possível cancelar o consentimento pendente.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const scheduleNext = () => {
    nav(`/agenda?patient=${encodeURIComponent(patient.id)}&action=new`);
  };

  const canCollect = user?.role === 'admin' || user?.role === 'recep' || user?.role === 'fisio';

  return (
    <Card>
      <CardHead title="Próximas ações" sub="reduz cliques entre prontuário, agenda e documentação" />
      <div className="p-4 grid lg:grid-cols-2 gap-4">
        <div className="border border-line bg-deep p-4 flex flex-col gap-3">
          <div>
            <p className="font-display font-semibold text-[13.5px]">Continuidade do tratamento</p>
            <p className="text-[11.5px] text-fog mt-1">Abra a agenda já com este paciente selecionado.</p>
          </div>
          <Btn onClick={scheduleNext}>Agendar próxima sessão</Btn>
        </div>

        <div className="border border-line bg-deep p-4 space-y-3">
          <div className="flex items-start gap-2">
            <div className="flex-1">
              <p className="font-display font-semibold text-[13.5px]">Consentimento</p>
              <p className="text-[11.5px] text-fog mt-1">O texto e a versão aceitos ficam preservados no histórico.</p>
            </div>
            {signed ? <Chip className="border-mint/40 text-mint">assinado ✓</Chip> : <Chip className="border-amber/40 text-amber">pendente</Chip>}
          </div>

          {pending ? (
            <div className="space-y-3">
              <div className="border border-line/70 p-3">
                <p className="font-display font-semibold text-[12.5px]">{pending.nome} · v{pending.versao}</p>
                <p className="text-[11px] text-fog mt-2 whitespace-pre-wrap max-h-28 overflow-auto">{pending.conteudo_snapshot || 'Conteúdo versionado vinculado ao documento.'}</p>
              </div>
              {canCollect && (
                <div className="flex flex-wrap gap-2">
                  <Btn variant="subtle" onClick={() => acceptConsent(pending.id)} disabled={busy}>Registrar aceite</Btn>
                  <Btn variant="ghost" onClick={() => cancelConsent(pending.id)} disabled={busy}>Cancelar pendência</Btn>
                </div>
              )}
            </div>
          ) : signed ? (
            <div className="space-y-2">
              <p className="font-mono text-[10.5px] text-mint">Último aceite: {signed.nome} · versão {signed.versao}</p>
              {templates.length > 0 && canCollect && (
                <div className="space-y-2 border-t border-line/60 pt-3">
                  <p className="text-[10.5px] text-fog">Precisa coletar uma nova versão? Selecione o modelo vigente.</p>
                  <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                    {templates.map((t) => <option key={t.id} value={t.id}>{t.nome} · v{t.versao}</option>)}
                  </Select>
                  <Btn variant="ghost" onClick={createConsent} disabled={busy || !templateId}>Gerar nova versão para aceite</Btn>
                </div>
              )}
            </div>
          ) : templates.length === 0 ? (
            <p className="font-mono text-[10.5px] text-amber">Nenhum modelo ativo. O administrador deve criar um em Configurações.</p>
          ) : (
            <div className="space-y-2">
              <Select value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
                {templates.map((t) => <option key={t.id} value={t.id}>{t.nome} · v{t.versao}</option>)}
              </Select>
              {canCollect && <Btn variant="subtle" onClick={createConsent} disabled={busy || !templateId}>{busy ? 'Processando…' : 'Gerar consentimento'}</Btn>}
            </div>
          )}

          {canceled.length > 0 && (
            <p className="font-mono text-[9.5px] text-fog">Histórico: {canceled.length} consentimento(s) cancelado(s) preservado(s).</p>
          )}
        </div>
      </div>
    </Card>
  );
}
