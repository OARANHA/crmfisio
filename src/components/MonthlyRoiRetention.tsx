import { useEffect, useMemo, useState } from 'react';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { useAgenda } from '../lib/agendaContext';
import { useFinance } from '../lib/financeContext';
import { usePatients } from '../lib/patientContext';
import { usePackages } from '../lib/packageContext';
import { buildChurnRiskList } from '../lib/churnRisk';
import { calculateLowRiskShare } from '../lib/reportMetrics';
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
  const { transactions } = useFinance();
  const { patients } = usePatients();
  const { appointments } = useAgenda();
  const { patientPackages } = usePackages();
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

    const loadRoi = async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc('get_recovery_roi', { p_from: from, p_to: to });
        if (cancelled) return;
        if (rpcError) {
          setError('Eventos de recuperação indisponíveis para esta competência.');
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
      } catch (requestError) {
        console.error('[MedicsPro] relatório de eventos de recuperação:', requestError);
        if (!cancelled) {
          setError('Não foi possível carregar os eventos de recuperação desta competência.');
          setRoi({ ...emptyRoi, from, to });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadRoi();

    return () => { cancelled = true; };
  }, [month]);

  const continuity = useMemo(() => {
    const risks = buildChurnRiskList(patients, appointments, patientPackages, transactions);
    const treatment = patients.filter((p) => p.funilStage === 'tratamento' && !p.anonimizado && p.status !== 'alta');
    const treatmentIds = new Set(treatment.map((patient) => patient.id));
    const treatmentRisks = risks.filter((risk) => treatmentIds.has(risk.patientId));
    const high = treatmentRisks.filter((r) => r.level === 'alto');
    const medium = treatmentRisks.filter((r) => r.level === 'medio');
    const withoutFuture = treatmentRisks.filter((r) => !r.hasFutureAppointment);
    const packagePressure = patientPackages.filter((p) => {
      if (!treatmentIds.has(p.pacienteId)) return false;
      const remaining = Math.max(0, p.sessoesTotais - p.sessoesUsadas);
      return p.status === 'esgotado' || p.status === 'vencido' || (p.status === 'ativo' && remaining <= 2);
    });
    const lowRiskShare = calculateLowRiskShare(treatment.length, high.length, medium.length);
    return { treatment, high, medium, withoutFuture, packagePressure, lowRiskShare };
  }, [patients, appointments, patientPackages, transactions]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHead
          title="Recuperação de receita e continuidade"
          sub="eventos financeiros e operacionais de recuperação + risco atual da carteira em tratamento"
          right={<IconChart className="w-4.5 h-4.5 text-mint" />}
        />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-line">
          <Metric label="Realizado registrado" value={loading ? '…' : fmtBRL(roi.realized_amount)} detail="valor realizado nos eventos registrados" tone="text-mint" />
          <Metric label="Pipeline registrado" value={loading ? '…' : fmtBRL(roi.pipeline_amount)} detail="potencial ainda não realizado" tone="text-aqua" />
          <Metric
            label="Baixo risco atual"
            value={continuity.lowRiskShare === null ? '—' : `${continuity.lowRiskShare}%`}
            detail={continuity.treatment.length ? `${continuity.treatment.length} paciente(s) em tratamento` : 'sem pacientes em tratamento na base atual'}
            tone={continuity.lowRiskShare === null ? 'text-fog' : 'text-mint'}
          />
          <Metric label="Alto risco atual" value={String(continuity.high.length)} detail={`${continuity.withoutFuture.length} sem próxima sessão`} tone={continuity.high.length ? 'text-pulse' : 'text-mint'} />
        </div>
        {error && <p className="px-5 py-3 border-t border-line font-mono text-[10.5px] text-amber">{error}</p>}
      </Card>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card>
          <CardHead title="Origem dos eventos de recuperação" sub={`eventos ocorridos na competência ${month}`} />
          <div className="p-5 space-y-3">
            <Row label="Inadimplência recuperada" value={`${roi.overdue_payments} ocorrência(s)`} />
            <Row label="Vagas recuperadas da espera" value={`${roi.waitlist_slots} ocorrência(s)`} />
            <Row label="Reativações com agendamento" value={`${roi.reactivations} ocorrência(s)`} />
            <Row label="Renovações de pacote" value={`${roi.package_renewals} ocorrência(s)`} />
            <div className="pt-3 border-t border-line grid gap-2 sm:grid-cols-2">
              <div>
                <span className="block font-mono text-[10px] text-fog">Realizado</span>
                <span className="font-display font-bold text-[18px] text-mint">{fmtBRL(roi.realized_amount)}</span>
              </div>
              <div className="sm:text-right">
                <span className="block font-mono text-[10px] text-fog">Pipeline</span>
                <span className="font-display font-bold text-[18px] text-aqua">{fmtBRL(roi.pipeline_amount)}</span>
              </div>
            </div>
            <p className="pt-2 font-mono text-[9.5px] leading-relaxed text-fog/80">
              Realizado e pipeline não são somados como receita. Os eventos registram recuperação observada pelo sistema; quando não existe vínculo causal explícito com uma automação, o painel não atribui o resultado exclusivamente à automação.
            </p>
          </div>
        </Card>

        <Card>
          <CardHead title="Risco atual de continuidade" sub="snapshot operacional da carteira em tratamento — não é uma taxa histórica de retenção" />
          <div className="p-5 space-y-3">
            <Row label="Risco alto" value={`${continuity.high.length} paciente(s)`} chip="border-pulse/40 text-pulse" />
            <Row label="Risco médio" value={`${continuity.medium.length} paciente(s)`} chip="border-amber/45 text-amber" />
            <Row label="Sem próxima sessão" value={`${continuity.withoutFuture.length} paciente(s)`} />
            <Row label="Pressão de renovação" value={`${continuity.packagePressure.length} pacote(s)`} />
            <p className="pt-3 border-t border-line font-mono text-[10px] leading-relaxed text-fog/80">
              O score de churn é uma regra operacional explicável e representa o estado atual. Não é diagnóstico clínico, previsão probabilística de IA nem retenção histórica comprovada.
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
