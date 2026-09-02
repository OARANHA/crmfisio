import { useEffect, useMemo, useState } from 'react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useApp } from '../lib/store';
import { buildChurnRiskList } from '../lib/churnRisk';
import { supabase } from '../lib/supabaseClient';
import { fmtBRL } from '../lib/types';
import { Card, CardHead, Chip, IconChart } from '../lib/ui';

type RecoveryRoi = {
  from: string;
  to: string;
  realized_amount: number;
  pipeline_amount: number;
  events: number;
  overdue_payments: number;
  waitlist_slots: number;
  reactivations: number;
  package_renewals: number;
};

const emptyRoi: RecoveryRoi = {
  from: '',
  to: '',
  realized_amount: 0,
  pipeline_amount: 0,
  events: 0,
  overdue_payments: 0,
  waitlist_slots: 0,
  reactivations: 0,
  package_renewals: 0,
};

export function MonthlyRoiRetention({ month }: { month: string }) {
  const { patients, appointments, patientPackages, transactions } = useApp();
  const [roi, setRoi] = useState<RecoveryRoi>(emptyRoi);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const monthDate = new Date(`${month}-01T12:00:00`);
    const from = format(startOfMonth(monthDate), 'yyyy-MM-dd');
    const to = format(endOfMonth(monthDate), 'yyyy-MM-dd');
    setLoading(true);
    setError(null);

    supabase.rpc('get_recovery_roi', { p_from: from, p_to: to })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;
        if (rpcError) {
          setError('ROI atribuído indisponível para esta competência.');
          setRoi({ ...emptyRoi, from, to });
          return;
        }
        const raw = (data ?? {}) as Partial<RecoveryRoi>;
        setRoi({
          from,
          to,
          realized_amount: Number(raw.realized_amount ?? 0),
          pipeline_amount: Number(raw.pipeline_amount ?? 0),
          events: Number(raw.events ?? 0),
          overdue_payments: Number(raw.overdue_payments ?? 0),
          waitlist_slots: Number(raw.waitlist_slots ?? 0),
          reactivations: Number(raw.reactivations ?? 0),
          package_renewals: Number(raw.package_renewals ?? 0),
        });
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [month]);

  const retention = useMemo(() => {
    const risks = buildChurnRiskList(patients, appointments, patientPackages, transactions);
    const treatment = patients.filter((p) => p.funilStage === 'tratamento' && !p.anonimizado && p.status !== 'alta');
    const high = risks.filter((r) => r.level === 'alto');
    const medium = risks.filter((r) => r.level === 'medio');
    const withoutFuture = risks.filter((r) => !r.hasFutureAppointment);
    const packagePressure = patientPackages.filter((p) => {
      const remaining = Math.max(0, p.sessoesTotais - p.sessoesUsadas);
      return p.status === 'esgotado' || p.status === 'vencido' || (p.status === 'ativo' && remaining <= 2);
    });
    const protectedCount = Math.max(0, treatment.length - high.length - medium.length);
    const protectedRate = treatment.length ? Math.round((protectedCount / treatment.length) * 100) : 100;
    return { treatment, high, medium, withoutFuture, packagePressure, protectedRate };
  }, [patients, appointments, patientPackages, transactions]);

  const totalAttributed = roi.realized_amount + roi.pipeline_amount;

  return (
    <div className="space-y-4">
      <Card>
        <CardHead
          title="ROI e retenção MedicsPro"
          sub="receita atribuída às automações + risco operacional atual de continuidade"
          right={<IconChart className="w-4.5 h-4.5 text-mint" />}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line">
          <Metric label="Receita recuperada" value={loading ? '…' : fmtBRL(roi.realized_amount)} detail="valor realizado e atribuído" tone="text-mint" />
          <Metric label="Pipeline recuperável" value={loading ? '…' : fmtBRL(roi.pipeline_amount)} detail={`${roi.events} evento(s) atribuídos`} tone="text-aqua" />
          <Metric label="Retenção protegida" value={`${retention.protectedRate}%`} detail={`${retention.treatment.length} paciente(s) em tratamento`} tone="text-mint" />
          <Metric label="Alto risco de churn" value={String(retention.high.length)} detail={`${retention.withoutFuture.length} sem próxima sessão`} tone={retention.high.length ? 'text-pulse' : 'text-mint'} />
        </div>
        {error && <p className="px-5 py-3 border-t border-line font-mono text-[10.5px] text-amber">{error}</p>}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHead title="Origem da receita recuperada" sub={`competência ${month}`} />
          <div className="p-5 space-y-3">
            <Row label="Inadimplência recuperada" value={`${roi.overdue_payments} ocorrência(s)`} />
            <Row label="Vagas recuperadas da espera" value={`${roi.waitlist_slots} ocorrência(s)`} />
            <Row label="Reativações com agendamento" value={`${roi.reactivations} ocorrência(s)`} />
            <Row label="Renovações de pacote" value={`${roi.package_renewals} ocorrência(s)`} />
            <div className="pt-3 border-t border-line flex items-center justify-between gap-3">
              <span className="font-mono text-[11px] text-fog">Impacto atribuído total</span>
              <span className="font-display font-bold text-[20px] text-mint">{fmtBRL(totalAttributed)}</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHead title="Saúde da retenção" sub="sinais atuais que exigem ação operacional" />
          <div className="p-5 space-y-3">
            <Row label="Risco alto" value={`${retention.high.length} paciente(s)`} chip="border-pulse/40 text-pulse" />
            <Row label="Risco médio" value={`${retention.medium.length} paciente(s)`} chip="border-amber/45 text-amber" />
            <Row label="Sem próxima sessão" value={`${retention.withoutFuture.length} paciente(s)`} />
            <Row label="Pressão de renovação" value={`${retention.packagePressure.length} pacote(s)`} />
            <p className="pt-3 border-t border-line font-mono text-[10px] leading-relaxed text-fog/80">
              O score de churn é uma regra operacional explicável. Não é diagnóstico clínico nem previsão probabilística de IA.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Metric({ label, value, detail, tone }: { label: string; value: string; detail: string; tone: string }) {
  return (
    <div className="bg-panel px-5 py-4">
      <p className="font-mono text-[10px] tracking-[0.14em] uppercase text-fog">{label}</p>
      <p className={`font-display text-[24px] font-bold mt-1 ${tone}`}>{value}</p>
      <p className="font-mono text-[10px] text-fog/75 mt-0.5">{detail}</p>
    </div>
  );
}

function Row({ label, value, chip }: { label: string; value: string; chip?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-2.5 last:border-0">
      <span className="font-mono text-[11px] text-fog">{label}</span>
      {chip ? <Chip className={chip}>{value}</Chip> : <span className="font-mono text-[11.5px] text-paper">{value}</span>}
    </div>
  );
}
