import { useEffect, useMemo, useState } from 'react';
import { cancelAppointmentSeries, listAppointmentSeries, type AppointmentSeriesSummary } from '../lib/appointmentRecurrence';
import { useApp, patientName, userName } from '../lib/store';
import { Btn, Card, Input } from '../lib/ui';

const DAY_LABEL: Record<number, string> = {
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
  7: 'Dom',
};

const formatDate = (value: string) => new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');

export function AppointmentSeriesManager() {
  const { user, users, patients, appointments, toast } = useApp();
  const [series, setSeries] = useState<AppointmentSeriesSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reason, setReason] = useState('Tratamento interrompido ou replanejado');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setSeries(await listAppointmentSeries());
    } catch (error) {
      console.error('[MedicsPro] listar séries recorrentes:', error);
      toast('Não foi possível carregar as séries recorrentes.', 'warn');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const scopedSeries = useMemo(
    () => user?.role === 'fisio' ? series.filter((item) => item.fisioId === user.id) : series,
    [series, user?.id, user?.role],
  );

  const visible = useMemo(() => {
    const sorted = [...scopedSeries].sort((a, b) => b.dataInicio.localeCompare(a.dataInicio));
    return expanded ? sorted : sorted.slice(0, 6);
  }, [scopedSeries, expanded]);

  const countFuture = (seriesId: string) => appointments.filter((appointment) => (
    appointment.serieId === seriesId
    && appointment.data >= new Date().toISOString().slice(0, 10)
    && ['agendado', 'confirmado'].includes(appointment.status)
  )).length;

  const cancelSeries = async (seriesId: string) => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      const cancelled = await cancelAppointmentSeries(seriesId, reason.trim());
      toast(`Série cancelada. ${cancelled} sessão(ões) futura(s) cancelada(s).`);
      setCancellingId(null);
      setReason('Tratamento interrompido ou replanejado');
      await load();
      window.setTimeout(() => window.location.reload(), 350);
    } catch (error) {
      console.error('[MedicsPro] cancelar série recorrente:', error);
      toast('Não foi possível cancelar a série recorrente.', 'warn');
    } finally {
      setBusy(false);
    }
  };

  const activeCount = scopedSeries.filter((item) => item.status === 'ativa').length;

  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-display font-semibold">Séries recorrentes</p>
          <p className="font-mono text-[10px] text-fog mt-0.5">
            {activeCount} ativa(s) · {user?.role === 'fisio' ? 'suas séries clínicas recorrentes.' : 'gerencie sequências já persistidas no banco.'}
          </p>
        </div>
        <Btn variant="ghost" onClick={() => void load()} disabled={loading}>{loading ? 'Atualizando…' : 'Atualizar'}</Btn>
      </div>

      {loading ? (
        <p className="font-mono text-[10px] text-fog mt-4">Carregando séries…</p>
      ) : visible.length === 0 ? (
        <p className="font-mono text-[10px] text-fog mt-4">Nenhuma série recorrente criada ainda.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {visible.map((item) => {
            const patient = patientName(patients, item.pacienteId);
            const professional = userName(users, item.fisioId);
            const future = countFuture(item.id);
            const days = item.diasSemana.map((day) => DAY_LABEL[day] ?? String(day)).join(', ');
            const isCancelling = cancellingId === item.id;
            return (
              <div key={item.id} className="border border-line bg-deep/50 p-3">
                <div className="flex flex-wrap gap-3 items-start justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-display font-semibold truncate">{patient}</p>
                      <span className={`font-mono text-[9px] uppercase border px-1.5 py-0.5 ${item.status === 'ativa' ? 'border-mint/35 text-mint' : 'border-fog/30 text-fog'}`}>{item.status}</span>
                    </div>
                    <p className="font-mono text-[10px] text-fog mt-1">{professional} · {item.tipo} · {days} às {item.hora}</p>
                    <p className="font-mono text-[9.5px] text-fog mt-1">{formatDate(item.dataInicio)} → {formatDate(item.dataFim)} · {item.duracaoMin} min · {future} sessão(ões) futura(s)</p>
                  </div>
                  {item.status === 'ativa' && (
                    <Btn variant="danger" onClick={() => setCancellingId(isCancelling ? null : item.id)}>{isCancelling ? 'Fechar' : 'Cancelar série'}</Btn>
                  )}
                </div>

                {isCancelling && (
                  <div className="mt-3 border-t border-line pt-3 flex flex-col sm:flex-row gap-2">
                    <Input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivo do cancelamento da série" />
                    <Btn variant="danger" disabled={busy || !reason.trim()} onClick={() => void cancelSeries(item.id)}>{busy ? 'Cancelando…' : `Cancelar ${future} futura(s)`}</Btn>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {scopedSeries.length > 6 && (
        <div className="mt-3 flex justify-end">
          <Btn variant="ghost" onClick={() => setExpanded((value) => !value)}>{expanded ? 'Mostrar menos' : `Ver todas (${scopedSeries.length})`}</Btn>
        </div>
      )}
    </Card>
  );
}
