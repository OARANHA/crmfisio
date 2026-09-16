import { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  classifyClinicalEncounterAddendumError,
  createClinicalEncounterRecordAddendum,
  type ClinicalEncounterRecordAddendum,
  type ClinicalEncounterAddendumKind,
  type FinalizedEncounterRecordReference,
} from '../lib/clinicalEncounterAddendum';
import { useToast } from '../lib/toastContext';
import { Btn, Field, Modal, Select, Textarea } from '../lib/ui';

export function ClinicalEncounterAddendumPanel({
  record,
  addenda,
  canCreate,
  authorName,
  onCreated,
}: {
  record: FinalizedEncounterRecordReference;
  addenda: ClinicalEncounterRecordAddendum[];
  canCreate: boolean;
  authorName: (authorId: string) => string;
  onCreated: (item: ClinicalEncounterRecordAddendum) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ClinicalEncounterAddendumKind>('addendum');
  const [reason, setReason] = useState('');
  const [content, setContent] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const orderedAddenda = useMemo(
    () => [...addenda].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [addenda],
  );

  if (!canCreate && orderedAddenda.length === 0) return null;

  const begin = () => {
    if (!canCreate) return;
    setKind('addendum');
    setReason('');
    setContent('');
    setRequestId(globalThis.crypto.randomUUID());
    setMessage(null);
    setOpen(true);
  };

  const close = () => {
    if (submitting) return;
    setOpen(false);
  };
  const submit = async () => {
    if (!requestId || !reason.trim() || !content.trim() || submitting) return;
    setSubmitting(true);
    setMessage(null);
    try {
      const created = await createClinicalEncounterRecordAddendum(
        record.id,
        requestId,
        kind,
        reason,
        content,
      );
      onCreated(created);
      setOpen(false);
      toast(kind === 'correction' ? 'Retificação registrada no histórico.' : 'Adendo registrado no histórico.');
    } catch (error) {
      const errorKind = classifyClinicalEncounterAddendumError(error);
      if (errorKind === 'access_denied') {
        setMessage('Seu acesso atual não permite registrar este ato posterior. Recarregue antes de tentar novamente.');
      } else if (errorKind === 'record_not_finalized') {
        setMessage('O registro original não está em estado finalizado válido para retificação/adendo.');
      } else if (errorKind === 'idempotency_conflict') {
        setMessage('Esta tentativa já foi usada com outro conteúdo. Feche e abra novamente para gerar uma nova solicitação.');
      } else if (errorKind === 'invalid_content') {
        setMessage('Informe tipo, motivo e conteúdo clínico do ato posterior.');
      } else {
        console.error('[MedicsPro] retificação/adendo:', error);
        setMessage('Não foi possível registrar a retificação/adendo. O registro original não foi alterado.');
      }
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <div className="mt-4 space-y-3 border-l-2 border-aqua/25 pl-4">
      {orderedAddenda.map((item) => (
        <article key={item.id} className="rounded-2xl border border-aqua/20 bg-aqua/[0.035] p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full border border-aqua/30 bg-aqua/[0.06] px-2.5 py-1 text-[13px] font-semibold text-aqua">
              {item.kind === 'correction' ? 'Retificação' : 'Adendo'}
            </span>
            <span className="text-[14px] text-fog">
              {format(new Date(item.createdAt), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
            </span>
            <span className="text-[14px] text-fog">por {authorName(item.authorId)}</span>
          </div>
          <p className="mt-3 text-[16px] font-semibold text-paper">{item.reason}</p>
          <p className="mt-2 whitespace-pre-wrap text-[16px] leading-relaxed text-paper/90">{item.content}</p>
          <p className="mt-3 text-[14px] leading-relaxed text-fog">Ato posterior auditável · registro original preservado.</p>
        </article>
      ))}

      {canCreate && (
        <Btn type="button" variant="subtle" onClick={begin}>
          Registrar retificação/adendo
        </Btn>
      )}
      <Modal open={open} onClose={close} title="Registrar retificação ou adendo" wide>
        <div className="space-y-5">
          <div className="rounded-2xl border border-amber/25 bg-amber/[0.04] p-4">
            <p className="text-[16px] font-semibold text-paper">O registro original não será alterado.</p>
            <p className="mt-1 text-[15.5px] leading-relaxed text-fog">
              Este novo ato ficará permanentemente vinculado ao atendimento finalizado, com autor, data e motivo próprios.
            </p>
          </div>

          <Field label="Tipo do ato" hint="Use Retificação para corrigir uma informação objetiva; use Adendo para complementar o registro original.">
            <Select value={kind} onChange={(event) => setKind(event.target.value as ClinicalEncounterAddendumKind)} disabled={submitting}>
              <option value="addendum">Adendo</option>
              <option value="correction">Retificação</option>
            </Select>
          </Field>

          <Field label="Motivo" hint="Explique por que este ato posterior é necessário.">
            <Textarea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} disabled={submitting} placeholder="Ex.: complementar informação recebida após a conclusão do atendimento…" />
          </Field>

          <Field label="Conteúdo clínico" hint="Registre somente a informação que deve ser acrescentada ou retificada.">
            <Textarea rows={6} value={content} onChange={(event) => setContent(event.target.value)} disabled={submitting} placeholder="Descreva a informação clínica do adendo ou da retificação…" />
          </Field>
          {message && (
            <div className="rounded-xl border border-pulse/25 bg-pulse/[0.04] px-4 py-3 text-[15.5px] leading-relaxed text-fog">
              {message}
            </div>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-line/60 pt-4">
            <Btn type="button" variant="ghost" onClick={close} disabled={submitting}>Cancelar</Btn>
            <Btn
              type="button"
              onClick={() => void submit()}
              disabled={submitting || !reason.trim() || !content.trim()}
            >
              {submitting ? 'Registrando…' : kind === 'correction' ? 'Registrar retificação' : 'Registrar adendo'}
            </Btn>
          </div>
        </div>
      </Modal>
    </div>
  );
}
