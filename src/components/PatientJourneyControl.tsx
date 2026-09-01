import { useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../lib/store';
import { STAGE_META, type FunilStage, type Patient } from '../lib/types';
import { Btn, Field, Modal, Select, Textarea } from '../lib/ui';

type JourneyAction = {
  to: FunilStage;
  label: string;
  title: string;
  reasons: { value: string; label: string }[];
  clinical: boolean;
};

const DISCHARGE_REASONS = [
  { value: 'objetivos_atingidos', label: 'Objetivos terapêuticos atingidos' },
  { value: 'melhora_clinica', label: 'Melhora clínica / funcional' },
  { value: 'encaminhamento', label: 'Encaminhamento para outro profissional/serviço' },
  { value: 'alta_a_pedido', label: 'Alta a pedido do paciente' },
  { value: 'abandono', label: 'Abandono / interrupção do tratamento' },
];

const REOPEN_REASONS = [
  { value: 'recidiva', label: 'Recidiva / retorno de sintomas' },
  { value: 'nova_necessidade', label: 'Nova necessidade clínica relacionada' },
  { value: 'manutencao', label: 'Retorno para manutenção' },
  { value: 'correcao_administrativa', label: 'Correção de alta lançada por engano' },
];

export function PatientJourneyControl({ patient }: { patient: Patient }) {
  const { user, toast } = useApp();
  const [action, setAction] = useState<JourneyAction | null>(null);
  const [reason, setReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const available = useMemo<JourneyAction[]>(() => {
    if (!user) return [];

    if (patient.funilStage === 'lead' && ['admin', 'fisio', 'recep'].includes(user.role)) {
      return [{
        to: 'avaliacao',
        label: 'Encaminhar para avaliação',
        title: 'Encaminhar paciente para avaliação',
        reasons: [{ value: 'avaliacao_agendada', label: 'Avaliação indicada/agendada' }],
        clinical: false,
      }];
    }

    if (patient.funilStage === 'avaliacao' && user.role === 'fisio') {
      return [{
        to: 'tratamento',
        label: 'Iniciar tratamento',
        title: 'Iniciar plano de tratamento',
        reasons: [{ value: 'plano_terapeutico_definido', label: 'Plano terapêutico definido' }],
        clinical: true,
      }];
    }

    if (patient.funilStage === 'tratamento' && user.role === 'fisio') {
      return [{
        to: 'alta',
        label: 'Registrar alta clínica',
        title: 'Registrar alta clínica',
        reasons: DISCHARGE_REASONS,
        clinical: true,
      }];
    }

    if (patient.funilStage === 'alta' && ['admin', 'fisio'].includes(user.role)) {
      return [{
        to: 'tratamento',
        label: user.role === 'fisio' ? 'Reabrir tratamento' : 'Corrigir / reabrir tratamento',
        title: 'Reabrir tratamento preservando a alta anterior',
        reasons: user.role === 'fisio'
          ? REOPEN_REASONS
          : REOPEN_REASONS.filter((r) => r.value === 'correcao_administrativa'),
        clinical: user.role === 'fisio',
      }];
    }

    return [];
  }, [patient.funilStage, user]);

  if (!user || available.length === 0) return null;

  const open = (next: JourneyAction) => {
    setAction(next);
    setReason(next.reasons[0]?.value ?? '');
    setNotes('');
  };

  const close = () => {
    if (saving) return;
    setAction(null);
    setReason('');
    setNotes('');
  };

  const confirm = async () => {
    if (!action || !reason) return;
    setSaving(true);
    const { error } = await supabase.rpc('transition_patient_journey', {
      p_patient_id: patient.id,
      p_to_stage: action.to,
      p_reason: reason,
      p_notes: notes.trim() || null,
    });
    setSaving(false);

    if (error) {
      console.error('[MedicsPro] transição de jornada:', error);
      toast(error.message || 'Não foi possível atualizar a jornada.', 'warn');
      return;
    }

    toast(action.to === 'alta'
      ? 'Alta clínica registrada com rastreabilidade.'
      : action.to === 'tratamento' && patient.funilStage === 'alta'
        ? 'Tratamento reaberto; a alta anterior foi preservada no histórico.'
        : `Paciente movido para ${STAGE_META[action.to].label}.`);

    close();
    window.setTimeout(() => window.location.reload(), 300);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {available.map((item) => (
          <Btn key={`${patient.id}-${item.to}`} variant="subtle" onClick={() => open(item)}>
            {item.label}
          </Btn>
        ))}
      </div>

      <Modal open={Boolean(action)} onClose={close} title={action?.title ?? 'Atualizar jornada'}>
        {action && (
          <div className="space-y-4">
            <div className="border border-line bg-deep px-4 py-3 text-[12.5px] text-fog leading-relaxed">
              <span className="text-paper font-semibold">{STAGE_META[patient.funilStage].label}</span>
              {' → '}
              <span className="text-mint font-semibold">{STAGE_META[action.to].label}</span>
              {action.clinical && <span className="block mt-1 text-amber">Decisão clínica auditada em nome do profissional autenticado.</span>}
            </div>

            <Field label="Motivo" hint="obrigatório e registrado no histórico">
              <Select value={reason} onChange={(e) => setReason(e.target.value)}>
                {action.reasons.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </Select>
            </Field>

            <Field label="Observações" hint="contexto clínico/administrativo opcional">
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Registre informações relevantes para a decisão e continuidade do cuidado." />
            </Field>

            <div className="flex justify-end gap-2 pt-2">
              <Btn variant="ghost" onClick={close} disabled={saving}>Cancelar</Btn>
              <Btn onClick={confirm} disabled={saving || !reason}>{saving ? 'Registrando…' : 'Confirmar transição'}</Btn>
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
