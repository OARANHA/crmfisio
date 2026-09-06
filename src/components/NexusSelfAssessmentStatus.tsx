import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useApp } from '../lib/store';
import type { Patient } from '../lib/types';
import { acknowledgeNexusRedFlag, hasProfessionalCapability } from '../lib/nexusClinical';
import { Btn, Chip } from '../lib/ui';

type InviteRow = {
  id: string;
  scale_key: string;
  rule_version: string;
  status: string;
  created_at: string;
  opened_at: string | null;
  submitted_at: string | null;
  expires_at: string;
  processed_result_id: string | null;
  processing_attempts: number;
  last_processing_error: string | null;
};

type ResultRow = {
  id: string;
  tool_key: string;
  rule_version: string;
  status: string;
  total_score: number | null;
  max_score: number | null;
  classification: string | null;
  severity: string | null;
  finalized_at: string | null;
};

type RedFlagRow = {
  id: string;
  result_id: string;
  flag_code: string;
  severity: string;
  title: string;
  message: string;
  required_action: string | null;
  created_at: string;
  acknowledged_at: string | null;
};

type AssessmentStatus = InviteRow & {
  result: ResultRow | null;
  redFlags: RedFlagRow[];
};

const SCALE_LABEL: Record<string, string> = { phq9: 'PHQ-9', gad7: 'GAD-7' };
const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Aguardando resposta', cls: 'border-amber/30 bg-amber/10 text-amber' },
  opened: { label: 'Aberto pelo paciente', cls: 'border-aqua/30 bg-aqua/10 text-aqua' },
  submitted: { label: 'Aguardando processamento', cls: 'border-aqua/30 bg-aqua/10 text-aqua' },
  processed: { label: 'Processado', cls: 'border-mint/30 bg-mint/10 text-mint' },
  revoked: { label: 'Revogado', cls: 'border-fog/25 bg-fog/10 text-fog' },
  expired: { label: 'Expirado', cls: 'border-fog/25 bg-fog/10 text-fog' },
};

function fmtDate(value: string | null | undefined) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

export function NexusSelfAssessmentStatus({ patient }: { patient: Patient }) {
  const { user, toast } = useApp();
  const [items, setItems] = useState<AssessmentStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const db = supabase as any;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const canReadScales = await hasProfessionalCapability('nexus.scales');
      setAllowed(canReadScales);
      if (!canReadScales) {
        setItems([]);
        return;
      }

      const { data: invites, error: inviteError } = await db
        .from('nexus_self_assessment_invites')
        .select('id,scale_key,rule_version,status,created_at,opened_at,submitted_at,expires_at,processed_result_id,processing_attempts,last_processing_error')
        .eq('patient_id', patient.id)
        .order('created_at', { ascending: false })
        .limit(8);
      if (inviteError) throw inviteError;

      const rows = (invites ?? []) as InviteRow[];
      const resultIds = rows.map((item) => item.processed_result_id).filter(Boolean) as string[];
      let results: ResultRow[] = [];
      let redFlags: RedFlagRow[] = [];
      if (resultIds.length > 0) {
        const [{ data: resultData, error: resultError }, { data: flagData, error: flagError }] = await Promise.all([
          db.from('nexus_clinical_results').select('id,tool_key,rule_version,status,total_score,max_score,classification,severity,finalized_at').in('id', resultIds),
          db.from('nexus_red_flags').select('id,result_id,flag_code,severity,title,message,required_action,created_at,acknowledged_at').in('result_id', resultIds),
        ]);
        if (resultError) throw resultError;
        if (flagError) throw flagError;
        results = (resultData ?? []) as ResultRow[];
        redFlags = (flagData ?? []) as RedFlagRow[];
      }

      setItems(rows.map((invite) => ({
        ...invite,
        result: results.find((result) => result.id === invite.processed_result_id) ?? null,
        redFlags: redFlags.filter((flag) => flag.result_id === invite.processed_result_id),
      })));
    } catch (cause) {
      console.error('[MedicsPro] status autoavaliação Nexus:', cause);
      setError('Não foi possível carregar o histórico de autoavaliações.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [patient.id]);

  useEffect(() => { void load(); }, [load]);

  const acknowledge = async (flagId: string) => {
    if (!user || acknowledgingId) return;
    setAcknowledgingId(flagId);
    try {
      await acknowledgeNexusRedFlag(flagId, user.id);
      toast('Alerta Nexus reconhecido. O registro clínico permanece preservado no histórico.', 'info');
      await load();
    } catch (cause) {
      console.error('[MedicsPro] reconhecer red flag Nexus:', cause);
      toast('Não foi possível reconhecer o alerta Nexus.', 'warn');
    } finally {
      setAcknowledgingId(null);
    }
  };

  const openFlags = useMemo(() => items.flatMap((item) => item.redFlags).filter((flag) => !flag.acknowledged_at), [items]);

  if (allowed === false) return null;

  return <section className="rounded-2xl border border-line bg-panel/70 p-4">
    <div className="flex flex-wrap items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-aqua">Nexus · acompanhamento</p>
        <h3 className="mt-1 font-display text-[15px] font-semibold">Autoavaliações recentes</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-fog">Acompanhe envio, abertura, resposta e resultado processado sem sair do prontuário.</p>
      </div>
      <div className="flex items-center gap-2">{openFlags.length > 0 && <Chip className="border-pulse/35 bg-pulse/10 text-pulse">{openFlags.length} alerta(s) aberto(s)</Chip>}<Btn variant="ghost" onClick={() => void load()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</Btn></div>
    </div>

    {error && <div className="mt-3 rounded-xl border border-amber/25 bg-amber/[0.05] px-3 py-2 text-[12px] text-amber">{error}</div>}
    {!loading && !error && items.length === 0 && <div className="mt-3 rounded-xl border border-dashed border-line px-4 py-5 text-[12.5px] text-fog">Nenhuma autoavaliação Nexus enviada para este paciente.</div>}

    {items.length > 0 && <div className="mt-3 divide-y divide-line/60 overflow-hidden rounded-xl border border-line/70 bg-deep/45">
      {items.map((item) => {
        const status = STATUS_META[item.status] ?? { label: item.status, cls: 'border-line bg-panel text-fog' };
        const result = item.result;
        return <article key={item.id} className="p-3.5">
          <div className="flex flex-wrap items-start gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="font-display text-[13.5px] font-semibold">{SCALE_LABEL[item.scale_key] ?? item.scale_key.toUpperCase()}</span><Chip className={status.cls}>{status.label}</Chip>{item.redFlags.some((flag) => !flag.acknowledged_at) && <Chip className="border-pulse/35 bg-pulse/10 text-pulse">red flag</Chip>}</div>
              <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[10.5px] text-fog"><span>enviado {fmtDate(item.created_at)}</span>{item.opened_at && <span>aberto {fmtDate(item.opened_at)}</span>}{item.submitted_at && <span>respondido {fmtDate(item.submitted_at)}</span>}</div>
            </div>
            {result && <div className="min-w-[190px] rounded-lg border border-line/70 bg-panel/70 px-3 py-2 text-right"><p className="font-mono text-[10px] uppercase tracking-[0.08em] text-fog">Resultado finalizado</p><p className="mt-1 font-display text-[17px] font-bold text-paper">{result.total_score ?? '—'}{result.max_score != null ? ` / ${result.max_score}` : ''}</p><p className="mt-0.5 text-[11.5px] text-fog">{result.classification || result.severity || 'Classificação não informada'}</p></div>}
          </div>
          {item.status === 'submitted' && item.processing_attempts === 0 && <p className="mt-2 text-[11.5px] text-aqua">Resposta recebida. O processor automático deve concluir no próximo ciclo.</p>}
          {item.last_processing_error && <p className="mt-2 rounded-lg border border-pulse/25 bg-pulse/[0.04] px-2.5 py-2 text-[11.5px] text-pulse">Falha de processamento registrada. O dado clínico não foi finalizado silenciosamente.</p>}
          {item.redFlags.length > 0 && <div className="mt-2 space-y-1.5">{item.redFlags.map((flag) => <div key={flag.id} className="rounded-lg border border-pulse/25 bg-pulse/[0.035] px-2.5 py-2"><div className="flex flex-wrap items-start gap-2"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className="text-[11.5px] font-semibold text-pulse">{flag.title}</span><span className="font-mono text-[10px] uppercase text-fog">{flag.severity}</span>{flag.acknowledged_at ? <span className="text-[10.5px] text-mint">reconhecido</span> : <span className="text-[10.5px] text-pulse">aberto</span>}</div><p className="mt-1 text-[11px] leading-relaxed text-fog">{flag.message}</p>{flag.required_action && <p className="mt-1 text-[10.5px] font-medium leading-relaxed text-pulse">{flag.required_action}</p>}</div>{!flag.acknowledged_at && <Btn variant="ghost" onClick={() => void acknowledge(flag.id)} disabled={acknowledgingId !== null}>{acknowledgingId === flag.id ? 'Reconhecendo…' : 'Reconhecer alerta'}</Btn>}</div></div>)}</div>}
          {item.redFlags.some((flag) => flag.acknowledged_at) && <p className="mt-2 text-[10.5px] leading-relaxed text-fog">Reconhecer confirma revisão do alerta; não apaga o achado nem substitui avaliação, registro ou conduta clínica.</p>}
        </article>;
      })}
    </div>}
  </section>;
}
