import { useEffect, useState } from 'react';
import { loadAppointmentHistory, type AppointmentHistoryItem } from '../lib/appointmentHistory';

export function AppointmentHistoryTimeline({ appointmentId }: { appointmentId: string }) {
  const [items, setItems] = useState<AppointmentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    loadAppointmentHistory(appointmentId)
      .then((data) => active && setItems(data))
      .catch((error) => console.error('[MedicsPro] histórico do atendimento:', error))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [appointmentId]);

  return (
    <div className="border border-line bg-deep/50 p-3">
      <p className="font-mono text-[9px] uppercase text-fog mb-2">Histórico operacional</p>
      {loading ? (
        <p className="font-mono text-[10px] text-fog">Carregando histórico…</p>
      ) : items.length === 0 ? (
        <p className="font-mono text-[10px] text-fog">Nenhuma alteração registrada para esta sessão.</p>
      ) : (
        <div className="space-y-2 max-h-44 overflow-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className="border-l-2 border-mint/35 pl-3 py-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold">{item.label}</span>
                <span className="font-mono text-[9px] text-fog whitespace-nowrap">{new Date(item.at).toLocaleString('pt-BR')}</span>
              </div>
              <p className="font-mono text-[9.5px] text-fog mt-0.5">{item.detail}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
