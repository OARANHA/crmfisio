import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Appointment, Patient } from '../lib/types';
import {
  classifyClinicalEncounterRecordError,
  clinicalEncounterRecordHasContent,
  finalizeClinicalEncounterRecord,
  loadClinicalEncounterRecord,
  materializeClinicalEncounterEvolution,
  saveClinicalEncounterRecord,
  type ClinicalEncounterRecord,
  type ClinicalEncounterRecordContent,
} from '../lib/clinicalEncounterRecord';
import { Btn, Chip, Modal, Textarea } from '../lib/ui';

const emptyContent = (): ClinicalEncounterRecordContent => ({
  reason: '', history: '', findings: '', assessment: '', plan: '', additionalNotes: '',
});

const contentOf = (record: ClinicalEncounterRecord): ClinicalEncounterRecordContent => ({
  reason: record.reason,
  history: record.history,
  findings: record.findings,
  assessment: record.assessment,
  plan: record.plan,
  additionalNotes: record.additionalNotes,
});

export function ClinicalEncounterRecordEditor({
  patient,
  encounter,
  userId,
  hasLinkedEvolution,
  legacyFallback,
  onFinalized,
}: {
  patient: Patient;
  encounter: Appointment;
  userId: string;
  hasLinkedEvolution: boolean;
  legacyFallback: ReactNode;
  onFinalized: () => Promise<void>;
}) {
  const contextKey = `${patient.id}:${userId}:${encounter.id}`;
  const contextRef = useRef(contextKey);
  contextRef.current = contextKey;
  const [record, setRecord] = useState<ClinicalEncounterRecord | null>(null);
  const [content, setContent] = useState<ClinicalEncounterRecordContent>(emptyContent);
  const [baseline, setBaseline] = useState<ClinicalEncounterRecordContent>(emptyContent);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'conflict' | 'error'>('idle');
  const [finalizing, setFinalizing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const requestKey = contextKey;
    setRecord(null);
    setContent(emptyContent());
    setBaseline(emptyContent());
    setSaveState('idle');
    setMessage(null);
    setReviewOpen(false);
    setLoading(true);
    void loadClinicalEncounterRecord(encounter.id)
      .then((loaded) => {
        if (contextRef.current !== requestKey) return;
        setRecord(loaded);
        if (loaded) {
          const next = contentOf(loaded);
          setContent(next);
          setBaseline(next);
          setSaveState(loaded.status === 'draft' ? 'saved' : 'saved');
        }
      })
      .catch((error) => {
        if (contextRef.current !== requestKey) return;
        console.error('[MedicsPro] registro da consulta:', error);
        setMessage('Não foi possível carregar o registro desta consulta.');
        setSaveState('error');
      })
      .finally(() => {
        if (contextRef.current === requestKey) setLoading(false);
      });
  }, [contextKey, encounter.id]);

  const dirty = useMemo(() => JSON.stringify(content) !== JSON.stringify(baseline), [baseline, content]);
  const finalText = useMemo(() => materializeClinicalEncounterEvolution(content), [content]);
  const hasContent = clinicalEncounterRecordHasContent(content);

  const change = (key: keyof ClinicalEncounterRecordContent, value: string) => {
    setContent((current) => ({ ...current, [key]: value }));
    setSaveState('idle');
    setMessage(null);
  };

  const save = async () => {
    if (loading || finalizing || record?.status === 'finalized') return;
    const requestKey = contextKey;
    setSaveState('saving');
    setMessage(null);
    try {
      const saved = await saveClinicalEncounterRecord(encounter.id, record?.revision ?? 0, content);
      if (contextRef.current !== requestKey) return;
      const persisted = contentOf(saved);
      setRecord(saved);
      setContent(persisted);
      setBaseline(persisted);
      setSaveState('saved');
    } catch (error) {
      if (contextRef.current !== requestKey) return;
      const kind = classifyClinicalEncounterRecordError(error);
      if (kind === 'revision_conflict') {
        setSaveState('conflict');
        setMessage('Este registro foi atualizado em outra aba. Recarregue antes de salvar novamente.');
      } else if (kind === 'evolution_conflict' || kind === 'legacy_evolution') {
        setSaveState('conflict');
        setMessage('Já existe uma evolução vinculada a este atendimento. Recarregue a consulta para revisar o registro existente.');
      } else {
        console.error('[MedicsPro] salvar registro da consulta:', error);
        setSaveState('error');
        setMessage('Não foi possível salvar o registro da consulta.');
      }
    }
  };

  const finalize = async () => {
    if (!record || record.status !== 'draft' || dirty || !hasContent || finalizing) return;
    const requestKey = contextKey;
    setFinalizing(true);
    setMessage(null);
    try {
      const finalized = await finalizeClinicalEncounterRecord(encounter.id, record.revision);
      if (contextRef.current !== requestKey) return;
      setRecord(finalized);
      const persisted = contentOf(finalized);
      setContent(persisted);
      setBaseline(persisted);
      setSaveState('saved');
      setReviewOpen(false);
      await onFinalized();
    } catch (error) {
      if (contextRef.current !== requestKey) return;
      const kind = classifyClinicalEncounterRecordError(error);
      if (kind === 'revision_conflict' || kind === 'evolution_conflict') {
        setSaveState('conflict');
        setMessage(kind === 'revision_conflict'
          ? 'Este registro mudou em outra aba. Recarregue antes de concluir.'
          : 'Outra evolução foi registrada para este atendimento. Recarregue antes de continuar.');
      } else if (kind === 'content_required') {
        setMessage('Registre ao menos uma informação clínica antes de concluir o atendimento.');
      } else {
        console.error('[MedicsPro] concluir registro da consulta:', error);
        setMessage('Não foi possível concluir o atendimento. Nenhuma conclusão foi informada como realizada.');
      }
    } finally {
      if (contextRef.current === requestKey) setFinalizing(false);
    }
  };

  if (loading) return <div className="rounded-2xl border border-line/70 bg-deep/30 p-4 text-[12px] text-fog">Carregando registro da consulta…</div>;
  if (!record && hasLinkedEvolution) return <>{legacyFallback}</>;

  if (record?.status === 'draft' && hasLinkedEvolution) {
    return <div className="rounded-2xl border border-pulse/30 bg-pulse/[0.04] p-4">
      <p className="font-display text-[14px] font-semibold text-pulse">Conflito no registro da consulta</p>
      <p className="mt-1 text-[12px] leading-relaxed text-fog">Uma evolução foi registrada enquanto este rascunho ainda estava aberto. Recarregue a consulta antes de continuar; nenhum conteúdo será sobrescrito automaticamente.</p>
    </div>;
  }

  if (record?.status === 'finalized') {
    return <div className="rounded-2xl border border-mint/30 bg-mint/[0.045] p-4">
      <div className="flex flex-wrap gap-2"><Chip className="border-mint/35 text-mint">Registro concluído ✓</Chip><Chip className="border-mint/35 text-mint">Atendimento finalizado ✓</Chip></div>
      <p className="mt-3 whitespace-pre-wrap text-[13px] leading-relaxed text-paper/90">{finalText}</p>
    </div>;
  }

  const statusLabel = saveState === 'saving' ? 'Salvando...'
    : saveState === 'saved' && !dirty ? 'Rascunho salvo'
      : saveState === 'conflict' ? 'Conflito de versão'
        : saveState === 'error' ? 'Erro ao salvar'
          : 'Não salvo';

  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line/65 bg-deep/25 px-4 py-3">
      <div><p className="font-display text-[14px] font-semibold text-paper">Registro da consulta</p><p className="mt-0.5 text-[11px] text-fog">Preencha somente o que for relevante para este atendimento.</p></div>
      <Chip className={saveState === 'saved' && !dirty ? 'border-mint/35 text-mint' : saveState === 'conflict' || saveState === 'error' ? 'border-pulse/35 text-pulse' : 'border-amber/35 text-amber'}>{statusLabel}</Chip>
    </div>

    <div className="grid gap-4 lg:grid-cols-2">
      <EncounterField label="Motivo / demandas" value={content.reason} onChange={(value) => change('reason', value)} placeholder="Motivo da consulta, demandas ou problemas trazidos pelo paciente…" />
      <EncounterField label="História atual" value={content.history} onChange={(value) => change('history', value)} placeholder="História do problema atual, evolução dos sintomas e contexto relevante…" />
      <EncounterField label="Achados / exame" value={content.findings} onChange={(value) => change('findings', value)} placeholder="Achados do exame, sinais, medidas ou observações clínicas relevantes…" />
      <EncounterField label="Avaliação clínica / problemas" value={content.assessment} onChange={(value) => change('assessment', value)} placeholder="Avaliação clínica, problemas acompanhados ou impressão do atendimento…" />
      <EncounterField label="Plano / conduta" value={content.plan} onChange={(value) => change('plan', value)} placeholder="Condutas, orientações, acompanhamento e plano de continuidade…" />
      <EncounterField label="Observações adicionais" value={content.additionalNotes} onChange={(value) => change('additionalNotes', value)} placeholder="Informação complementar opcional…" />
    </div>

    {message && <div className="rounded-xl border border-pulse/30 bg-pulse/[0.04] px-4 py-3 text-[11.5px] leading-relaxed text-fog">{message}</div>}

    <div className="flex flex-wrap items-center justify-end gap-2">
      <Btn variant="ghost" disabled={saveState === 'saving' || finalizing || (!dirty && record !== null)} onClick={() => void save()}>{saveState === 'saving' ? 'Salvando...' : 'Salvar rascunho'}</Btn>
      <Btn disabled={!record || dirty || !hasContent || saveState !== 'saved' || finalizing} onClick={() => setReviewOpen(true)}>Revisar e concluir</Btn>
    </div>

    <Modal open={reviewOpen} onClose={() => { if (!finalizing) setReviewOpen(false); }} title="Revisar registro da consulta" wide>
      <p className="text-[12.5px] leading-relaxed text-fog">Ao confirmar, este registro ficará definitivo, a evolução oficial será gerada a partir do conteúdo abaixo e o atendimento será encerrado.</p>
      <div className="mt-4 max-h-[50vh] overflow-y-auto whitespace-pre-wrap rounded-xl border border-line/70 bg-deep/35 p-4 text-[13px] leading-relaxed text-paper/90">{finalText}</div>
      <div className="mt-5 flex flex-wrap justify-end gap-2"><Btn variant="ghost" disabled={finalizing} onClick={() => setReviewOpen(false)}>Voltar e revisar</Btn><Btn disabled={finalizing} onClick={() => void finalize()}>{finalizing ? 'Concluindo…' : 'Confirmar e encerrar atendimento'}</Btn></div>
    </Modal>
  </div>;
}

function EncounterField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <label className="block"><span className="mb-1.5 block text-[12px] font-semibold text-paper/85">{label}</span><Textarea rows={5} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}
