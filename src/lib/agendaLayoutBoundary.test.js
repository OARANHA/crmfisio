import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const css = source('../styles/agenda-priority-v4.css');
const agenda = source('../pages/AgendaReal.tsx');

describe('Agenda V4 explicit layout boundary', () => {
  it('does not use CSS to infer structural card order from descendant content or Tailwind strings', () => {
    expect(css).not.toContain(':has(');
    expect(css).not.toContain('display: contents');
    expect(css).not.toMatch(/\border\s*:/);
    expect(css).not.toContain('[class*=');
  });

  it('uses explicit semantic hooks for calendar styling and dynamic time geometry in JSX', () => {
    expect(agenda).toContain('agenda-day-column');
    expect(agenda).toContain('agenda-time-slot');
    expect(agenda).toContain('agenda-appointment-card');
    expect(agenda).toContain('resolveAgendaTimeRange(periodAppointments)');
    expect(agenda).toContain('appointmentAgendaGeometry(appointment, timeRange)');
  });
});
