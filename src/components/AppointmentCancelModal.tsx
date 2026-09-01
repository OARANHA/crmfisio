import { useState } from 'react';
import type { Appointment } from '../lib/types';
import { Btn, Field, Input, Modal } from '../lib/ui';

interface Props {
  appointment: Appointment | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  busy?: boolean;
}

export function AppointmentCancelModal({ appointment, onClose, onConfirm, busy = false }: Props) {
  const [key, setKey] = useState('');
  const [reason, setReason] = useState('');

  if (appointment && appointment.id !== key) {
    setKey(appointment.id);
    setReason('');
  }

  return (
    <Modal open={!!appointment} onClose={onClose} title="Cancelar sessão">
      {appointment && (
        <div className="space-y-4">
          <div className="border border-amber/35 bg-amber/[0.05] p-3 text-[12px] text-paper/90">
            O cancelamento fica registrado no histórico da agenda. Para mudar data ou horário, prefira <strong>Remarcar</strong>.
          </div>
          <Field label="Motivo do cancelamento">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ex.: paciente solicitou cancelamento" autoFocus />
          </Field>
          <div className="flex justify-end gap-2">
            <Btn variant="ghost" onClick={onClose}>Voltar</Btn>
            <Btn disabled={busy || reason.trim().length < 3} onClick={() => onConfirm(reason.trim())}>
              {busy ? 'Cancelando…' : 'Confirmar cancelamento'}
            </Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
