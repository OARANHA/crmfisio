import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCurrentClinicIdentity, type ClinicIdentity } from '../lib/clinicConfiguration';
import {
  canIssueReferral,
  classifyReferralError,
  createReferralDraft,
  emptyReferralPayload,
  issueReferral,
  openReferralOperation,
  loadReferralDocuments,
  loadReferralInternalTargets,
  loadReferralTemplateRenderDefinition,
  loadReferralTemplates,
  referralDocumentRenderDefinition,
  referralPriorityLabel,
  referralReadyToIssue,
  saveReferralDraft,
  type ReferralDocument,
  type ReferralInternalTarget,
  type ReferralPayload,
  type ReferralPriority,
  type ReferralRecipient,
  type ReferralRecipientScope,
  type ReferralTemplate,
} from '../lib/clinicalReferral';
import { buildReferralDocumentHtml, buildReferralRenderContextFromSnapshot } from '../lib/referralPrintRenderer';
import type { Appointment, Patient } from '../lib/types';
import { Btn, Chip } from '../lib/ui';
import { useToast } from '../lib/toastContext';
import { ReferralDocumentPreview } from './ReferralDocumentPreview';

type ClinicalReferralWorkspaceProps = { patient: Patient; encounter: Appointment; userId: string };

const PRIORITIES: Array<{ value: ReferralPriority; label: string; detail: string }> = [
  { value: 'routine', label: 'Rotina', detail: 'Fluxo habitual' },
  { value: 'high', label: 'Alta', detail: 'Priorizar avaliação' },
  { value: 'urgent', label: 'Urgente', detail: 'Avaliação sem demora' },
];

const DESTINATION_MODES: Array<{ value: ReferralRecipientScope; label: string; detail: string }> = [
  { value: 'internal_professional', label: 'Profissional da clínica', detail: 'Encaminhar para uma pessoa específica da equipe' },
  { value: 'internal_service', label: 'Especialidade / serviço', detail: 'Direcionar para uma área clínica da própria clínica' },
  { value: 'external', label: 'Destino externo', detail: 'Profissional, serviço ou instituição fora da clínica' },
];

const EMPTY_CLINIC: ClinicIdentity = { id: '', name: 'Clínica', cnpj: null, phone: null, email: null, address: null, timezone: 'UTC' };

export function ClinicalReferralWorkspace(props: ClinicalReferralWorkspaceProps) {
  const contextKey = `${props.patient.id}:${props.encounter.id}:${props.userId}`;
  return <ClinicalReferralWorkspaceContext key={contextKey} {...props} />;
}

function ClinicalReferralWorkspaceContext({ patient, encounter, userId }: ClinicalReferralWorkspaceProps) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [templates, setTemplates] = useState<ReferralTemplate[]>([]);
  const [documents, setDocuments] = useState<ReferralDocument[]>([]);
  const [internalTargets, setInternalTargets] = useState<ReferralInternalTarget[]>([]);
  const [clinic, setClinic] = useState<ClinicIdentity>(EMPTY_CLINIC);
  const [selectedTemplateVersionId, setSelectedTemplateVersionId] = useState('');
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [activeRenderDefinition, setActiveRenderDefinition] = useState<unknown>(null);
  const [payload, setPayload] = useState<ReferralPayload>(() => emptyReferralPayload());
  const [dirty, setDirty] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const activeDocument = useMemo(() => documents.find((document) => document.id === activeDocumentId) ?? null, [activeDocumentId, documents]);
  const selectedTemplate = useMemo(() => templates.find((template) => template.currentVersionId === selectedTemplateVersionId) ?? templates[0] ?? null, [selectedTemplateVersionId, templates]);
  const previewRenderDefinition = activeDocument ? activeRenderDefinition : selectedTemplate?.renderDefinition;
  const history = useMemo(() => documents.filter((document) => document.status !== 'draft'), [documents]);
  const currentEncounterHistory = useMemo(() => history.filter((document) => document.appointmentId === encounter.id), [encounter.id, history]);
  const priorHistory = useMemo(() => history.filter((document) => document.appointmentId !== encounter.id), [encounter.id, history]);
  const serviceOptions = useMemo(() => Array.from(new Map(internalTargets.map((target) => {
    const label = target.specialty || target.professionalType;
    return label ? [label.toLocaleLowerCase('pt-BR'), { label, professionalType: target.professionalType, specialty: target.specialty }] : null;
  }).filter((item): item is [string, { label: string; professionalType: string; specialty: string }] => Boolean(item))).values())
    .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR')), [internalTargets]);
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
          setTemplates([]); setDocuments([]); setInternalTargets([]); setActiveDocumentId(null); setActiveRenderDefinition(null); return;
        }
        const [availableTemplates, patientDocuments, clinicIdentity, targets] = await Promise.all([
          loadReferralTemplates(), loadReferralDocuments(patient.id), getCurrentClinicIdentity().catch(() => EMPTY_CLINIC), loadReferralInternalTargets(),
        ]);
        if (!active) return;
        setTemplates(availableTemplates); setDocuments(patientDocuments); setClinic(clinicIdentity); setInternalTargets(targets);
        setSelectedTemplateVersionId(availableTemplates[0]?.currentVersionId ?? '');
        const draft = patientDocuments.find((document) => document.status === 'draft' && document.appointmentId === encounter.id && document.issuerId === userId);
        if (draft) {
          setActiveDocumentId(draft.id); setPayload(draft.payload); setDirty(false);
          const currentTemplate = availableTemplates.find((template) => template.currentVersionId === draft.templateVersionId);
          if (currentTemplate) setActiveRenderDefinition(currentTemplate.renderDefinition);
          else {
            try {
              const renderDefinition = await loadReferralTemplateRenderDefinition(draft.templateVersionId);
              if (active) setActiveRenderDefinition(renderDefinition);
            } catch (error) {
              console.warn('[MedicsPro] renderer histórico do rascunho de encaminhamento indisponível; usando fallback seguro:', error);
              if (active) setActiveRenderDefinition(null);
            }
          }
        }
      } catch (error) {
        console.error('[MedicsPro] carregar Encaminhamento V1:', error);
        if (active) setLoadError(true);
      } finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [encounter.id, patient.id, userId]);

  const replaceDocument = (next: ReferralDocument) => setDocuments((current) => current.some((document) => document.id === next.id)
    ? current.map((document) => document.id === next.id ? next : document) : [next, ...current]);

  const explainError = (error: unknown, action: 'criar' | 'salvar' | 'emitir') => {
    const kind = classifyReferralError(error);
    if (kind === 'eligibility') return 'Sua identidade clínica atual não permite emitir encaminhamentos.';
    if (kind === 'active_encounter') return 'O encaminhamento só pode ser alterado ou emitido durante seu atendimento ativo.';
    if (kind === 'target') return 'O profissional interno escolhido não está mais disponível nesta clínica. Escolha outro destino.';
    if (kind === 'payload') return 'Informe um destino válido e o motivo do encaminhamento.';
    if (kind === 'draft') return 'Este rascunho já não pode ser alterado.';
    return `Não foi possível ${action} o encaminhamento agora.`;
  };

  const startDraft = async () => {
    if (!selectedTemplateVersionId || creating) return;
    setCreating(true);
    try {
      const next = await createReferralDraft(encounter.id, selectedTemplateVersionId, emptyReferralPayload());
      replaceDocument(next); setActiveDocumentId(next.id); setActiveRenderDefinition(selectedTemplate?.renderDefinition ?? null);
      setPayload(next.payload); setDirty(false); setReviewing(false); toast('Rascunho de encaminhamento criado.');
    } catch (error) { console.error('[MedicsPro] criar encaminhamento:', error); toast(explainError(error, 'criar'), 'warn'); }
    finally { setCreating(false); }
  };

  const saveDraft = async (): Promise<ReferralDocument | null> => {
    if (!activeDocument || activeDocument.status !== 'draft' || saving) return activeDocument;
    setSaving(true);
    try {
      const saved = await saveReferralDraft(activeDocument.id, payload);
      replaceDocument(saved); setPayload(saved.payload); setDirty(false); toast('Rascunho do encaminhamento salvo.'); return saved;
    } catch (error) { console.error('[MedicsPro] salvar encaminhamento:', error); toast(explainError(error, 'salvar'), 'warn'); return null; }
    finally { setSaving(false); }
  };

  const confirmIssue = async () => {
    if (!activeDocument || activeDocument.status !== 'draft' || issuing || !readyToIssue) return;
    setIssuing(true);
    try {
      let documentToIssue = activeDocument;
      if (dirty) { const saved = await saveReferralDraft(activeDocument.id, payload); replaceDocument(saved); documentToIssue = saved; }
      const issued = await issueReferral(documentToIssue.id);
      replaceDocument(issued); setActiveDocumentId(null); setActiveRenderDefinition(null); setPayload(emptyReferralPayload());
      setDirty(false); setReviewing(false); toast('Encaminhamento emitido e registrado no histórico.');
    } catch (error) { console.error('[MedicsPro] emitir encaminhamento:', error); toast(explainError(error, 'emitir'), 'warn'); }
    finally { setIssuing(false); }
  };

  const scheduleInternalReferral = async (document: ReferralDocument) => {
    try {
      const operation = await openReferralOperation(document.id);
      if (operation.appointmentId) { toast('Este encaminhamento já possui um agendamento vinculado.', 'warn'); return; }
      navigate(`/agenda?referral_operation=${document.id}`);
    } catch (error) { console.error('[MedicsPro] continuidade de encaminhamento:', error); toast('Não foi possível iniciar a continuidade operacional.', 'warn'); }
  };

  const updateRecipient = (patch: Partial<ReferralRecipient>) => { setPayload((current) => ({ ...current, recipient: { ...current.recipient, ...patch } })); setDirty(true); setReviewing(false); };
  const updatePayload = (patch: Partial<ReferralPayload>) => { setPayload((current) => ({ ...current, ...patch })); setDirty(true); setReviewing(false); };
  const changeScope = (scope: ReferralRecipientScope) => updateRecipient({
    scope, targetProfileId: '', professionalName: '', professionalType: '', specialty: '', service: '',
    facility: '', contact: '',
  });
  const chooseInternalProfessional = (profileId: string) => {
    const target = internalTargets.find((item) => item.profileId === profileId);
    if (!target) return updateRecipient({ targetProfileId: '', professionalName: '', professionalType: '', specialty: '', service: '', facility: '', contact: '' });
    updateRecipient({ targetProfileId: target.profileId, professionalName: target.name, professionalType: target.professionalType, specialty: target.specialty, service: '', facility: clinic.name, contact: '' });
  };
  const chooseInternalService = (label: string) => {
    const option = serviceOptions.find((item) => item.label === label);
    if (!option) return updateRecipient({ targetProfileId: '', professionalName: '', professionalType: '', specialty: '', service: '', facility: '', contact: '' });
    updateRecipient({ targetProfileId: '', professionalName: '', professionalType: option.professionalType, specialty: option.specialty, service: option.specialty ? '' : option.label, facility: clinic.name, contact: '' });
  };

  if (loading) return <ReferralState>Verificando elegibilidade e histórico de encaminhamentos…</ReferralState>;
  if (loadError) return <ReferralState tone="error">Não foi possível carregar Encaminhamentos. Atualize a página antes de tentar novamente.</ReferralState>;
  if (!eligible) return <ReferralState tone="muted">Encaminhamento não está disponível para sua identidade clínica atual. A autorização permanece definida pelo servidor.</ReferralState>;
  if (templates.length === 0) return <ReferralState tone="error">Nenhum modelo de encaminhamento elegível está disponível neste atendimento.</ReferralState>;

  return (
    <div className="space-y-4" data-clinical-referral-version="3">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] xl:items-start">
        <section className="rounded-2xl border border-line/65 bg-deep/25 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-aqua">Encaminhamento clínico</p><h3 className="mt-1 font-display text-[17px] font-semibold text-paper">{activeDocument ? 'Rascunho deste atendimento' : 'Novo encaminhamento'}</h3><p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-fog">Organize o destino e o contexto clínico que o próximo profissional realmente precisa receber. O rascunho pode ser salvo incompleto.</p></div>{activeDocument && <Chip className="border-amber/35 text-amber">Rascunho · {dirty ? 'alterações não salvas' : 'salvo'}</Chip>}</div>
          {!activeDocument ? (
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end"><label className="grid gap-1.5 text-[11px] font-semibold text-fog">Modelo<select value={selectedTemplateVersionId} onChange={(event) => setSelectedTemplateVersionId(event.target.value)} className="min-h-10 rounded-xl border border-line bg-panel px-3 text-[12px] text-paper outline-none focus:border-aqua/60">{templates.map((template) => <option key={template.id} value={template.currentVersionId}>{template.name}</option>)}</select></label><Btn disabled={!selectedTemplateVersionId || creating} onClick={() => void startDraft()}>{creating ? 'Criando…' : 'Criar encaminhamento'}</Btn></div>
          ) : (
            <div className="mt-4 space-y-4">
              <fieldset className="space-y-2"><legend className="text-[11px] font-semibold text-fog">Prioridade</legend><div className="grid gap-2 sm:grid-cols-3">{PRIORITIES.map((option) => { const selected = payload.priority === option.value; return <button key={option.value} type="button" aria-pressed={selected} onClick={() => updatePayload({ priority: option.value })} className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${selected ? 'border-aqua/45 bg-aqua/[0.07]' : 'border-line bg-panel hover:border-aqua/25'}`}><span className={`block text-[11.5px] font-semibold ${selected ? 'text-aqua' : 'text-paper'}`}>{option.label}</span><span className="mt-0.5 block text-[9.5px] text-fog">{option.detail}</span></button>; })}</div></fieldset>
              <fieldset className="rounded-xl border border-line/65 bg-panel/65 p-3">
                <legend className="px-1 text-[11.5px] font-semibold text-paper">Destino do encaminhamento *</legend>
                <div className="mb-3 grid gap-2 md:grid-cols-3">{DESTINATION_MODES.map((option) => { const selected = payload.recipient.scope === option.value; return <button key={option.value} type="button" aria-pressed={selected} onClick={() => changeScope(option.value)} className={`rounded-xl border px-3 py-2.5 text-left ${selected ? 'border-aqua/45 bg-aqua/[0.07]' : 'border-line bg-deep/25'}`}><span className={`block text-[11px] font-semibold ${selected ? 'text-aqua' : 'text-paper'}`}>{option.label}</span><span className="mt-0.5 block text-[9.5px] leading-snug text-fog">{option.detail}</span></button>; })}</div>
                {payload.recipient.scope === 'internal_professional' && <label className="grid gap-1.5 text-[10.5px] font-semibold text-fog">Profissional da clínica<select value={payload.recipient.targetProfileId} onChange={(event) => chooseInternalProfessional(event.target.value)} className="min-h-10 rounded-xl border border-line bg-deep/35 px-3 text-[12px] text-paper outline-none focus:border-aqua/60"><option value="">Selecione um profissional</option>{internalTargets.map((target) => <option key={target.profileId} value={target.profileId}>{target.name}{target.specialty ? ` · ${target.specialty}` : target.professionalType ? ` · ${target.professionalType}` : ''}</option>)}</select><span className="text-[9.5px] font-normal text-fog">A seleção identifica o destino, mas não concede acesso ao prontuário nem cria vínculo assistencial automaticamente.</span></label>}
                {payload.recipient.scope === 'internal_service' && <label className="grid gap-1.5 text-[10.5px] font-semibold text-fog">Especialidade / área clínica<select value={payload.recipient.specialty || payload.recipient.service || payload.recipient.professionalType} onChange={(event) => chooseInternalService(event.target.value)} className="min-h-10 rounded-xl border border-line bg-deep/35 px-3 text-[12px] text-paper outline-none focus:border-aqua/60"><option value="">Selecione uma área</option>{serviceOptions.map((option) => <option key={option.label} value={option.label}>{option.label}</option>)}</select><span className="text-[9.5px] font-normal text-fog">As áreas são derivadas dos profissionais clínicos ativos da própria clínica; especialidade continua sendo roteamento, não autorização.</span></label>}
                {payload.recipient.scope === 'external' && <><p className="mb-3 text-[10.5px] leading-relaxed text-fog">Preencha o que souber sobre o destino externo.</p><div className="grid gap-3 sm:grid-cols-2"><Field label="Profissional" value={payload.recipient.professionalName} placeholder="Ex.: Dra. Ana Silva" onChange={(value) => updateRecipient({ professionalName: value })} /><Field label="Profissão" value={payload.recipient.professionalType} placeholder="Ex.: Psicólogo, Fisioterapeuta, Médico" onChange={(value) => updateRecipient({ professionalType: value })} /><Field label="Especialidade" value={payload.recipient.specialty} placeholder="Ex.: Cardiologia" onChange={(value) => updateRecipient({ specialty: value })} /><Field label="Serviço" value={payload.recipient.service} placeholder="Ex.: Avaliação cardiológica" onChange={(value) => updateRecipient({ service: value })} /><Field label="Instituição / local" value={payload.recipient.facility} placeholder="Ex.: Serviço de referência" onChange={(value) => updateRecipient({ facility: value })} /><Field label="Contato" value={payload.recipient.contact} placeholder="Telefone, e-mail ou orientação de contato" onChange={(value) => updateRecipient({ contact: value })} /></div></>}
                {payload.recipient.scope !== 'external' && recipientLabel(payload.recipient) !== 'Destino ainda não informado' && <div className="mt-3 rounded-xl border border-line/60 bg-deep/25 px-3 py-2 text-[10.5px] text-fog"><span className="font-semibold text-paper">Destino:</span> {recipientLabel(payload.recipient)}</div>}
              </fieldset>
              <TextArea label="Motivo do encaminhamento *" value={payload.reason} rows={3} placeholder="Descreva de forma objetiva por que o paciente está sendo encaminhado." onChange={(value) => updatePayload({ reason: value })} />
              <TextArea label="Resumo clínico relevante" value={payload.clinicalSummary} rows={4} placeholder="Inclua somente informações necessárias para a continuidade do cuidado." onChange={(value) => updatePayload({ clinicalSummary: value })} />
              <TextArea label="Avaliação / ação solicitada" value={payload.requestedAction} rows={3} placeholder="Ex.: avaliação especializada e conduta conforme julgamento do profissional de destino." onChange={(value) => updatePayload({ requestedAction: value })} />
              <TextArea label="Observações" value={payload.observations} rows={2} placeholder="Informações complementares opcionais." onChange={(value) => updatePayload({ observations: value })} />
              <div className="flex flex-wrap items-center gap-2 border-t border-line/60 pt-3"><Btn variant="subtle" disabled={saving || issuing || !dirty} onClick={() => void saveDraft()}>{saving ? 'Salvando…' : 'Salvar rascunho'}</Btn><Btn disabled={!readyToIssue || saving || issuing} onClick={() => setReviewing(true)}>Revisar encaminhamento</Btn>{!readyToIssue && <span className="text-[10.5px] text-amber">Informe um destino e o motivo antes da emissão.</span>}</div>
            </div>
          )}
        </section>
        <aside className="space-y-3 xl:sticky xl:top-20"><ReferralDocumentPreview patient={patient} payload={payload} renderDefinition={previewRenderDefinition} clinic={clinic} />{reviewing && activeDocument && <section className="rounded-2xl border border-mint/35 bg-mint/[0.045] p-4"><p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mint">Revisão humana obrigatória</p><h4 className="mt-1 font-display text-[15px] font-semibold text-paper">Confirmar emissão</h4><p className="mt-2 text-[11px] leading-relaxed text-fog">Confirme destino, motivo e informações compartilhadas. Ao emitir, conteúdo, contexto e definição visual serão congelados em snapshots imutáveis.</p><div className="mt-3 flex flex-wrap gap-2"><Btn disabled={issuing || !readyToIssue} onClick={() => void confirmIssue()}>{issuing ? 'Emitindo…' : 'Emitir encaminhamento'}</Btn><Btn variant="subtle" disabled={issuing} onClick={() => setReviewing(false)}>Voltar à edição</Btn></div></section>}</aside>
      </div>
      <ReferralHistory title="Encaminhamentos deste atendimento" documents={currentEncounterHistory} patientName={patientName} empty="Nenhum encaminhamento emitido neste atendimento." onSchedule={scheduleInternalReferral} />
      {priorHistory.length > 0 && <ReferralHistory title="Histórico anterior" documents={priorHistory} patientName={patientName} empty="" compact onSchedule={scheduleInternalReferral} />}
      <p className="sr-only">A impressão histórica usa os snapshots congelados pelo servidor.</p>
    </div>
  );
}

function Field({ label, value, placeholder, onChange }: { label: string; value: string; placeholder: string; onChange: (value: string) => void }) { return <label className="grid gap-1.5 text-[10.5px] font-semibold text-fog">{label}<input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-10 rounded-xl border border-line bg-deep/35 px-3 text-[12px] text-paper outline-none focus:border-aqua/60" /></label>; }
function TextArea({ label, value, placeholder, rows, onChange }: { label: string; value: string; placeholder: string; rows: number; onChange: (value: string) => void }) { return <label className="grid gap-1.5 text-[10.5px] font-semibold text-fog">{label}<textarea value={value} rows={rows} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="resize-y rounded-xl border border-line bg-panel px-3 py-2.5 text-[12px] leading-relaxed text-paper outline-none focus:border-aqua/60" /></label>; }

function recipientLabel(recipient: ReferralRecipient): string { return [recipient.professionalName, recipient.specialty, recipient.service, recipient.facility].map((value) => value.trim()).filter(Boolean).join(' · ') || 'Destino ainda não informado'; }

function ReferralHistory({ title, documents, patientName, empty, compact = false, onSchedule }: { title: string; documents: ReferralDocument[]; patientName: string; empty: string; compact?: boolean; onSchedule: (document: ReferralDocument) => Promise<void> }) {
  return <section className="rounded-2xl border border-line/65 bg-panel p-4"><div className="flex items-center justify-between gap-3"><h4 className="font-display text-[15px] font-semibold text-paper">{title}</h4><Chip>{documents.length}</Chip></div>{documents.length === 0 ? <p className="mt-3 text-[11px] text-fog">{empty}</p> : <div className="mt-3 space-y-2">{documents.map((document) => { const content = document.payloadSnapshot ?? document.payload; const internal = content.recipient.scope !== 'external'; return <article key={document.id} className="rounded-xl border border-line/60 bg-deep/25 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div className="min-w-0 flex-1"><p className="text-[11.5px] font-semibold text-paper">{recipientLabel(content.recipient)}</p><p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-fog">{content.reason || 'Motivo não registrado'}</p><p className="mt-2 font-mono text-[9px] text-fog">{document.documentIdentifier} · {document.issuedAt ? new Date(document.issuedAt).toLocaleString('pt-BR') : document.createdAt}</p></div><div className="flex flex-wrap items-center gap-2"><Chip className={document.status === 'issued' ? 'border-mint/35 text-mint' : 'border-pulse/35 text-pulse'}>{document.status === 'issued' ? 'Emitido' : 'Cancelado'}</Chip>{document.status === 'issued' && internal && <Btn variant="subtle" onClick={() => void onSchedule(document)}>Agendar continuidade</Btn>}{document.status === 'issued' && document.payloadSnapshot && <Btn variant="subtle" onClick={() => printIssuedReferral(document, patientName)}>Imprimir</Btn>}</div></div>{!compact && <p className="mt-2 text-[10px] font-semibold text-fog">{referralPriorityLabel(content.priority)}{content.requestedAction ? ` · ${content.requestedAction}` : ''}</p>}{document.status === 'canceled' && document.cancelReason && <p className="mt-2 text-[10px] text-pulse">Motivo do cancelamento: {document.cancelReason}</p>}<p className="mt-2 text-[9.5px] text-fog">Conteúdo e impressão histórica usam o snapshot emitido; não acompanham alterações futuras do modelo.</p></article>; })}</div>}</section>;
}

function printIssuedReferral(document: ReferralDocument, fallbackPatientName: string) {
  if (document.status !== 'issued' || !document.payloadSnapshot) return;
  const context = buildReferralRenderContextFromSnapshot(document.contextSnapshot, fallbackPatientName, document.documentIdentifier);
  context.issuedAt = document.issuedAt ?? context.issuedAt;
  const html = buildReferralDocumentHtml({ payload: document.payloadSnapshot, context, renderDefinition: referralDocumentRenderDefinition(document), renderedSnapshot: document.renderedSnapshot, mode: 'issued', autoPrint: true });
  const target = window.open('', '_blank', 'width=900,height=760');
  if (!target) return; target.opener = null; target.document.open(); target.document.write(html); target.document.close();
}

function ReferralState({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'error' | 'muted' }) {
  const className = tone === 'error' ? 'border-pulse/30 bg-pulse/[0.04] text-pulse' : tone === 'muted' ? 'border-line/65 bg-deep/30 text-fog' : 'border-aqua/25 bg-aqua/[0.035] text-fog';
  return <div className={`rounded-xl border px-4 py-3 text-[11.5px] leading-relaxed ${className}`}>{children}</div>;
}
