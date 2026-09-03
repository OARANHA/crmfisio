import { useNavigate } from 'react-router-dom';
import { AgendaCapacityInsights } from '../components/AgendaCapacityInsights';
import { AppointmentRecurrencePanel } from '../components/AppointmentRecurrencePanel';
import { AppointmentSeriesManager } from '../components/AppointmentSeriesManager';
import { Reveal } from '../components/Reveal';
import { Btn } from '../lib/ui';
import { AgendaReal } from './AgendaReal';

export function AgendaOperational() {
  const nav = useNavigate();
  return (
    <div className="space-y-6">
      <Reveal>
        <div className="flex justify-end"><Btn variant="ghost" onClick={() => nav('/hoje')}>Hoje · Recepção →</Btn></div>
      </Reveal>
      <AgendaReal />
      <Reveal delay={150}>
        <details className="group rounded-2xl border border-line bg-panel shadow-sm">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4">
            <div>
              <p className="font-display text-sm font-semibold">Planejamento avançado</p>
              <p className="mt-0.5 text-xs text-fog">Recorrências, séries e capacidade da agenda</p>
            </div>
            <span className="text-fog transition-transform group-open:rotate-180">⌄</span>
          </summary>
          <div className="space-y-5 border-t border-line px-4 py-5 sm:px-5">
            <AppointmentRecurrencePanel />
            <AppointmentSeriesManager />
            <AgendaCapacityInsights />
          </div>
        </details>
      </Reveal>
    </div>
  );
}
