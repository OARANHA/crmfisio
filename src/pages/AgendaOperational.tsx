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
      <Reveal delay={150}><AppointmentRecurrencePanel /></Reveal>
      <Reveal delay={165}><AppointmentSeriesManager /></Reveal>
      <Reveal delay={180}><AgendaCapacityInsights /></Reveal>
    </div>
  );
}
