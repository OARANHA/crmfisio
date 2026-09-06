import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { hasProfessionalCapability } from '../lib/nexusClinical';
import {
  NEXUS_SELF_ASSESSMENT_SCALE_OPTIONS,
  nexusSelfAssessmentScaleLabel,
  normalizeNexusFunctionError,
  type NexusSelfAssessmentScaleKey,
} from '../lib/nexusSelfAssessmentUi';
import { Btn, Chip, Select } from '../lib/ui';

type InviteResponse = {
  inviteId?: string;
  waLogId?: string;
  scaleKey?: string;
  ruleVersion?: string;
  expiresAt?: string;
  status?: string;
  error?: string;
};

type Props = {
  patient: Patient;
  onInviteCreated?: () => void;
};

export function NexusSelfAssessmentInviteAction({ patient, onInviteCreated }: Props) {
  const { user, toast } = useApp();
  const [scaleKey, setScaleKey] = useState<NexusSelfAssessmentScaleKey>('phq9');
  const [busy, setBusy] = useState(false);
  const [lastInvite, setLastInvite] = useState<InviteResponse | null>(null);
  const [canInvite, setCanInvite] = useState<boolean | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      setCanInvite(false);
      return () => { active = false; };
    }

    setCanInvite(null);
    void hasProfessionalCapability('nexus.scales')
      .then((allowed) => {
        if (active) setCanInvite(allowed);
      })
      .catch((error) => {
        console.error('[Nexus] self-assessment capability:', error);
        if (active) setCanInvite(false);
      });

    return () => { active = false; };
  }, [user?.id]);

  const sendInvite = async () => {
    if (canInvite !== true || busy) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke<InviteResponse>('nexus-self-assessment-invite', {
        body: { patientId: patient.id, scaleKey, appointmentId: null, expiresHours: 48 },
      });
      if (error) throw error;
      if (!data || data.error || !data.inviteId || !data.waLogId) throw new Error(data?.error || 'O servidor não confirmou o envio do convite.');
      setLastInvite(data);
      onInviteCreated?.();
      toast(`${nexusSelfAssessmentScaleLabel(scaleKey)} enviado por WhatsApp. O link individual expira automaticamente.`);
    } catch (error) {
      console.error('[MedicsPro] convite Nexus:', error);
      toast(normalizeNexusFunctionError(error, 'Não foi possível enviar a autoavaliação Nexus.'), 'warn');
    } finally {
      setBusy(false);
    }
  };

  if (canInvite !== true) return null;
  const selected = NEXUS_SELF_ASSESSMENT_SCALE_OPTIONS.find((item) => item.value === scaleKey) ?? NEXUS_SELF_ASSESSMENT_SCALE_OPTIONS[0];

  return <section className="rounded-2xl border border-aqua/25 bg-aqua/[0.035] p-4">
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2"><p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-aqua">Nexus Clinical Engine</p><Chip className="border-aqua/25 bg-aqua/10 text-aqua">autoavaliação segura</Chip></div>
        <p className="mt-1 font-display text-[15px] font-semibold">Enviar avaliação para o paciente responder no celular</p>
        <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-fog">O paciente recebe um link individual pelo WhatsApp, responde sem acessar o prontuário e o resultado é processado pelo Nexus após o envio.</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div><label className="mb-1 block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-fog">Instrumento</label><Select value={scaleKey} onChange={(event) => setScaleKey(event.target.value as NexusSelfAssessmentScaleKey)} className="!w-auto min-w-[170px]">{NEXUS_SELF_ASSESSMENT_SCALE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} · {option.description}</option>)}</Select></div>
        <Btn onClick={() => void sendInvite()} disabled={busy}>{busy ? 'Enviando…' : `Enviar ${selected.label}`}</Btn>
      </div>
    </div>
    {lastInvite?.inviteId && <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-aqua/15 pt-3 text-[11.5px] text-fog"><Chip className="border-mint/25 bg-mint/10 text-mint">convite enfileirado</Chip><span>WhatsApp preparado para envio.</span>{lastInvite.expiresAt && <span>Expira em {new Date(lastInvite.expiresAt).toLocaleString('pt-BR')}.</span>}</div>}
  </section>;
}
