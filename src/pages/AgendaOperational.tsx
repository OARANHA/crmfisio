import { AgendaCapacityInsights } from '../components/AgendaCapacityInsights';
import { Reveal } from '../components/Reveal';
import { AgendaReal } from './AgendaReal';

export function AgendaOperational() {
  return (
    <div className="space-y-6">
      <AgendaReal />
      <Reveal delay={160}>
        <AgendaCapacityInsights />
      </Reveal>
    </div>
  );
}
