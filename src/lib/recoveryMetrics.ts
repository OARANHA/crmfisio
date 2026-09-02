import { format } from 'date-fns';
import { supabase } from './supabaseClient';

export interface RecoveryRoi {
  from: string;
  to: string;
  realizedAmount: number;
  pipelineAmount: number;
  events: number;
  overduePayments: number;
  waitlistSlots: number;
  reactivations: number;
  packageRenewals: number;
}

const empty = (): RecoveryRoi => ({
  from: format(new Date(), 'yyyy-MM-01'),
  to: format(new Date(), 'yyyy-MM-dd'),
  realizedAmount: 0,
  pipelineAmount: 0,
  events: 0,
  overduePayments: 0,
  waitlistSlots: 0,
  reactivations: 0,
  packageRenewals: 0,
});

export async function loadRecoveryRoi(): Promise<RecoveryRoi | null> {
  const from = format(new Date(), 'yyyy-MM-01');
  const to = format(new Date(), 'yyyy-MM-dd');
  const { data, error } = await supabase.rpc('get_recovery_roi' as never, { p_from: from, p_to: to } as never);

  if (error) {
    // Permite deploy do frontend antes da migration sem quebrar o dashboard.
    if (error.code === '42883' || /get_recovery_roi/i.test(error.message ?? '')) return null;
    throw error;
  }

  const row = (data ?? {}) as unknown as Record<string, unknown>;
  const base = empty();
  return {
    from: String(row.from ?? base.from),
    to: String(row.to ?? base.to),
    realizedAmount: Number(row.realized_amount ?? 0),
    pipelineAmount: Number(row.pipeline_amount ?? 0),
    events: Number(row.events ?? 0),
    overduePayments: Number(row.overdue_payments ?? 0),
    waitlistSlots: Number(row.waitlist_slots ?? 0),
    reactivations: Number(row.reactivations ?? 0),
    packageRenewals: Number(row.package_renewals ?? 0),
  };
}
