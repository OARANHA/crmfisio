import { useEffect, useState } from 'react';
import { fmtBRL } from '../../lib/types';
import { loadRecoveryRoi, type RecoveryRoi } from '../../lib/recoveryMetrics';
import { Card, CardHead, Chip } from '../../lib/ui';

export function RecoveryImpactCard() {
  const [roi, setRoi] = useState<RecoveryRoi | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    loadRecoveryRoi()
      .then((data) => { if (active) setRoi(data); })
      .catch((error) => console.error('[MedicsPro] recovery ROI:', error))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  if (!loading && !roi) return null;

  return <Card className="border-mint/25">
    <CardHead
      title="Impacto financeiro atribuído ao MedicsPro"
      sub="mês atual · separa receita realizada de receita agendada/em recuperação"
      right={<Chip className="border-mint/40 text-mint">ROI operacional</Chip>}
    />
    <div className="p-5">
      {loading && <p className="font-mono text-[11px] text-fog">Calculando impacto…</p>}
      {roi && <>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-px bg-line border border-line">
          <div className="bg-panel px-4 py-4">
            <p className="font-mono text-[10px] uppercase text-fog">Receita recuperada</p>
            <p className="font-display text-2xl font-bold text-mint mt-1">{fmtBRL(roi.realizedAmount)}</p>
            <p className="font-mono text-[10px] text-fog mt-1">valor efetivamente realizado</p>
          </div>
          <div className="bg-panel px-4 py-4">
            <p className="font-mono text-[10px] uppercase text-fog">Em recuperação</p>
            <p className="font-display text-2xl font-bold text-aqua mt-1">{fmtBRL(roi.pipelineAmount)}</p>
            <p className="font-mono text-[10px] text-fog mt-1">agenda recuperada / reativada</p>
          </div>
          <div className="bg-panel px-4 py-4">
            <p className="font-mono text-[10px] uppercase text-fog">Ações atribuídas</p>
            <p className="font-display text-2xl font-bold text-paper mt-1">{roi.events}</p>
            <p className="font-mono text-[10px] text-fog mt-1">eventos mensuráveis no mês</p>
          </div>
          <div className="bg-panel px-4 py-4">
            <p className="font-mono text-[10px] uppercase text-fog">Origem</p>
            <p className="font-mono text-[10.5px] text-paper mt-2 leading-5">
              {roi.overduePayments} cobrança(s) · {roi.waitlistSlots} vaga(s)<br />
              {roi.reactivations} reativação(ões) · {roi.packageRenewals} renovação(ões)
            </p>
          </div>
        </div>
        <p className="font-mono text-[10px] text-fog mt-3">Receita agendada não é contabilizada como caixa realizado até existir um evento financeiro efetivo.</p>
      </>}
    </div>
  </Card>;
}
