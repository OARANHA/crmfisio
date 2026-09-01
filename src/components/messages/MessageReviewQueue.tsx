import type { Patient } from '../../lib/types';
import type { MessageOutboxRow } from '../../lib/messageOutbox';
import { Btn, Card, CardHead, Chip } from '../../lib/ui';

interface Props {
  logs: MessageOutboxRow[];
  patients: Patient[];
  busy?: boolean;
  onResolve: (logId: string, resolution: string, note?: string) => Promise<void> | void;
}

const actionLabel: Record<string, string> = {
  appointment_declined_review: 'Paciente recusou a confirmação',
  confirmation_needs_human: 'Resposta de confirmação não reconhecida',
  waitlist_interest_yes: 'Paciente quer a vaga',
  waitlist_interest_no: 'Paciente recusou a vaga',
  waitlist_needs_human: 'Resposta sobre vaga precisa de revisão',
  reactivation_interest_yes: 'Paciente quer retomar o tratamento',
  reactivation_needs_human: 'Resposta de reativação precisa de revisão',
  needs_human: 'Resposta precisa de revisão',
};

export function MessageReviewQueue({ logs, patients, busy, onResolve }: Props) {
  const pending = logs.filter((log) => log.needsHuman);

  return (
    <Card>
      <CardHead
        title="Revisão humana"
        sub={pending.length ? `${pending.length} resposta${pending.length === 1 ? '' : 's'} aguardando decisão operacional` : 'nenhuma resposta pendente'}
      />
      {!pending.length ? (
        <div className="px-5 py-7 text-[12px] text-fog">Respostas ambíguas, recusas e interesses que exigem decisão da recepção aparecerão aqui.</div>
      ) : (
        <div className="divide-y divide-line/70">
          {pending.slice(0, 20).map((log) => {
            const patient = patients.find((item) => item.id === log.patientId);
            const label = actionLabel[log.responseAction ?? ''] ?? 'Resposta recebida';
            return (
              <div key={log.id} className="px-5 py-4 space-y-3">
                <div className="flex flex-wrap gap-2 items-start">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display font-semibold text-[14px]">{patient?.nome ?? 'Paciente'}</p>
                      <Chip className="border-amber/35 text-amber">Revisar</Chip>
                    </div>
                    <p className="text-[12px] text-fog mt-1">{label}</p>
                  </div>
                  <span className="font-mono text-[10px] text-fog uppercase">{log.template}</span>
                </div>
                <div className="border border-line bg-raise/40 px-3 py-2.5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-fog mb-1">Resposta do paciente</p>
                  <p className="text-[13px] text-paper whitespace-pre-wrap">{log.replyText || 'Sem texto disponível'}</p>
                </div>
                <div className="flex flex-wrap gap-2 justify-end">
                  <Btn variant="subtle" disabled={busy} onClick={() => onResolve(log.id, 'handled_elsewhere')}>Já resolvido</Btn>
                  <Btn disabled={busy} onClick={() => onResolve(log.id, 'contacted_patient')}>Paciente contatado</Btn>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
