import { useEffect, useMemo, useState } from 'react';
import {
  canIssueMedicationPrescription,
  classifyClinicalPrescriptionError,
  createMedicationPrescriptionDraft,
  emptyMedicationPrescriptionItem,
  emptyMedicationPrescriptionPayload,
  issueMedicationPrescription,
  loadMedicationPrescriptionDocuments,
  loadMedicationPrescriptionTemplates,
  medicationPrescriptionReadyToIssue,
  prescriptionItemSummary,
  saveMedicationPrescriptionDraft,
  type MedicationPrescriptionDocument,
  type MedicationPrescriptionItem,
  type MedicationPrescriptionPayload,
  type MedicationPrescriptionTemplate,
} from '../lib/clinicalPrescription';
import type { Appointment, Patient } from '../lib/types';
import { Btn, Chip } from '../lib/ui';
import { useToast } from '../lib/toastContext';

export function ClinicalPrescriptionWorkspace({
  patient,
  encounter,
  userId,
}: {
  patient: Patient;
  encounter: Appointment;
  userId: string;
}) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [templates, setTemplates] = useState<MedicationPrescriptionTemplate[]>([]);
  const [documents, setDocuments] = useState<MedicationPrescriptionDocument[]>([]);
  const [selectedTemplateVersionId, setSelectedTemplateVersionId] = useState('');
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [payload, setPayload] = useState<MedicationPrescriptionPayload>(() => emptyMedicationPrescriptionPayload());
  const [dirty, setDirty] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [issuing, setIssuing] = useState(false);

  const activeDocument = useMemo(
    () => documents.find((document) => document.id === activeDocumentId) ?? null,
    [activeDocumentId, documents],
  );
  const history = useMemo(
    () => documents.filter((document) => document.status !== 'draft'),
    [documents],
  );
  const currentAppointmentDocuments = useMemo(
    () => history.filter((document) => document.appointmentId === encounter.id),
    [encounter.id, history],
  );
  const readyToIssue = medicationPrescriptionReadyToIssue(payload);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const canIssue = await canIssueMedicationPrescription();
        if (!active) return;
        setEligible(canIssue);
        if (!canIssue) {
          setTemplates([]);
          setDocuments([]);
          setActiveDocumentId(null);
          return;
        }

        const [availableTemplates, patientDocuments] = await Promise.all([
          loadMedicationPrescriptionTemplates(),
          loadMedicationPrescriptionDocuments(patient.id),
        ]);
        if (!active) return;
        setTemplates(availableTemplates);
        setDocuments(patientDocuments);
        setSelectedTemplateVersionId((current) => current || availableTemplates[0]?.currentVersionId || '');

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
        console.error('[MedicsPro] carregar Prescrição V1:', error);
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [encounter.id, patient.id, userId]);

  const replaceDocument = (next: MedicationPrescriptionDocument) => {
    setDocuments((current) => {
      const existing = current.some((document) => document.id === next.id);
      return existing
        ? current.map((document) => document.id === next.id ? next : document)
        : [next, ...current];
    });
  };

  const explainError = (error: unknown, action: 'criar' | 'salvar' | 'emitir') => {
    const kind = classifyClinicalPrescriptionError(error);
    if (kind === 'eligibility') return 'Seu acesso ou sua identidade profissional não permitem esta prescrição.';
    if (kind === 'active_encounter') return 'A prescrição só pode ser alterada ou emitida durante seu atendimento ativo.';
    if (kind === 'payload') return 'Revise os medicamentos antes de emitir a prescrição.';
    if (kind === 'draft') return 'Este rascunho já não pode ser alterado.';
    return `Não foi possível ${action} a prescrição agora.`;
  };

  const startDraft = async () => {
    if (!selectedTemplateVersionId || creating) return;
    setCreating(true);
    try {
      const next = await createMedicationPrescriptionDraft(
        encounter.id,
        selectedTemplateVersionId,
        emptyMedicationPrescriptionPayload(),
      );
      replaceDocument(next);
      setActiveDocumentId(next.id);
      setPayload(next.payload);
      setDirty(false);
      toast('Rascunho de prescrição criado.');
    } catch (error) {
      console.error('[MedicsPro] criar prescrição:', error);
      toast(explainError(error, 'criar'), 'warn');
    } finally {
      setCreating(false);
    }
  };

  const saveDraft = async (): Promise<MedicationPrescriptionDocument | null> => {
    if (!activeDocument || activeDocument.status !== 'draft' || saving) return activeDocument;
    setSaving(true);
    try {
      const saved = await saveMedicationPrescriptionDraft(activeDocument.id, payload);
      replaceDocument(saved);
      setPayload(saved.payload);
      setDirty(false);
      toast('Rascunho salvo.');
      return saved;
    } catch (error) {
      console.error('[MedicsPro] salvar prescrição:', error);
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
        const saved = await saveMedicationPrescriptionDraft(activeDocument.id, payload);
        replaceDocument(saved);
        documentToIssue = saved;
      }
      const issued = await issueMedicationPrescription(documentToIssue.id);
      replaceDocument(issued);
      setActiveDocumentId(null);
      setPayload(emptyMedicationPrescriptionPayload());
      setDirty(false);
      setReviewing(false);
      toast('Prescrição emitida e registrada no histórico.');
    } catch (error) {
      console.error('[MedicsPro] emitir prescrição:', error);
      toast(explainError(error, 'emitir'), 'warn');
    } finally {
      setIssuing(false);
    }
  };

  const updateItem = (index: number, field: keyof MedicationPrescriptionItem, value: string) => {
    setPayload((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
    setDirty(true);
  };

  const addItem = () => {
    setPayload((current) => ({ ...current, items: [...current.items, emptyMedicationPrescriptionItem()] }));
    setDirty(true);
  };

  const removeItem = (index: number) => {
    setPayload((current) => ({
      ...current,
      items: current.items.length === 1
        ? [emptyMedicationPrescriptionItem()]
        : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
    setDirty(true);
  };

  const updateObservations = (value: string) => {
    setPayload((current) => ({ ...current, observations: value }));
    setDirty(true);
  };

  if (loading) {
    return <PrescriptionState>Verificando elegibilidade e histórico de prescrição…</PrescriptionState>;
  }
  if (loadError) {
    return <PrescriptionState tone="error">Não foi possível carregar a Prescrição V1. Atualize a página antes de tentar novamente.</PrescriptionState>;
  }
  if (!eligible) {
    return <PrescriptionState tone="muted">Prescrição medicamentosa não está disponível para sua identidade clínica atual. A autorização permanece definida pelo servidor.</PrescriptionState>;
  }
  if (templates.length === 0) {
    return <PrescriptionState tone="error">Nenhum template de prescrição elegível está disponível para este atendimento.</PrescriptionState>;
  }

  return (
    <div className="space-y-4" data-clinical-prescription-version="1">
      <div className="rounded-2xl border border-line/65 bg-deep/25 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-aqua">Prescrição V1</p>
            <h3 className="mt-1 font-display text-[17px] font-semibold text-paper">{activeDocument ? 'Rascunho deste atendimento' : 'Nova prescrição'}</h3>
            <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-fog">O rascunho pode ser salvo incompleto. A emissão exige confirmação explícita e gera um snapshot imutável.</p>
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
            <Btn disabled={!selectedTemplateVersionId || creating} onClick={() => void startDraft()}>{creating ? 'Criando…' : 'Criar rascunho'}</Btn>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {payload.items.map((item, index) => (
              <MedicationRow
                key={`${activeDocument.id}:${index}`}
                index={index}
                item={item}
                onChange={(field, value) => updateItem(index, field, value)}
                onRemove={() => removeItem(index)}
              />
            ))}
            <button type="button" onClick={addItem} className="text-[11.5px] font-semibold text-aqua hover:underline">+ Adicionar medicamento</button>

            <label className="grid gap-1.5 text-[11px] font-semibold text-fog">
              Observações da prescrição
              <textarea
                rows={3}
                value={payload.observations}
                onChange={(event) => updateObservations(event.target.value)}
                placeholder="Orientações complementares registradas pelo profissional."
                className="resize-y rounded-xl border border-line bg-panel px-3 py-2.5 text-[12px] leading-relaxed text-paper outline-none focus:border-aqua/60"
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
              <p className="text-[10.5px] text-fog">Salvar rascunho não emite a receita. Emitir é uma ação separada e irreversível.</p>
              <div className="flex flex-wrap gap-2">
                <Btn variant="subtle" disabled={saving || !dirty} onClick={() => void saveDraft()}>{saving ? 'Salvando…' : dirty ? 'Salvar rascunho' : 'Rascunho salvo'}</Btn>
                <Btn disabled={!readyToIssue || saving || issuing} onClick={() => setReviewing(true)}>Revisar e emitir</Btn>
              </div>
            </div>
            {!readyToIssue && <p className="text-[10.5px] text-amber">Informe o nome de cada medicamento antes de revisar para emissão.</p>}
          </div>
        )}
      </div>

      {reviewing && activeDocument && (
        <PrescriptionReview
          patientName={patient.preferredName || patient.nome}
          payload={payload}
          issuing={issuing}
          onBack={() => setReviewing(false)}
          onIssue={() => void confirmIssue()}
        />
      )}

      {currentAppointmentDocuments.length > 0 && (
        <DocumentHistory
          title="Emitidas neste atendimento"
          documents={currentAppointmentDocuments}
          patientName={patient.preferredName || patient.nome}
        />
      )}

      <DocumentHistory
        title="Histórico de prescrições"
        documents={history}
        patientName={patient.preferredName || patient.nome}
        empty="Ainda não há prescrições emitidas acessíveis no histórico deste paciente."
      />
    </div>
  );
}

function MedicationRow({
  index,
  item,
  onChange,
  onRemove,
}: {
  index: number;
  item: MedicationPrescriptionItem;
  onChange: (field: keyof MedicationPrescriptionItem, value: string) => void;
  onRemove: () => void;
}) {
  const inputClass = 'min-h-9 rounded-lg border border-line bg-panel px-2.5 text-[11.5px] text-paper outline-none focus:border-aqua/60';
  return (
    <fieldset className="rounded-xl border border-line/65 bg-panel/65 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <legend className="text-[11px] font-semibold text-paper">Medicamento {index + 1}</legend>
        <button type="button" onClick={onRemove} className="text-[10.5px] font-semibold text-fog hover:text-pulse">Remover</button>
      </div>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        <label className="grid gap-1 text-[10px] font-semibold text-fog xl:col-span-2">Medicamento *<input className={inputClass} value={item.medicationName} onChange={(event) => onChange('medicationName', event.target.value)} placeholder="Nome / apresentação" /></label>
        <label className="grid gap-1 text-[10px] font-semibold text-fog">Dose<input className={inputClass} value={item.dose} onChange={(event) => onChange('dose', event.target.value)} placeholder="Ex.: 1 comprimido" /></label>
        <label className="grid gap-1 text-[10px] font-semibold text-fog">Via<input className={inputClass} value={item.route} onChange={(event) => onChange('route', event.target.value)} placeholder="Ex.: oral" /></label>
        <label className="grid gap-1 text-[10px] font-semibold text-fog">Frequência<input className={inputClass} value={item.frequency} onChange={(event) => onChange('frequency', event.target.value)} placeholder="Ex.: 1x/dia" /></label>
        <label className="grid gap-1 text-[10px] font-semibold text-fog">Duração<input className={inputClass} value={item.duration} onChange={(event) => onChange('duration', event.target.value)} placeholder="Ex.: 30 dias" /></label>
        <label className="grid gap-1 text-[10px] font-semibold text-fog md:col-span-2 xl:col-span-3">Instruções<input className={inputClass} value={item.instructions} onChange={(event) => onChange('instructions', event.target.value)} placeholder="Orientação específica para este item" /></label>
      </div>
    </fieldset>
  );
}

function PrescriptionReview({
  patientName,
  payload,
  issuing,
  onBack,
  onIssue,
}: {
  patientName: string;
  payload: MedicationPrescriptionPayload;
  issuing: boolean;
  onBack: () => void;
  onIssue: () => void;
}) {
  return (
    <div className="rounded-2xl border border-aqua/35 bg-aqua/[0.035] p-4" role="dialog" aria-label="Revisão da prescrição">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-aqua">Revisão humana obrigatória</p>
      <h3 className="mt-1 font-display text-[17px] font-semibold text-paper">Prescrição para {patientName}</h3>
      <p className="mt-1 text-[11.5px] text-fog">Confira o conteúdo. Depois de emitida, esta versão fica imutável no histórico clínico.</p>
      <ol className="mt-4 space-y-2">
        {payload.items.map((item, index) => (
          <li key={`${item.medicationName}:${index}`} className="rounded-xl border border-line/65 bg-panel/75 p-3">
            <p className="text-[12.5px] font-semibold text-paper">{index + 1}. {item.medicationName.trim()}</p>
            {prescriptionItemSummary(item) && <p className="mt-1 text-[11px] text-fog">{prescriptionItemSummary(item)}</p>}
            {item.instructions.trim() && <p className="mt-1 text-[11px] text-paper/80">{item.instructions.trim()}</p>}
          </li>
        ))}
      </ol>
      {payload.observations.trim() && <div className="mt-3 rounded-xl border border-line/65 bg-panel/75 p-3"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-fog">Observações</p><p className="mt-1 whitespace-pre-wrap text-[11.5px] text-paper/85">{payload.observations.trim()}</p></div>}
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <Btn variant="subtle" disabled={issuing} onClick={onBack}>Voltar e editar</Btn>
        <Btn disabled={issuing} onClick={onIssue}>{issuing ? 'Emitindo…' : 'Confirmar e emitir'}</Btn>
      </div>
    </div>
  );
}

function DocumentHistory({
  title,
  documents,
  patientName,
  empty,
}: {
  title: string;
  documents: MedicationPrescriptionDocument[];
  patientName: string;
  empty?: string;
}) {
  const unique = documents.filter((document, index, all) => all.findIndex((candidate) => candidate.id === document.id) === index);
  return (
    <div className="rounded-2xl border border-line/65 bg-panel p-4">
      <div className="flex items-center justify-between gap-3"><h3 className="font-display text-[15px] font-semibold text-paper">{title}</h3><span className="text-[10px] text-fog">{unique.length}</span></div>
      {unique.length === 0 ? (
        <p className="mt-3 text-[11.5px] text-fog">{empty}</p>
      ) : (
        <div className="mt-3 space-y-2">
          {unique.map((document) => <IssuedDocumentCard key={document.id} document={document} patientName={patientName} />)}
        </div>
      )}
    </div>
  );
}

function IssuedDocumentCard({ document, patientName }: { document: MedicationPrescriptionDocument; patientName: string }) {
  const snapshot = document.payloadSnapshot ?? document.payload;
  const issuedLabel = document.issuedAt ? new Date(document.issuedAt).toLocaleString('pt-BR') : 'data indisponível';
  return (
    <article className="rounded-xl border border-line/65 bg-deep/25 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-mono text-[10.5px] text-paper">{document.documentIdentifier}</p>
            <Chip className={document.status === 'canceled' ? 'border-pulse/30 text-pulse' : 'border-mint/30 text-mint'}>{document.status === 'canceled' ? 'Cancelada' : 'Emitida'}</Chip>
          </div>
          <p className="mt-1 text-[10.5px] text-fog">{issuedLabel}</p>
        </div>
        {document.status === 'issued' && <Btn variant="subtle" onClick={() => printIssuedPrescription(document, patientName)}>Imprimir</Btn>}
      </div>
      <div className="mt-3 space-y-2">
        {snapshot.items.map((item, index) => (
          <div key={`${document.id}:${index}`} className="text-[11px]">
            <p className="font-semibold text-paper">{index + 1}. {item.medicationName}</p>
            {prescriptionItemSummary(item) && <p className="mt-0.5 text-fog">{prescriptionItemSummary(item)}</p>}
            {item.instructions && <p className="mt-0.5 text-paper/75">{item.instructions}</p>}
          </div>
        ))}
        {snapshot.observations && <p className="border-t border-line/50 pt-2 text-[11px] text-fog">{snapshot.observations}</p>}
        {document.status === 'canceled' && document.cancelReason && <p className="border-t border-pulse/20 pt-2 text-[10.5px] text-pulse">Motivo do cancelamento: {document.cancelReason}</p>}
      </div>
    </article>
  );
}

function PrescriptionState({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'error' }) {
  return <div className={`rounded-xl border px-4 py-3 text-[11.5px] leading-relaxed ${tone === 'error' ? 'border-pulse/30 bg-pulse/[0.04] text-pulse' : 'border-line/65 bg-deep/30 text-fog'}`}>{children}</div>;
}

function snapshotName(context: Record<string, unknown> | null, key: 'patient' | 'issuer', fallback: string): string {
  const value = context?.[key];
  if (!value || typeof value !== 'object') return fallback;
  const name = (value as Record<string, unknown>).name;
  return typeof name === 'string' && name.trim() ? name.trim() : fallback;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function printIssuedPrescription(document: MedicationPrescriptionDocument, fallbackPatientName: string) {
  if (document.status !== 'issued' || !document.payloadSnapshot) return;
  const patientName = snapshotName(document.contextSnapshot, 'patient', fallbackPatientName);
  const issuerName = snapshotName(document.contextSnapshot, 'issuer', 'Profissional responsável');
  const items = document.payloadSnapshot.items.map((item, index) => {
    const summary = prescriptionItemSummary(item);
    return `<li><strong>${escapeHtml(item.medicationName)}</strong>${summary ? `<div>${escapeHtml(summary)}</div>` : ''}${item.instructions ? `<div>${escapeHtml(item.instructions)}</div>` : ''}</li>`;
  }).join('');
  const observations = document.payloadSnapshot.observations
    ? `<section><h2>Observações</h2><p>${escapeHtml(document.payloadSnapshot.observations).replaceAll('\n', '<br>')}</p></section>`
    : '';
  const issuedAt = document.issuedAt ? new Date(document.issuedAt).toLocaleString('pt-BR') : '';
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${escapeHtml(document.documentIdentifier)}</title><style>body{font-family:Arial,sans-serif;max-width:760px;margin:40px auto;padding:0 24px;color:#111}header{border-bottom:2px solid #111;padding-bottom:16px;margin-bottom:24px}h1{font-size:22px;margin:0 0 8px}h2{font-size:14px;margin-top:24px}p,li{font-size:14px;line-height:1.55}li{margin-bottom:16px}.meta{color:#555;font-size:12px}@media print{body{margin:0;max-width:none}}</style></head><body><header><h1>Prescrição medicamentosa</h1><div class="meta">${escapeHtml(document.documentIdentifier)} · ${escapeHtml(issuedAt)}</div></header><p><strong>Paciente:</strong> ${escapeHtml(patientName)}</p><p><strong>Profissional:</strong> ${escapeHtml(issuerName)}</p><ol>${items}</ol>${observations}<script>window.addEventListener('load',()=>window.print())<\/script></body></html>`;
  const target = window.open('', '_blank', 'width=900,height=760');
  if (!target) return;
  target.opener = null;
  target.document.open();
  target.document.write(html);
  target.document.close();
}
