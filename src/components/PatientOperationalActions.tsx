import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { openConsentDocument } from '../lib/consentDocument';
import { supabase } from '../lib/supabaseClient';
import { useClinical } from '../lib/clinicalContext';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Chip, Select } from '../lib/ui';

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
  const { refreshClinical } = useClinical();
  const nav = useNavigate();
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [templateId, setTemplateId] = useState('');
  const [busy, setBusy] = useState(false);
  const [consentOpen, setConsentOpen] = useState(false);

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
    void load().catch((error) => console.error('[MedicsPro] consentimentos do paciente:', error));
  }, [patient.id]);

  const pending = useMemo(() => consents.find((c) => !c.assinado && !c.canceled_at), [consents]);
  const signed = useMemo(() => consents.find((c) => c.assinado && !c.canceled_at), [consents]);
  const signedHistory = useMemo(() => consents.filter((c) => c.assinado && !c.canceled_at), [consents]);
  const canceled = useMemo(() => consents.filter((c) => !!c.canceled_at), [consents]);

  const createConsent = async () => {
    if (!templateId) return;
    setBusy(true);
    try {
      const { error } = await db.rpc('create_patient_consent', { p_patient_id: patient.id, p_template_id: templateId });
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
      const { error } = await db.rpc('accept_patient_consent', { p_consent_id: id, p_ip: null, p_user_agent: navigator.userAgent });
      if (error) throw error;
      await load();
      await refreshClinical();
      toast('Aceite registrado com data, usuário e versão do termo.');
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
      const { error } = await db.rpc('cancel_patient_consent', { p_consent_id: id, p_reason: 'Substituído por nova versão ou corrigido operacionalmente' });
      if (error) throw error;
      await load();
      toast('Consentimento pendente cancelado.');
    } catch (error) {
      console.error('[MedicsPro] cancelar consentimento:', error);
      toast('Não foi possível cancelar o consentimento pendente.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const viewConsent = (document: ConsentRow) => {
    try {
      openConsentDocument(document);
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Não foi possível abrir o documento.', 'warn');
    }
  };

  const canCollect = user?.role === 'owner' || user?.role === 'admin' || user?.role === 'recep' || user?.role === 'financeiro';

  return (
    <section className="border-y border-line/60 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-mint">Próxima ação</p>
          <p className="mt-0.5 text-[13.5px] text-paper/90">
            Continue o cuidado sem perder o contexto do paciente.
          </p>
        </div>
        <Btn onClick={() => nav(`/agenda?patient=${encodeURIComponent(patient.id)}&action=new`)}>Agendar sessão</Btn>
        <button
          type="button"
          onClick={() => setConsentOpen((value) => !value)}
          className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold text-fog transition-colors hover:bg-raise hover:text-paper"
        >
          Consentimento
          {signed ? <Chip className="border-mint/30 bg-mint/10 text-mint">assinado</Chip> : <Chip className="border-amber/30 bg-amber/10 text-amber">pendente</Chip>}
        </button>
      </div>

      {consentOpen && (
        <div className="mt-3 border-t border-line/50 pt-3">
          {pending ? (
            <div className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <p className="font-semibold text-[13.5px]">{pending.nome} · v{pending.versao}</p>
                <p className="mt-1 line-clamp-2 text-[12.5px] text-fog">{pending.conteudo_snapshot || 'Documento versionado aguardando aceite.'}</p>
              </div>
              {canCollect && <div className="flex gap-2"><Btn variant="subtle" onClick={() => acceptConsent(pending.id)} disabled={busy}>Registrar aceite</Btn><Btn variant="ghost" onClick={() => cancelConsent(pending.id)} disabled={busy}>Cancelar</Btn></div>}
            </div>
          ) : signed ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-[13.5px]">{signed.nome} · v{signed.versao}</p>
                  <p className="mt-1 text-[12.5px] text-fog">Aceito {signed.data_assinatura ? new Date(signed.data_assinatura).toLocaleString('pt-BR') : 'em data não informada'}.</p>
                </div>
                <Btn variant="subtle" onClick={() => viewConsent(signed)}>Visualizar</Btn>
              </div>
              {signedHistory.length > 1 && <p className="text-[12px] text-fog">{signedHistory.length} versões assinadas preservadas no histórico.</p>}
              {templates.length > 0 && canCollect && (
                <div className="flex flex-wrap items-center gap-2 border-t border-line/50 pt-3">
                  <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="!w-auto min-w-[260px]">
                    {templates.map((template) => <option key={template.id} value={template.id}>{template.nome} · v{template.versao}</option>)}
                  </Select>
                  <Btn variant="ghost" onClick={createConsent} disabled={busy || !templateId}>Gerar nova versão</Btn>
                </div>
              )}
            </div>
          ) : templates.length === 0 ? (
            <p className="text-[12.5px] text-amber">Nenhum modelo ativo de consentimento.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <Select value={templateId} onChange={(event) => setTemplateId(event.target.value)} className="!w-auto min-w-[280px]">
                {templates.map((template) => <option key={template.id} value={template.id}>{template.nome} · v{template.versao}</option>)}
              </Select>
              {canCollect && <Btn variant="subtle" onClick={createConsent} disabled={busy || !templateId}>{busy ? 'Processando…' : 'Gerar consentimento'}</Btn>}
            </div>
          )}
          {canceled.length > 0 && <p className="mt-3 text-[11.5px] text-fog">{canceled.length} consentimento(s) cancelado(s) preservado(s).</p>}
        </div>
      )}
    </section>
  );
}