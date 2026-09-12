import { useEffect, useMemo, useState } from 'react';
import {
  canIssueTherapeuticGuidance,
  classifyTherapeuticGuidanceError,
  createTherapeuticGuidanceDraft,
  emptyTherapeuticGuidanceItem,
  emptyTherapeuticGuidancePayload,
  issueTherapeuticGuidance,
  loadTherapeuticGuidanceDocuments,
  loadTherapeuticGuidanceTemplates,
  saveTherapeuticGuidanceDraft,
  therapeuticGuidanceReadyToIssue,
  type TherapeuticGuidanceDocument,
  type TherapeuticGuidancePayload,
} from '../lib/clinicalTherapeuticGuidance';
import type { Appointment, Patient } from '../lib/types';
import { Btn, Chip } from '../lib/ui';
import { useToast } from '../lib/toastContext';

type ClinicalTherapeuticGuidanceWorkspaceProps = {
  patient: Patient;
  encounter: Appointment;
  userId: string;
};

export function ClinicalTherapeuticGuidanceWorkspace(props: ClinicalTherapeuticGuidanceWorkspaceProps) {
  const contextKey = `${props.patient.id}:${props.encounter.id}:${props.userId}`;
  return <ClinicalTherapeuticGuidanceWorkspaceContext key={contextKey} {...props} />;
}

function ClinicalTherapeuticGuidanceWorkspaceContext({
  patient,
  encounter,
  userId,
}: ClinicalTherapeuticGuidanceWorkspaceProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [eligible, setEligible] = useState(false);
  const [templates, setTemplates] = useState<Awaited<ReturnType<typeof loadTherapeuticGuidanceTemplates>>>([]);
  const [documents, setDocuments] = useState<TherapeuticGuidanceDocument[]>([]);
  const [selectedTemplateVersionId, setSelectedTemplateVersionId] = useState('');
  const [activeDocumentId, setActiveDocumentId] = useState<string | null>(null);
  const [payload, setPayload] = useState<TherapeuticGuidancePayload>(() => emptyTherapeuticGuidancePayload());
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
  const priorDocuments = useMemo(
    () => history.filter((document) => document.appointmentId !== encounter.id),
    [encounter.id, history],
  );
  const readyToIssue = therapeuticGuidanceReadyToIssue(payload);

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const canIssue = await canIssueTherapeuticGuidance();
        if (!active) return;
        setEligible(canIssue);
        if (!canIssue) {
          setTemplates([]);
          setDocuments([]);
          setActiveDocumentId(null);
          return;
        }

        const [availableTemplates, patientDocuments] = await Promise.all([
          loadTherapeuticGuidanceTemplates(),
          loadTherapeuticGuidanceDocuments(patient.id),
        ]);
        if (!active) return;
        setTemplates(availableTemplates);
        setDocuments(patientDocuments);
        setSelectedTemplateVersionId(availableTemplates[0]?.currentVersionId || '');

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
        console.error('[MedicsPro] carregar Orientação Terapêutica V1:', error);
        if (active) setLoadError(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, [encounter.id, patient.id, userId]);

  const replaceDocument = (next: TherapeuticGuidanceDocument) => {
    setDocuments((current) => {
      const existing = current.some((document) => document.id === next.id);
      return existing
        ? current.map((document) => document.id === next.id ? next : document)
        : [next, ...current];
    });
  };

  const explainError = (error: unknown, action: 'criar' | 'salvar' | 'emitir') => {
    const kind = classifyTherapeuticGuidanceError(error);
    if (kind === 'eligibility') return 'Seu acesso ou sua identidade profissional não permitem emitir esta orientação.';
    if (kind === 'active_encounter') return 'A orientação só pode ser alterada ou emitida durante seu atendimento ativo.';
    if (kind === 'payload') return 'Revise as orientações antes de emitir o documento.';
    if (kind === 'draft') return 'Este rascunho já não pode ser alterado.';
    return `Não foi possível ${action} a orientação terapêutica agora.`;
  };

  const startDraft = async () => {
    if (!selectedTemplateVersionId || creating) return;
    setCreating(true);
    try {
      const next = await createTherapeuticGuidanceDraft(
        encounter.id,
        selectedTemplateVersionId,
        emptyTherapeuticGuidancePayload(),
      );
      replaceDocument(next);
      setActiveDocumentId(next.id);
      setPayload(next.payload);
      setDirty(false);
      toast('Rascunho de orientação terapêutica criado.');
    } catch (error) {
      console.error('[MedicsPro] criar orientação terapêutica:', error);
      toast(explainError(error, 'criar'), 'warn');
    } finally {
      setCreating(false);
    }
  };

  const saveDraft = async (): Promise<TherapeuticGuidanceDocument | null> => {
    if (!activeDocument || activeDocument.status !== 'draft' || saving) return activeDocument;
    setSaving(true);
    try {
      const saved = await saveTherapeuticGuidanceDraft(activeDocument.id, payload);
      replaceDocument(saved);
      setPayload(saved.payload);
      setDirty(false);
      toast('Rascunho salvo.');
      return saved;
    } catch (error) {
      console.error('[MedicsPro] salvar orientação terapêutica:', error);
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
        const saved = await saveTherapeuticGuidanceDraft(activeDocument.id, payload);
        replaceDocument(saved);
        documentToIssue = saved;
      }
      const issued = await issueTherapeuticGuidance(documentToIssue.id);
      replaceDocument(issued);
      setActiveDocumentId(null);
      setPayload(emptyTherapeuticGuidancePayload());
      setDirty(false);
      setReviewing(false);
      toast('Orientação terapêutica emitida e registrada no histórico.');
    } catch (error) {
      console.error('[MedicsPro] emitir orientação terapêutica:', error);
      toast(explainError(error, 'emitir'), 'warn');
    } finally {
      setIssuing(false);
    }
  };

  const updateGuidance = (index: number, value: string) => {
    setPayload((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) => itemIndex === index ? { guidance: value } : item),
    }));
    setDirty(true);
  };

  const addGuidance = () => {
    setPayload((current) => ({ ...current, items: [...current.items, emptyTherapeuticGuidanceItem()] }));
    setDirty(true);
  };

  const removeGuidance = (index: number) => {
    setPayload((current) => ({
      ...current,
      items: current.items.length === 1
        ? [emptyTherapeuticGuidanceItem()]
        : current.items.filter((_, itemIndex) => itemIndex !== index),
    }));
    setDirty(true);
  };

  const updatePatientInstructions = (value: string) => {
    setPayload((current) => ({ ...current, patientInstructions: value }));
    setDirty(true);
  };

  const updateObservations = (value: string) => {
    setPayload((current) => ({ ...current, observations: value }));
    setDirty(true);
  };

  if (loading) return <GuidanceState>Verificando elegibilidade e histórico de orientações…</GuidanceState>;
  if (loadError) return <GuidanceState tone="error">Não foi possível carregar a Orientação Terapêutica V1. Atualize a página antes de tentar novamente.</GuidanceState>;
  if (!eligible) return <GuidanceState tone="muted">Orientação terapêutica não está disponível para sua identidade clínica atual. A autorização permanece definida pelo servidor.</GuidanceState>;
  if (templates.length === 0) return <GuidanceState tone="error">Nenhum modelo de orientação terapêutica elegível está disponível para este atendimento.</GuidanceState>;

  return (
    <div className="space-y-4" data-clinical-therapeutic-guidance-version="1">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)] xl:items-start">
        <div className="rounded-2xl border border-line/65 bg-deep/25 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-aqua">Orientação terapêutica V1</p>
              <h3 className="mt-1 font-display text-[17px] font-semibold text-paper">{activeDocument ? 'Rascunho deste atendimento' : 'Nova orientação'}</h3>
              <p className="mt-1 max-w-2xl text-[11.5px] leading-relaxed text-fog">Registre somente conteúdo revisado por você. O rascunho pode ser salvo incompleto; emitir congela um snapshot clínico imutável.</p>
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
                <fieldset key={`${activeDocument.id}:${index}`} className="rounded-xl border border-line/65 bg-panel/65 p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <legend className="text-[11px] font-semibold text-paper">Orientação {index + 1}</legend>
                    <button type="button" onClick={() => removeGuidance(index)} className="text-[10.5px] font-semibold text-fog hover:text-pulse">Remover</button>
                  </div>
                  <textarea
                    rows={3}
                    value={item.guidance}
                    onChange={(event) => updateGuidance(index, event.target.value)}
                    placeholder="Ex.: manter hidratação, observar sinais de alerta, realizar os cuidados combinados…"
                    className="w-full resize-y rounded-xl border border-line bg-panel px-3 py-2.5 text-[12px] leading-relaxed text-paper outline-none focus:border-aqua/60"
                  />
                </fieldset>
              ))}
              <button type="button" onClick={addGuidance} className="text-[11.5px] font-semibold text-aqua hover:underline">+ Adicionar orientação</button>

              <label className="grid gap-1.5 text-[11px] font-semibold text-fog">
                Instruções ao paciente
                <textarea rows={3} value={payload.patientInstructions} onChange={(event) => updatePatientInstructions(event.target.value)} placeholder="Instruções complementares que devem acompanhar o documento." className="resize-y rounded-xl border border-line bg-panel px-3 py-2.5 text-[12px] leading-relaxed text-paper outline-none focus:border-aqua/60" />
              </label>

              <label className="grid gap-1.5 text-[11px] font-semibold text-fog">
                Observações complementares
                <textarea rows={2} value={payload.observations} onChange={(event) => updateObservations(event.target.value)} placeholder="Observações adicionais registradas pelo profissional." className="resize-y rounded-xl border border-line bg-panel px-3 py-2.5 text-[12px] leading-relaxed text-paper outline-none focus:border-aqua/60" />
              </label>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/60 pt-3">
                <p className="text-[10.5px] text-fog">Salvar não emite. A emissão exige revisão humana explícita e permanece historicamente imutável.</p>
                <div className="flex flex-wrap gap-2">
                  <Btn variant="subtle" disabled={saving || !dirty} onClick={() => void saveDraft()}>{saving ? 'Salvando…' : dirty ? 'Salvar rascunho' : 'Rascunho salvo'}</Btn>
                  <Btn disabled={!readyToIssue || saving || issuing} onClick={() => setReviewing(true)}>Revisar e emitir</Btn>
                </div>
              </div>
              {!readyToIssue && <p className="text-[10.5px] text-amber">Preencha cada orientação antes de revisar para emissão.</p>}
            </div>
          )}
        </div>

        <GuidanceContentPreview patientName={patient.preferredName || patient.nome} payload={payload} />
      </div>

      {reviewing && activeDocument && (
        <GuidanceReview
          patientName={patient.preferredName || patient.nome}
          payload={payload}
          issuing={issuing}
          onBack={() => setReviewing(false)}
          onIssue={() => void confirmIssue()}
        />
      )}

      {currentAppointmentDocuments.length > 0 && <GuidanceHistory title="Emitidas neste atendimento" documents={currentAppointmentDocuments} />}
      <GuidanceHistory title="Histórico anterior" documents={priorDocuments} empty="Ainda não há orientações terapêuticas anteriores acessíveis no histórico deste paciente." />
    </div>
  );
}

function GuidanceContentPreview({ patientName, payload }: { patientName: string; payload: TherapeuticGuidancePayload }) {
  return (
    <aside className="rounded-2xl border border-line/65 bg-panel p-4 xl:sticky xl:top-20" aria-label="Prévia de conteúdo da orientação terapêutica">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-aqua">Prévia de conteúdo</p><h3 className="mt-1 font-display text-[16px] font-semibold text-paper">Orientação terapêutica</h3></div>
        <Chip className="border-amber/35 text-amber">Sem validade</Chip>
      </div>
      <p className="mt-3 text-[10.5px] text-fog">Paciente</p>
      <p className="mt-0.5 text-[12.5px] font-semibold text-paper">{patientName}</p>
      <ol className="mt-4 space-y-2">
        {payload.items.map((item, index) => (
          <li key={index} className="rounded-xl border border-line/60 bg-deep/25 p-3 text-[11.5px] leading-relaxed text-paper/90">
            <span className="mr-1.5 font-semibold text-aqua">{index + 1}.</span>{item.guidance.trim() || 'Orientação ainda não preenchida.'}
          </li>
        ))}
      </ol>
      {payload.patientInstructions.trim() && <PreviewBlock title="Instruções ao paciente" text={payload.patientInstructions} />}
      {payload.observations.trim() && <PreviewBlock title="Observações" text={payload.observations} />}
      <p className="mt-4 border-t border-line/50 pt-3 text-[10px] leading-relaxed text-fog">Esta é uma prévia de conteúdo do rascunho, não um documento emitido. A impressão histórica usa o snapshot congelado pelo servidor.</p>
    </aside>
  );
}

function PreviewBlock({ title, text }: { title: string; text: string }) {
  return <div className="mt-3 border-t border-line/50 pt-3"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-fog">{title}</p><p className="mt-1 whitespace-pre-wrap text-[11.5px] leading-relaxed text-paper/85">{text.trim()}</p></div>;
}

function GuidanceReview({ patientName, payload, issuing, onBack, onIssue }: { patientName: string; payload: TherapeuticGuidancePayload; issuing: boolean; onBack: () => void; onIssue: () => void }) {
  return (
    <div className="rounded-2xl border border-aqua/35 bg-aqua/[0.035] p-4" role="dialog" aria-label="Revisão da orientação terapêutica">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.11em] text-aqua">Revisão humana obrigatória</p>
      <h3 className="mt-1 font-display text-[17px] font-semibold text-paper">Orientação para {patientName}</h3>
      <p className="mt-1 text-[11.5px] text-fog">Confira o conteúdo autoral. Depois de emitida, esta versão fica imutável no histórico clínico.</p>
      <ol className="mt-4 space-y-2">
        {payload.items.map((item, index) => <li key={index} className="rounded-xl border border-line/65 bg-panel/75 p-3 text-[11.5px] leading-relaxed text-paper/90"><span className="mr-1.5 font-semibold text-aqua">{index + 1}.</span>{item.guidance.trim()}</li>)}
      </ol>
      {payload.patientInstructions.trim() && <PreviewBlock title="Instruções ao paciente" text={payload.patientInstructions} />}
      {payload.observations.trim() && <PreviewBlock title="Observações" text={payload.observations} />}
      <div className="mt-4 flex flex-wrap justify-end gap-2"><Btn variant="subtle" disabled={issuing} onClick={onBack}>Voltar e editar</Btn><Btn disabled={issuing} onClick={onIssue}>{issuing ? 'Emitindo…' : 'Confirmar e emitir'}</Btn></div>
    </div>
  );
}

function GuidanceHistory({ title, documents, empty }: { title: string; documents: TherapeuticGuidanceDocument[]; empty?: string }) {
  const unique = documents.filter((document, index, all) => all.findIndex((candidate) => candidate.id === document.id) === index);
  return (
    <div className="rounded-2xl border border-line/65 bg-panel p-4">
      <div className="flex items-center justify-between gap-3"><h3 className="font-display text-[15px] font-semibold text-paper">{title}</h3><span className="text-[10px] text-fog">{unique.length}</span></div>
      {unique.length === 0 ? <p className="mt-3 text-[11.5px] text-fog">{empty}</p> : <div className="mt-3 space-y-2">{unique.map((document) => <GuidanceDocumentCard key={document.id} document={document} />)}</div>}
    </div>
  );
}

function GuidanceDocumentCard({ document }: { document: TherapeuticGuidanceDocument }) {
  const snapshot = document.payloadSnapshot ?? document.payload;
  const issuedLabel = document.issuedAt ? new Date(document.issuedAt).toLocaleString('pt-BR') : 'data indisponível';
  return (
    <article className="rounded-xl border border-line/65 bg-deep/25 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2"><p className="font-mono text-[10.5px] text-paper">{document.documentIdentifier}</p><Chip className={document.status === 'canceled' ? 'border-pulse/30 text-pulse' : 'border-mint/30 text-mint'}>{document.status === 'canceled' ? 'Cancelada' : 'Emitida'}</Chip></div>
          <p className="mt-1 text-[10.5px] text-fog">{issuedLabel}</p>
        </div>
        {document.status === 'issued' && document.renderedSnapshot && <Btn variant="subtle" onClick={() => printIssuedGuidance(document)}>Imprimir</Btn>}
      </div>
      <ol className="mt-3 space-y-1.5">
        {snapshot.items.map((item, index) => <li key={`${document.id}:${index}`} className="text-[11px] leading-relaxed text-paper/85"><span className="mr-1 font-semibold text-aqua">{index + 1}.</span>{item.guidance}</li>)}
      </ol>
      {snapshot.patientInstructions && <p className="mt-2 border-t border-line/50 pt-2 text-[11px] text-fog">{snapshot.patientInstructions}</p>}
      {snapshot.observations && <p className="mt-2 text-[10.5px] text-fog">{snapshot.observations}</p>}
      {document.status === 'canceled' && document.cancelReason && <p className="mt-2 border-t border-pulse/20 pt-2 text-[10.5px] text-pulse">Motivo do cancelamento: {document.cancelReason}</p>}
    </article>
  );
}

function GuidanceState({ children, tone = 'muted' }: { children: string; tone?: 'muted' | 'error' }) {
  return <div className={`rounded-xl border px-4 py-3 text-[11.5px] leading-relaxed ${tone === 'error' ? 'border-pulse/30 bg-pulse/[0.04] text-pulse' : 'border-line/65 bg-deep/30 text-fog'}`}>{children}</div>;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function printIssuedGuidance(document: TherapeuticGuidanceDocument) {
  if (document.status !== 'issued' || !document.renderedSnapshot) return;
  const snapshot = escapeHtml(document.renderedSnapshot);
  const identifier = escapeHtml(document.documentIdentifier);
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${identifier}</title><style>@page{size:A4;margin:18mm}*{box-sizing:border-box}body{margin:0;color:#111827;background:#fff;font-family:Arial,Helvetica,sans-serif}.doc{max-width:760px;margin:0 auto}.id{font-size:9px;color:#6b7280;text-align:right;margin-bottom:18px}.snapshot{white-space:pre-wrap;word-break:break-word;font:12px/1.6 Arial,Helvetica,sans-serif;margin:0;border:0;background:transparent}</style></head><body><main class="doc"><div class="id">${identifier}</div><pre class="snapshot">${snapshot}</pre></main><script>window.addEventListener('load',()=>window.print())</script></body></html>`;
  const target = window.open('', '_blank', 'width=900,height=760');
  if (!target) return;
  target.opener = null;
  target.document.open();
  target.document.write(html);
  target.document.close();
}
