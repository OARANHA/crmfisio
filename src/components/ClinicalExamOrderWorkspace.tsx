import { useEffect, useMemo, useState } from 'react';
import {
  canIssueExamOrder,
  classifyExamOrderError,
  createExamOrderDraft,
  emptyExamOrderItem,
  emptyExamOrderPayload,
  examOrderPriorityLabel,
  examOrderReadyToIssue,
  issueExamOrder,
  loadExamOrderDocuments,
  loadExamOrderTemplates,
  saveExamOrderDraft,
  type ExamOrderDocument,
  type ExamOrderItem,
  type ExamOrderPayload,
  type ExamOrderPriority,
  type ExamOrderTemplate,
} from '../lib/clinicalExamOrder';
import type { Appointment, Patient } from '../lib/types';
import { Btn, Chip } from '../lib/ui';
import { useToast } from '../lib/toastContext';

type ClinicalExamOrderWorkspaceProps = {
  patient: Patient;
  encounter: Appointment;
  userId: string;
};

const PRIORITIES: Array<{ value: ExamOrderPriority; label: string; detail: string }> = [
  { value: 'routine', label: 'Rotina', detail: 'Fluxo habitual' },
  { value: 'high', label: 'Alta', detail: 'Priorizar execução' },
  { value: 'urgent', label: 'Urgente', detail: 'Necessidade imediata' },
];

const QUICK_CATEGORIES = ['Laboratório', 'Imagem', 'Cardiologia', 'Funcional'];

export function ClinicalExamOrderWorkspace(props: ClinicalExamOrderWorkspaceProps) {
  const contextKey = `${props.patient.id}:${props.encounter.id}:${props.userId}`;
  return <ClinicalExamOrderWorkspaceContext key={contextKey} {...props} />;
}

function ClinicalExamOrderWorkspaceContext({ patient, encounter, userId }: ClinicalExamOrderWorkspaceProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [templates, setTemplates] = useState<ExamOrderTemplate[]>([]);
  const [documents, setDocuments] = useState<ExamOrderDocument[]>([]);
  const [selectedTemplateVersionId, setSelectedTemplateVersionId] = useState('');
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [payload, setPayload] = useState<ExamOrderPayload>(() => emptyExamOrderPayload());
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
  const readyToIssue = examOrderReadyToIssue(payload);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const canIssue = await canIssueExamOrder();
        if (!active) return;
        setEligible(canIssue);
        if (!canIssue) {
          setTemplates([]);
          setDocuments([]);
          setActiveDocumentId(null);
          return;
        }

        const [availableTemplates, patientDocuments] = await Promise.all([
          loadExamOrderTemplates(),
          loadExamOrderDocuments(patient.id),
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
        console.error('[MedicsPro] carregar Pedido de Exames V1:', error);
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [encounter.id, patient.id, userId]);

  const replaceDocument = (next: ExamOrderDocument) => {
    setDocuments((current) => {
      const exists = current.some((document) => document.id === next.id);
      return exists
        ? current.map((document) => document.id === next.id ? next : document)
        : [next, ...current];
    });
  };

  const explainError = (error: unknown, action: 'criar' | 'salvar' | 'emitir') => {
    const kind = classifyExamOrderError(error);
    if (kind === 'eligibility') return 'Sua identidade profissional não permite emitir pedido de exames neste momento.';
    if (kind === 'active_encounter') return 'O pedido só pode ser alterado ou emitido durante seu atendimento ativo.';
    if (kind === 'payload') return 'Revise os exames solicitados antes de emitir o pedido.';
    if (kind === 'draft') return 'Este rascunho já não pode ser alterado.';
    return `Não foi possível ${action} o pedido de exames agora.`;
  };

  const startDraft = async () => {
    if (!selectedTemplateVersionId || creating) return;
    setCreating(true);
    try {
      const next = await createExamOrderDraft(
        encounter.id,
        selectedTemplateVersionId,
        emptyExamOrderPayload(),
      );
      replaceDocument(next);
      setActiveDocumentId(next.id);
      setPayload(next.payload);
      setDirty(false);
      setReviewing(false);
      toast('Rascunho de pedido de exames criado.');
    } catch (error) {
      console.error('[MedicsPro] criar pedido de exames:', error);
      toast(explainError(error, 'criar'), 'warn');
    } finally {
      setCreating(false);
    }
  };

  const saveDraft = async (): Promise<ExamOrderDocument | null> => {
    if (!activeDocument || activeDocument.status !== 'draft' || saving) return activeDocument;
    setSaving(true);
    try {
      const saved = await saveExamOrderDraft(activeDocument.id, payload);
      replaceDocument(saved);
      setPayload(saved.payload);
      setDirty(false);
      toast('Rascunho do pedido salvo.');
      return saved;
    } catch (error) {
      console.error('[MedicsPro] salvar pedido de exames:', error);
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
        const saved = await saveExamOrderDraft(activeDocument.id, payload);
        replaceDocument(saved);
        documentToIssue = saved;
      }
      const issued = await issueExamOrder(documentToIssue.id);
      replaceDocument(issued);
      setActiveDocumentId(null);
      setPayload(emptyExamOrderPayload());
      setDirty(false);
      setReviewing(false);
      toast('Pedido de exames emitido e registrado no histórico.');
    } catch (error) {
      console.error('[MedicsPro] emitir pedido de exames:', error);
      toast(explainError(error, 'emitir'), 'warn');
    } finally {
      setIssuing(false);
    }
  };

  const updateItem = (index: number, patch: Partial<ExamOrderItem>) => {
    setPayload((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item),
    }));
    setDirty(true);
    setReviewing(false);
  };

  const addItem = () => {
    setPayload((current) => ({ ...current, items: [...current.items, emptyExamOrderItem()] }));
    setDirty(true);
    setReviewing(false);
  };

  const removeItem = (index: number) => {
    setPayload((current) => ({
      ...current,
      items: current.items.length === 1
        ? [emptyExamOrderItem()]
        : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
    setDirty(true);
    setReviewing(false);
  };

  const updatePayload = (patch: Partial<ExamOrderPayload>) => {
    setPayload((current) => ({ ...current, ...patch }));
    setDirty(true);
    setReviewing(false);
  };

  if (loading) return <ExamOrderState>Verificando elegibilidade e histórico de pedidos de exames…</ExamOrderState>;
  if (loadError) return <ExamOrderState tone="error">Não foi possível carregar Pedido de Exames. Atualize a página antes de tentar novamente.</ExamOrderState>;
  if (!eligible) return <ExamOrderState tone="muted">Pedido de exames não está disponível para sua identidade clínica atual. A autorização permanece definida pelo servidor.</ExamOrderState>;
  if (templates.length === 0) return <ExamOrderState tone="error">Nenhum modelo de pedido de exames elegível está disponível neste atendimento.</ExamOrderState>;

  return (
    <div className="space-y-4" data-clinical-exam-order-version="1">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(330px,0.92fr)] xl:items-start">
        <section className="rounded-2xl border border-line/65 bg-deep/25 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-aqua">Pedido de exames</p>
              <h3 className="mt-1 font-display text-[17px] font-semibold text-paper">{activeDocument ? 'Rascunho deste atendimento' : 'Novo pedido'}</h3>
              <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-fog">Solicite exames de forma estruturada e revise o conteúdo antes da emissão. O rascunho pode ser salvo incompleto.</p>
            </div>
            {activeDocument && <Chip className="border-amber/35 text-amber">Rascunho · {dirty ? 'alterações não salvas' : 'salvo'}</Chip>}
          </div>

          {!activeDocument ? (
            <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <label className="grid gap-1.5 text-[11px] font-semibold text-fog">
                Modelo
                <select
                  value={selectedTemplateVersionId}
                  onChange={(event) => setSelectedTemplateVersionId(event.target.value)}
                  className="min-h-10 rounded-xl border border-line bg-panel px-3 text-[12px] text-paper outline-none focus:border-aqua/60"
                >
                  {templates.map((template) => <option key={template.id} value={template.currentVersionId}>{template.name}</option>)}
                </select>
              </label>
              <Btn disabled={!selectedTemplateVersionId || creating} onClick={() => void startDraft()}>{creating ? 'Criando…' : 'Criar pedido'}</Btn>
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <fieldset className="space-y-2">
                <legend className="text-[11px] font-semibold text-fog">Prioridade do pedido</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {PRIORITIES.map((option) => {
                    const selected = payload.priority === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => updatePayload({ priority: option.value })}
                        className={`rounded-xl border px-3 py-2.5 text-left transition-colors ${selected ? 'border-aqua/45 bg-aqua/[0.07]' : 'border-line bg-panel hover:border-aqua/25'}`}
                      >
                        <span className={`block text-[11.5px] font-semibold ${selected ? 'text-aqua' : 'text-paper'}`}>{option.label}</span>
                        <span className="mt-0.5 block text-[9.5px] text-fog">{option.detail}</span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-3">
                {payload.items.map((item, index) => (
                  <fieldset key={`${activeDocument.id}:${index}`} className="rounded-xl border border-line/65 bg-panel/65 p-3">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <legend className="text-[11.5px] font-semibold text-paper">Exame {index + 1}</legend>
                      <button type="button" onClick={() => removeItem(index)} className="text-[10.5px] font-semibold text-fog hover:text-pulse">Remover</button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1.5 text-[10.5px] font-semibold text-fog sm:col-span-2">
                        Nome do exame *
                        <input
                          value={item.examName}
                          onChange={(event) => updateItem(index, { examName: event.target.value })}
                          placeholder="Ex.: Hemograma completo"
                          className="min-h-10 rounded-xl border border-line bg-deep/35 px-3 text-[12px] text-paper outline-none focus:border-aqua/60"
                        />
                      </label>
                      <label className="grid gap-1.5 text-[10.5px] font-semibold text-fog">
                        Categoria
                        <input
                          value={item.category}
                          onChange={(event) => updateItem(index, { category: event.target.value })}
                          placeholder="Ex.: Laboratório"
                          className="min-h-10 rounded-xl border border-line bg-deep/35 px-3 text-[12px] text-paper outline-none focus:border-aqua/60"
                        />
                      </label>
                      <label className="grid gap-1.5 text-[10.5px] font-semibold text-fog">
                        Código
                        <input
                          value={item.code}
                          onChange={(event) => updateItem(index, { code: event.target.value })}
                          placeholder="Opcional"
                          className="min-h-10 rounded-xl border border-line bg-deep/35 px-3 text-[12px] text-paper outline-none focus:border-aqua/60"
                        />
                      </label>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {QUICK_CATEGORIES.map((category) => (
                        <button key={category} type="button" onClick={() => updateItem(index, { category })} className="rounded-full border border-line/70 px-2.5 py-1 text-[9.5px] font-semibold text-fog hover:border-aqua/35 hover:text-aqua">{category}</button>
                      ))}
                    </div>
                    <label className="mt-3 grid gap-1.5 text-[10.5px] font-semibold text-fog">
                      Instruções específicas
                      <textarea
                        rows={2}
                        value={item.instructions}
                        onChange={(event) => updateItem(index, { instructions: event.target.value })}
                        placeholder="Preparo, contraste, região, condição específica…"
                        className="resize-y rounded-xl border border-line bg-deep/35 px-3 py-2.5 text-[12px] leading-relaxed text-paper outline-none focus:border-aqua/60"
                      />
                    </label>
                    <label className="mt-3 inline-flex cursor-pointer items-center gap-2 text-[10.5px] font-semibold text-fog">
                      <input type="checkbox" checked={item.urgent} onChange={(event) => updateItem(index, { urgent: event.target.checked })} />
                      Marcar este exame como urgente
                    </label>
                  </fieldset>
                ))}
                <button type="button" onClick={addItem} className="text-[11.5px] font-semibold text-aqua hover:underline">+ Adicionar exame</button>
              </div>

              <label className="grid gap-1.5 text-[11px] font-semibold text-fog">
                Indicação clínica
                <textarea rows={3} value={payload.clinicalIndication} onChange={(event) => updatePayload({ clinicalIndication: event.target.value })} placeholder="Contexto clínico que fundamenta a solicitação." className="resize-y rounded-xl border border-line bg-panel px-3 py-2.5 text-[12px] leading-relaxed text-paper outline-none focus:border-aqua/60" />
              </label>
              <label className="grid gap-1.5 text-[11px] font-semibold text-fog">
                Hipótese / impressão clínica
                <textarea rows={2} value={payload.impression} onChange={(event) => updatePayload({ impression: event.target.value })} placeholder="Opcional." className="resize-y rounded-xl border border-line bg-panel px-3 py-2.5 text-[12px] leading-relaxed text-paper outline-none focus:border-aqua/60" />
              </label>
              <label className="grid gap-1.5 text-[11px] font-semibold text-fog">
                Observações
                <textarea rows={2} value={payload.observations} onChange={(event) => updatePayload({ observations: event.target.value })} placeholder="Observações complementares do pedido." className="resize-y rounded-xl border border-line bg-panel px-3 py-2.5 text-[12px] leading-relaxed text-paper outline-none focus:border-aqua/60" />
              </label>

              <div className="flex flex-wrap items-center gap-2 border-t border-line/60 pt-3">
                <Btn variant="subtle" disabled={saving || !dirty} onClick={() => void saveDraft()}>{saving ? 'Salvando…' : 'Salvar rascunho'}</Btn>
                <Btn disabled={!readyToIssue || saving || issuing} onClick={() => setReviewing(true)}>Revisar pedido</Btn>
                {!readyToIssue && <span className="text-[10.5px] text-fog">Preencha o nome de todos os exames antes de revisar.</span>}
              </div>
            </div>
          )}
        </section>

        <aside className="space-y-3 xl:sticky xl:top-20">
          <ExamOrderPreview patient={patient} payload={payload} active={Boolean(activeDocument)} />

          {reviewing && activeDocument && (
            <section className="rounded-2xl border border-mint/35 bg-mint/[0.045] p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-mint">Revisão humana</p>
              <h4 className="mt-1 font-display text-[15px] font-semibold text-paper">Confirmar emissão</h4>
              <p className="mt-2 text-[11px] leading-relaxed text-fog">Ao emitir, conteúdo e contexto serão congelados em snapshots imutáveis. Alterações posteriores exigem um novo documento.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Btn disabled={issuing || !readyToIssue} onClick={() => void confirmIssue()}>{issuing ? 'Emitindo…' : 'Emitir pedido'}</Btn>
                <Btn variant="subtle" disabled={issuing} onClick={() => setReviewing(false)}>Voltar à edição</Btn>
              </div>
            </section>
          )}
        </aside>
      </div>

      <ExamOrderHistory title="Pedidos deste atendimento" documents={currentEncounterHistory} empty="Nenhum pedido emitido neste atendimento." />
      {priorHistory.length > 0 && <ExamOrderHistory title="Histórico anterior" documents={priorHistory} empty="" compact />}
    </div>
  );
}

function ExamOrderPreview({ patient, payload, active }: { patient: Patient; payload: ExamOrderPayload; active: boolean }) {
  const meaningfulItems = payload.items.filter((item) => item.examName.trim().length > 0);
  return (
    <section className="rounded-2xl border border-line/65 bg-panel p-4" data-exam-order-preview="draft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-fog">Prévia de conteúdo</p>
          <h4 className="mt-1 font-display text-[16px] font-semibold text-paper">Pedido de exames</h4>
        </div>
        <Chip className="border-amber/35 text-amber">Sem validade</Chip>
      </div>
      <div className="mt-3 rounded-xl border border-line/60 bg-deep/30 p-3">
        <p className="text-[9.5px] uppercase tracking-[0.1em] text-fog">Paciente</p>
        <p className="mt-1 text-[12px] font-semibold text-paper">{patient.preferredName || patient.nome}</p>
      </div>
      {!active ? (
        <p className="mt-3 text-[11px] leading-relaxed text-fog">Crie um rascunho para começar a montar o pedido.</p>
      ) : meaningfulItems.length === 0 ? (
        <p className="mt-3 text-[11px] leading-relaxed text-fog">Adicione pelo menos um exame para visualizar o conteúdo do pedido.</p>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Chip>{examOrderPriorityLabel(payload.priority)}</Chip>
            <span className="text-[10.5px] text-fog">{meaningfulItems.length} exame(s)</span>
          </div>
          <ol className="space-y-2">
            {meaningfulItems.map((item, index) => (
              <li key={`${item.examName}:${index}`} className="rounded-xl border border-line/60 bg-deep/25 px-3 py-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div><span className="text-[10px] text-fog">{index + 1}.</span> <span className="text-[11.5px] font-semibold text-paper">{item.examName}</span></div>
                  {item.urgent && <span className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-pulse">Urgente</span>}
                </div>
                {(item.category || item.code) && <p className="mt-1 text-[10px] text-fog">{[item.category, item.code].filter(Boolean).join(' · ')}</p>}
                {item.instructions && <p className="mt-1.5 whitespace-pre-wrap text-[10.5px] leading-relaxed text-paper/80">{item.instructions}</p>}
              </li>
            ))}
          </ol>
          {payload.clinicalIndication && <PreviewText label="Indicação clínica" value={payload.clinicalIndication} />}
          {payload.impression && <PreviewText label="Hipótese / impressão" value={payload.impression} />}
          {payload.observations && <PreviewText label="Observações" value={payload.observations} />}
        </div>
      )}
      <p className="mt-3 border-t border-line/60 pt-3 text-[9.5px] leading-relaxed text-fog">Esta prévia serve para conferência clínica. O layout profissional A4 será versionado separadamente, sem alterar documentos já emitidos.</p>
    </section>
  );
}

function PreviewText({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-fog">{label}</p><p className="mt-1 whitespace-pre-wrap text-[10.5px] leading-relaxed text-paper/85">{value}</p></div>;
}

function ExamOrderHistory({
  title,
  documents,
  empty,
  compact = false,
}: {
  title: string;
  documents: ExamOrderDocument[];
  empty: string;
  compact?: boolean;
}) {
  return (
    <section className="rounded-2xl border border-line/65 bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="font-display text-[15px] font-semibold text-paper">{title}</h4>
        <Chip>{documents.length}</Chip>
      </div>
      {documents.length === 0 ? (
        <p className="mt-3 text-[11px] text-fog">{empty}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {documents.map((document) => {
            const snapshot = document.payloadSnapshot ?? document.payload;
            const items = snapshot.items.filter((item) => item.examName.trim().length > 0);
            return (
              <article key={document.id} className="rounded-xl border border-line/60 bg-deep/25 p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-[11.5px] font-semibold text-paper">Pedido de exames · {items.length} exame(s)</p>
                    <p className="mt-0.5 text-[9.5px] text-fog">{document.issuedAt ? new Date(document.issuedAt).toLocaleString('pt-BR') : document.createdAt ? new Date(document.createdAt).toLocaleString('pt-BR') : ''}</p>
                  </div>
                  <Chip className={document.status === 'canceled' ? 'border-pulse/35 text-pulse' : 'border-mint/35 text-mint'}>{document.status === 'canceled' ? 'Cancelado' : 'Emitido'}</Chip>
                </div>
                <p className="mt-2 text-[10px] font-semibold text-fog">{examOrderPriorityLabel(snapshot.priority)} · {document.documentIdentifier || 'Identificador pendente'}</p>
                {!compact && items.length > 0 && <ul className="mt-2 space-y-1 text-[10.5px] text-paper/85">{items.map((item, index) => <li key={`${document.id}:${index}`}>• {item.examName}{item.urgent ? ' — urgente' : ''}</li>)}</ul>}
                {document.status === 'canceled' && document.cancelReason && <p className="mt-2 text-[10px] text-pulse">Motivo: {document.cancelReason}</p>}
                <p className="mt-2 text-[9.5px] text-fog">Conteúdo histórico exibido a partir do snapshot emitido; não acompanha alterações futuras do modelo.</p>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function ExamOrderState({ children, tone = 'neutral' }: { children: React.ReactNode; tone?: 'neutral' | 'muted' | 'error' }) {
  const className = tone === 'error'
    ? 'border-pulse/30 bg-pulse/[0.04] text-pulse'
    : tone === 'muted'
      ? 'border-line/65 bg-deep/30 text-fog'
      : 'border-aqua/25 bg-aqua/[0.035] text-fog';
  return <div className={`rounded-xl border px-4 py-3 text-[11.5px] leading-relaxed ${className}`}>{children}</div>;
}
