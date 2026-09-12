import { useEffect, useMemo, useState } from 'react';
import {
  canIssueReferral,
  classifyReferralError,
  createReferralDraft,
  emptyReferralPayload,
  issueReferral,
  loadReferralDocuments,
  loadReferralTemplates,
  referralPriorityLabel,
  referralReadyToIssue,
  saveReferralDraft,
  type ReferralDocument,
  type ReferralPayload,
  type ReferralPriority,
  type ReferralRecipient,
  type ReferralTemplate,
} from '../lib/clinicalReferral';
import type { Appointment, Patient } from '../lib/types';
import { Btn, Chip } from '../lib/ui';
import { useToast } from '../lib/toastContext';

type ClinicalReferralWorkspaceProps = {
  patient: Patient;
  encounter: Appointment;
  userId: string;
};

const PRIORITIES: Array<{ value: ReferralPriority; label: string; detail: string }> = [
  { value: 'routine', label: 'Rotina', detail: 'Fluxo habitual' },
  { value: 'high', label: 'Alta', detail: 'Priorizar avaliação' },
  { value: 'urgent', label: 'Urgente', detail: 'Avaliação sem demora' },
];

export function ClinicalReferralWorkspace(props: ClinicalReferralWorkspaceProps) {
  const contextKey = `${props.patient.id}:${props.encounter.id}:${props.userId}`;
  return <ClinicalReferralWorkspaceContext key={contextKey} {...props} />;
}

function ClinicalReferralWorkspaceContext({ patient, encounter, userId }: ClinicalReferralWorkspaceProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [templates, setTemplates] = useState<ReferralTemplate[]>([]);
  const [documents, setDocuments] = useState<ReferralDocument[]>([]);
  const [selectedTemplateVersionId, setSelectedTemplateVersionId] = useState('');
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [payload, setPayload] = useState<ReferralPayload>(() => emptyReferralPayload());
  const [dirty, setDirty] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const activeDocument = useMemo(
    () => documents.find((document) => document.id === activeDocumentId) ?? null,
    [activeDocumentId, documents],
  );
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.currentVersionId === selectedTemplateVersionId) ?? templates[0] ?? null,
    [selectedTemplateVersionId, templates],
  );
  const history = useMemo(() => documents.filter((document) => document.status !== 'draft'), [documents]);
  const currentEncounterHistory = useMemo(
    () => history.filter((document) => document.appointmentId === encounter.id),
    [encounter.id, history],
  );
  const priorHistory = useMemo(
    () => history.filter((document) => document.appointmentId !== encounter.id),
    [encounter.id, history],
  );
  const readyToIssue = referralReadyToIssue(payload);
  const patientName = patient.preferredName || patient.nome;

  useEffect(() => {
    let active = true;
    void (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const canIssue = await canIssueReferral();
        if (!active) return;
        setEligible(canIssue);
        if (!canIssue) {
          setTemplates([]);
          setDocuments([]);
          setActiveDocumentId(null);
          return;
        }

        const [availableTemplates, patientDocuments] = await Promise.all([
          loadReferralTemplates(),
          loadReferralDocuments(patient.id),
        ]);
        if (!active) return;
        setTemplates(availableTemplates);
        setDocuments(patientDocuments);
        setSelectedTemplateVersionId(availableTemplates[0]?.currentVersionId ?? '');

        const draft = patientDocuments.find((document) => (
          document.status === 'draft'
          && document.appointmentId === encounter.id
          && document.issuerId === userId
        ));
        if (draft) {
          setActiveDocumentId(draft.id);
          setPayload(draft.payload);
          setDirty(false);
        }
      } catch (error) {
        console.error('[MedicsPro] carregar Encaminhamento V1:', error);
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [encounter.id, patient.id, userId]);

  const replaceDocument = (next: ReferralDocument) => {
    setDocuments((current) => {
      const exists = current.some((document) => document.id === next.id);
      return exists ? current.map((document) => document.id === next.id ? next : document) : [next, ...current];
    });
  };

  const explainError = (error: unknown, action: 'criar' | 'salvar' | 'emitir') => {
    const kind = classifyReferralError(error);
    if (kind === 'eligibility') return 'Sua identidade clínica atual não permite emitir encaminhamentos.';
    if (kind === 'active_encounter') return 'O encaminhamento só pode ser alterado ou emitido durante seu atendimento ativo.';
    if (kind === 'payload') return 'Informe ao menos um destino identificável e o motivo do encaminhamento.';
    if (kind === 'draft') return 'Este rascunho já não pode ser alterado.';
    return `Não foi possível ${action} o encaminhamento agora.`;
  };

  const startDraft = async () => {
    if (!selectedTemplateVersionId || creating) return;
    setCreating(true);
    try {
      const next = await createReferralDraft(encounter.id, selectedTemplateVersionId, emptyReferralPayload());
      replaceDocument(next);
      setActiveDocumentId(next.id);
      setPayload(next.payload);
      setDirty(false);
      setReviewing(false);
      toast('Rascunho de encaminhamento criado.');
    } catch (error) {
      console.error('[MedicsPro] criar encaminhamento:', error);
      toast(explainError(error, 'criar'), 'warn');
    } finally {
      setCreating(false);
    }
  };

  const saveDraft = async (): Promise<ReferralDocument | null> => {
    if (!activeDocument || activeDocument.status !== 'draft' || saving) return activeDocument;
    setSaving(true);
    try {
      const saved = await saveReferralDraft(activeDocument.id, payload);
      replaceDocument(saved);
      setPayload(saved.payload);
      setDirty(false);
      toast('Rascunho do encaminhamento salvo.');
      return saved;
    } catch (error) {
      console.error('[MedicsPro] salvar encaminhamento:', error);
      toast(explainError(error, 'salvar'), 'warn');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const confirmIssue = async () => {
    if (!activeDocument || activeDocument.status !== 'draft' || issuing || !readyToIssue) return;
    setIssuing(true);
    try {
      let documentToIssue = activeDocument;
      if (dirty) {
        const saved = await saveReferralDraft(activeDocument.id, payload);
        replaceDocument(saved);
        documentToIssue = saved;
      }
      const issued = await issueReferral(documentToIssue.id);
      replaceDocument(issued);
      setActiveDocumentId(null);
      setPayload(emptyReferralPayload());
      setDirty(false);
      setReviewing(false);
      toast('Encaminhamento emitido e registrado no histórico.');
    } catch (error) {
      console.error('[MedicsPro] emitir encaminhamento:', error);
      toast(explainError(error, 'emitir'), 'warn');
    } finally {
      setIssuing(false);
    }
  };

  const updateRecipient = (patch: Partial<ReferralRecipient>) => {
    setPayload((current) => ({ ...current, recipient: { ...current.recipient, ...patch } }));
    setDirty(true);
    setReviewing(false);
  };

  const updatePayload = (patch: Partial<ReferralPayload>) => {
    setPayload((current) => ({ ...current, ...patch }));
    setDirty(true);
    setReviewing(false);
  };

  if (loading) return <ReferralState>Verificando elegibilidade e histórico de encaminhamentos…</ReferralState>;
  if (loadError) return <ReferralState tone="error">Não foi possível carregar Encaminhamentos. Atualize a página antes de tentar novamente.</ReferralState>;
  if (!eligible) return <ReferralState tone="muted">Encaminhamento não está disponível para sua identidade clínica atual. A autorização permanece definida pelo servidor.</ReferralState>;
  if (templates.length === 0) return <ReferralState tone="error">Nenhum modelo de encaminhamento elegível está disponível neste atendimento.</ReferralState>;

  return (
    <div className="space-y-4" data-clinical-referral-version="1">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] xl:items-start">
        <section className="rounded-2xl border border-line/65 bg-deep/25 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-aqua">Encaminhamento clínico</p>
              <h3 className="mt-1 font-display text-[17px] font-semibold text-paper">{activeDocument ? 'Rascunho deste atendimento' : 'Novo encaminhamento'}</h3>
              <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-fog">Organize o destino e o contexto clínico que o próximo profissional realmente precisa receber. O rascunho pode ser salvo incompleto.</p>
            </div>
            {activeDocument && <Chip className="border-amber/35 text-amber">Rascunho · {dirty ? 'alterações não salvas' : 'salvo'}</Chip>}
          </div>

          {!activeDocument ? (
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label className="grid gap-1.5 text-[11px] font-semibold text-fog">Modelo
                <select value={selectedTemplateVersionId} onChange={(event) => setSelectedTemplateVersionId(event.target.value)} className="min-h-10 rounded-xl border border-line bg-panel px-3 text-[12px] text-paper outline-none focus:border-aqua/60">
                  {templates.map((template) => <option key={template.id} value={template.currentVersionId}>{template.name}</option>)}
                </select>
              </label>
              <Btn disabled={!selectedTemplateVersionId || creating} onClick={() => void startDraft()}>{creating ? 'Criando…' : 'Criar encaminhamento'}</Btn>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-[11px] font-semibold text-fog">Prioridade</legend>
                <div className="grid gap-2 sm:grid-cols-3">{PRIORITIES.map((option) => {
                  const selected = payload.priority === option.value;
                  return <button key={option.value} type="button" aria-pressed={selected} onClick={() => updatePayload({ priority: option.value })} className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${selected ? 'border-aqua/45 bg-aqua/[0.07]' : 'border-line bg-panel hover:border-aqua/25'}`}><span className={`block text-[11.5px] font-semibold ${selected ? 'text-aqua' : 'text-paper'}`}>{option.label}</span><span className="mt-0.5 block text-[9.5px] text-fog">{option.detail}</span></button>;
                })}</div>
              </fieldset>

              <fieldset className="rounded-xl border border-line/65 bg-panel/65 p-3">
                <legend className="px-1 text-[11.5px] font-semibold text-paper">Destino do encaminhamento *</legend>
                <p className="mb-3 mt-1 text-[10.5px] leading-relaxed text-fog">Preencha o que souber. Basta identificar de forma clara um profissional, profissão, especialidade, serviço ou instituição.</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Field label="Profissional" value={payload.recipient.professionalName} placeholder="Ex.: Dra. Ana Silva" onChange={(value) => updateRecipient({ professionalName: value })} />
                  <Field label="Profissão" value={payload.recipient.professionalType} placeholder="Ex.: Cardiologista, Psicólogo, Fisioterapeuta" onChange={(value) => updateRecipient({ professionalType: value })} />
                  <Field label="Especialidade" value={payload.recipient.specialty} placeholder="Ex.: Cardiologia" onChange={(value) => updateRecipient({ specialty: value })} />
                  <Field label="Serviço" value={payload.recipient.service} placeholder="Ex.: Avaliação cardiológica" onChange={(value) => updateRecipient({ service: value })} />
                  <Field label="Instituição / local" value={payload.recipient.facility} placeholder="Ex.: Serviço de referência" onChange={(value) => updateRecipient({ facility: value })} />
                  <Field label="Contato" value={payload.recipient.contact} placeholder="Telefone, e-mail ou orientação de contato" onChange={(value) => updateRecipient({ contact: value })} />
                </div>
              </fieldset>

              <TextArea label="Motivo do encaminhamento *" value={payload.reason} rows={3} placeholder="Descreva de forma objetiva por que o paciente está sendo encaminhado." onChange={(value) => updatePayload({ reason: value })} />
              <TextArea label="Resumo clínico relevante" value={payload.clinicalSummary} rows={4} placeholder="Inclua somente informações necessárias para a continuidade do cuidado." onChange={(value) => updatePayload({ clinicalSummary: value })} />
              <TextArea label="Avaliação / ação solicitada" value={payload.requestedAction} rows={3} placeholder="Ex.: avaliação especializada e conduta conforme julgamento do profissional de destino." onChange={(value) => updatePayload({ requestedAction: value })} />
              <TextArea label="Observações" value={payload.observations} rows={2} placeholder="Informações complementares opcionais." onChange={(value) => updatePayload({ observations: value })} />

              <div className="flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
                <Btn variant="subtle" disabled={saving || issuing} onClick={() => void saveDraft()}>{saving ? 'Salvando…' : dirty ? 'Salvar rascunho' : 'Rascunho salvo'}</Btn>
                {!reviewing ? (
                  <Btn disabled={!readyToIssue || saving} onClick={() => setReviewing(true)}>Revisar encaminhamento</Btn>
                ) : (
                  <>
                    <Btn variant="subtle" disabled={issuing} onClick={() => setReviewing(false)}>Voltar à edição</Btn>
                    <Btn disabled={!readyToIssue || issuing} onClick={() => void confirmIssue()}>{issuing ? 'Emitindo…' : 'Confirmar emissão'}</Btn>
                  </>
                )}
                {!readyToIssue && <span className="text-[10.5px] text-amber">Informe um destino e o motivo antes da emissão.</span>}
              </div>
            </div>
          )}
        </section>

        <ReferralPreview patientName={patientName} payload={payload} templateName={selectedTemplate?.name ?? 'Encaminhamento clínico'} reviewing={reviewing} />
      </div>

      <ReferralHistory title="Encaminhamentos deste atendimento" documents={currentEncounterHistory} empty="Nenhum encaminhamento emitido neste atendimento." />
      {priorHistory.length > 0 && <ReferralHistory title="Histórico anterior" documents={priorHistory} empty="" />}
    </div>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-[10.5px] font-semibold text-fog">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-10 rounded-xl border border-line bg-deep/35 px-3 text-[12px] text-paper outline-none focus:border-aqua/60" /></label>;
}

function TextArea({ label, value, placeholder, rows, onChange }: { label: string; value: string; placeholder: string; rows: number; onChange: (value: string) => void }) {
  return <label className="grid gap-1.5 text-[10.5px] font-semibold text-fog">{label}<textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="resize-y rounded-xl border border-line bg-panel px-3 py-2.5 text-[12px] leading-relaxed text-paper outline-none focus:border-aqua/60" /></label>;
}

function recipientLabel(recipient: ReferralRecipient): string {
  return [recipient.professionalName, recipient.specialty, recipient.service, recipient.facility]
    .map((value) => value.trim())
    .filter(Boolean)
    .join(' · ') || 'Destino ainda não informado';
}

function ReferralPreview({ patientName, payload, templateName, reviewing }: { patientName: string; payload: ReferralPayload; templateName: string; reviewing: boolean }) {
  return (
    <aside className="rounded-2xl border border-line/65 bg-deep/25 p-4 xl:sticky xl:top-24">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-aqua">Prévia de conteúdo</p><p className="mt-1 text-[11px] text-fog">A composição A4 profissional será publicada na próxima slice.</p></div>
        <Chip className="border-amber/35 text-amber">Sem validade</Chip>
      </div>
      <div className="mt-4 rounded-xl border border-line/70 bg-panel p-4">
        <p className="text-center text-[10px] font-semibold uppercase tracking-[0.13em] text-aqua">{templateName}</p>
        <p className="mt-3 text-[10.5px] text-fog">Paciente</p><p className="text-[12px] font-semibold text-paper">{patientName}</p>
        <div className="mt-3 grid gap-3 border-t border-line/60 pt-3">
          <PreviewBlock label="Destino" value={recipientLabel(payload.recipient)} />
          <PreviewBlock label="Prioridade" value={referralPriorityLabel(payload.priority)} />
          <PreviewBlock label="Motivo" value={payload.reason || 'Motivo ainda não informado.'} />
          {payload.clinicalSummary && <PreviewBlock label="Resumo clínico" value={payload.clinicalSummary} />}
          {payload.requestedAction && <PreviewBlock label="Avaliação / ação solicitada" value={payload.requestedAction} />}
          {payload.observations && <PreviewBlock label="Observações" value={payload.observations} />}
          {payload.recipient.contact && <PreviewBlock label="Contato do destino" value={payload.recipient.contact} />}
        </div>
      </div>
      {reviewing && <div className="mt-3 rounded-xl border border-mint/30 bg-mint/[0.045] px-3 py-2.5"><p className="text-[11px] font-semibold text-mint">Revisão humana obrigatória</p><p className="mt-1 text-[10.5px] leading-relaxed text-fog">Confirme destinatário, motivo e informações compartilhadas antes de emitir. A emissão congela o snapshot clínico.</p></div>}
    </aside>
  );
}

function PreviewBlock({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-fog">{label}</p><p className="mt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed text-paper/90">{value}</p></div>;
}

function ReferralHistory({ title, documents, empty }: { title: string; documents: ReferralDocument[]; empty: string }) {
  return (
    <section className="rounded-2xl border border-line/65 bg-deep/20 p-4">
      <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-display text-[14px] font-semibold text-paper">{title}</h3><Chip>{documents.length}</Chip></div>
      {documents.length === 0 ? <p className="text-[11px] text-fog">{empty}</p> : <div className="space-y-2">{documents.map((document) => {
        const content = document.payloadSnapshot ?? document.payload;
        return <article key={document.id} className="rounded-xl border border-line/60 bg-panel/70 p-3"><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0 flex-1"><p className="text-[11.5px] font-semibold text-paper">{recipientLabel(content.recipient)}</p><p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-fog">{content.reason || 'Motivo não registrado'}</p><p className="mt-2 font-mono text-[9px] text-fog">{document.documentIdentifier} · {document.issuedAt ? new Date(document.issuedAt).toLocaleString('pt-BR') : document.createdAt}</p></div><Chip className={document.status === 'issued' ? 'border-mint/35 text-mint' : 'border-pulse/35 text-pulse'}>{document.status === 'issued' ? 'Emitido' : 'Cancelado'}</Chip></div><p className="mt-2 text-[9.5px] text-fog">Conteúdo emitido preservado em snapshot; futuras alterações do modelo não reescrevem este documento.</p></article>;
      })}</div>}
    </section>
  );
}

function ReferralState({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'error' | 'muted' }) {
  const className = tone === 'error' ? 'border-pulse/30 bg-pulse/[0.04] text-pulse' : tone === 'muted' ? 'border-line/65 bg-deep/30 text-fog' : 'border-aqua/25 bg-aqua/[0.035] text-fog';
  return <div className={`rounded-xl border px-4 py-3 text-[11.5px] leading-relaxed ${className}`}>{children}</div>;
}
