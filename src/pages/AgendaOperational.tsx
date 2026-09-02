import { AgendaCapacityInsights } from '../components/AgendaCapacityInsights';
import { AppointmentRecurrencePanel } from '../components/AppointmentRecurrencePanel';
import { Reveal } from '../components/Reveal';
import { AgendaReal } from './AgendaReal';

export function AgendaOperational() {
  return (
    <div className="space-y-6">
      <AgendaReal />
      <Reveal delay={150}>
        <AppointmentRecurrencePanel />
      </Reveal>
      <Reveal delay={180}>
        <AgendaCapacityInsights />
      </Reveal>
    </div>
  );
}
