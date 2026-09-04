import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { Btn, Chip, Select } from '../lib/ui';
import { NexusSelfAssessmentStatus } from './NexusSelfAssessmentStatus';

type ScaleKey = 'phq9' | 'gad7';

type InviteResponse = {
  inviteId?: string;
  waLogId?: string;
  scaleKey?: string;
  ruleVersion?: string;
  expiresAt?: string;
  status?: string;
  error?: string;
};

const SCALE_OPTIONS: Array<{ value: ScaleKey; label: string; description: string }> = [
  { value: 'phq9', label: 'PHQ-9', description: 'Sintomas depressivos' },
  { value: 'gad7', label: 'GAD-7', description: 'Sintomas de ansiedade' },
];

function normalizeFunctionError(error: unknown, fallback: string) {
  if (!error) return fallback;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim();
    if (message) return message;
  }
  return fallback;
}

export function NexusSelfAssessmentInviteAction({ patient }: { patient: Patient }) {
  const { user, toast } = useApp();
  const [scaleKey, setScaleKey] = useState<ScaleKey>('phq9');
  const [busy, setBusy] = useState(false);
  const [lastInvite, setLastInvite] = useState<InviteResponse | null>(null);
  const [historyKey, setHistoryKey] = useState(0);

  // O backend continua sendo a fronteira real de autorização/capability.
  // A UI apenas evita apresentar uma ação clínica para perfis administrativos legados.
  const canInvite = user?.role === 'fisio';

  const sendInvite = async () => {
    if (!canInvite || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<InviteResponse>('nexus-self-assessment-invite', {
        body: {
          patientId: patient.id,
          scaleKey,
          appointmentId: null,
          expiresHours: 48,
        },
      });

      if (error) throw error;
      if (!data || data.error || !data.inviteId || !data.waLogId) {
        throw new Error(data?.error || 'O servidor não confirmou o envio do convite.');
      }

      setLastInvite(data);
      setHistoryKey((value) => value + 1);
      const label = SCALE_OPTIONS.find((item) => item.value === scaleKey)?.label ?? scaleKey.toUpperCase();
      toast(`${label} enviado por WhatsApp. O link individual expira automaticamente.`);
    } catch (error) {
      console.error('[MedicsPro] convite Nexus:', error);
      toast(normalizeFunctionError(error, 'Não foi possível enviar a autoavaliação Nexus.'), 'warn');
    } finally {
      setBusy(false);
    }
  };

  if (!canInvite) return null;

  const selected = SCALE_OPTIONS.find((item) => item.value === scaleKey) ?? SCALE_OPTIONS[0];

  return (
    <div className="space-y-3">
      <section className="rounded-2xl border border-aqua/25 bg-aqua/[0.035] p-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-aqua">Nexus Clinical Engine</p>
              <Chip className="border-aqua/25 bg-aqua/10 text-aqua">autoavaliação segura</Chip>
            </div>
            <p className="mt-1 font-display text-[15px] font-semibold">Enviar avaliação para o paciente responder no celular</p>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-fog">
              O paciente recebe um link individual pelo WhatsApp, responde sem acessar o prontuário e o resultado é processado pelo Nexus após o envio.
            </p>
          </div>

          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fog">Instrumento</label>
              <Select value={scaleKey} onChange={(event) => setScaleKey(event.target.value as ScaleKey)} className="!w-auto min-w-[170px]">
                {SCALE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label} · {option.description}</option>
                ))}
              </Select>
            </div>
            <Btn onClick={() => void sendInvite()} disabled={busy}>
              {busy ? 'Enviando…' : `Enviar ${selected.label}`}
            </Btn>
          </div>
        </div>

        {lastInvite?.inviteId && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-aqua/15 pt-3 text-[11.5px] text-fog">
            <Chip className="border-mint/25 bg-mint/10 text-mint">convite enfileirado</Chip>
            <span>WhatsApp preparado para envio.</span>
            {lastInvite.expiresAt && <span>Expira em {new Date(lastInvite.expiresAt).toLocaleString('pt-BR')}.</span>}
          </div>
        )}
      </section>

      <NexusSelfAssessmentStatus key={`${patient.id}:${historyKey}`} patient={patient} />
    </div>
  );
}
