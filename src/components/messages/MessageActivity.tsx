import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Patient } from '../../lib/types';
import type { MessageOutboxRow, MessageStatus, MessageTemplate } from '../../lib/messageOutbox';
import { Card, CardHead, Chip } from '../../lib/ui';

const STATUS_META: Record<MessageStatus, { label: string; chip: string; dot: string }> = {
  fila: { label: 'na fila', chip: 'border-fog/40 text-fog', dot: '#94b0a4' },
  enviando: { label: 'enviando…', chip: 'border-amber/45 text-amber', dot: '#f2b441' },
  enviado: { label: 'enviado', chip: 'border-steel/40 text-steel', dot: '#9ab8c9' },
  entregue: { label: 'entregue ✓', chip: 'border-aqua/40 text-aqua', dot: '#6ec1e4' },
  lido: { label: 'lido ✓✓', chip: 'border-mint/40 text-mint', dot: '#4fd1a5' },
  falhou: { label: 'falhou', chip: 'border-pulse/45 text-pulse', dot: '#f2545b' },
  cancelado: { label: 'cancelado', chip: 'border-fog/30 text-fog', dot: '#7f938b' },
};

const TEMPLATE_LABEL: Record<MessageTemplate, string> = {
  confirmacao: 'Confirmação de sessão',
  nps: 'Pesquisa NPS',
  reativacao: 'Reativação',
  vaga_espera: 'Oferta de vaga',
};

function responseMeta(log: MessageOutboxRow) {
  if (!log.replyText) return null;
  if (log.template === 'nps') {
    const score = Number(log.replyText.trim());
    if (Number.isFinite(score) && score >= 0 && score <= 10) {
      const group = score >= 9 ? 'Promotor' : score >= 7 ? 'Neutro' : 'Detrator';
      const chip = score >= 9 ? 'border-mint/45 text-mint' : score >= 7 ? 'border-amber/45 text-amber' : 'border-pulse/45 text-pulse';
      return { text: `Respondido: ${score}/10`, group, chip };
    }
  }
  if (log.template === 'confirmacao' && log.responseAction === 'appointment_confirmed') {
    return { text: `Resposta: ${log.replyText}`, group: 'Sessão confirmada', chip: 'border-mint/45 text-mint' };
  }
  return { text: `Resposta: ${log.replyText}`, group: log.needsHuman ? 'Requer revisão' : 'Resposta recebida', chip: log.needsHuman ? 'border-amber/45 text-amber' : 'border-aqua/45 text-aqua' };
}

export function MessageActivity({ logs, patients }: { logs: MessageOutboxRow[]; patients: Patient[] }) {
  return (
    <Card>
      <CardHead title="Atividade recente" sub="envios, estados de entrega e respostas recebidas pelo WhatsApp" />
      <ul className="divide-y divide-line/70 max-h-[720px] overflow-y-auto">
        {logs.length === 0 && <li className="px-5 py-10 text-center font-mono text-[11.5px] text-fog">Nenhuma mensagem enfileirada ainda.</li>}
        {logs.map((log) => {
          const patient = patients.find((item) => item.id === log.patientId);
          const meta = STATUS_META[log.status];
          const response = responseMeta(log);
          return (
            <li key={log.id} className="px-5 py-3.5 flex items-start gap-3.5 hover:bg-raise/40 transition-colors">
              <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${log.status === 'enviando' ? 'dot-live' : ''}`} style={{ background: meta.dot }} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="font-display font-semibold text-[13px]">{patient?.nome ?? 'Paciente'}</span>
                  <span className="font-mono text-[10px] text-fog uppercase tracking-wide">{TEMPLATE_LABEL[log.template]}</span>
                  <span className="font-mono text-[10px] text-fog/70 ml-auto tabular-nums">{format(new Date(log.createdAt), 'dd/MM HH:mm', { locale: ptBR })}</span>
                </div>
                <p className="text-[12px] text-paper/80 leading-relaxed mt-1 line-clamp-2">{log.message}</p>
                {response && (
                  <div className="mt-2 px-3 py-2 border border-line/80 bg-raise/35 flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[11px] text-paper">{response.text}</span>
                    <Chip className={response.chip}>{response.group}</Chip>
                    {log.repliedAt && <span className="font-mono text-[9.5px] text-fog ml-auto">{format(new Date(log.repliedAt), 'dd/MM HH:mm', { locale: ptBR })}</span>}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <Chip className={meta.chip}>{meta.label}</Chip>
                  {log.provider && <span className="font-mono text-[10px] text-fog">provider: {log.provider}</span>}
                  {patient && !patient.optInWhats && <Chip className="border-pulse/40 text-pulse">sem opt-in</Chip>}
                  {log.errorMessage && <span className="font-mono text-[10px] text-pulse">{log.errorMessage}</span>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
