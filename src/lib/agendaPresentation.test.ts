import { describe, expect, it } from 'vitest';
import { parseAgendaView, resolveAgendaExperience } from './agendaPresentation';

describe('role-aware agenda presentation', () => {
  it('gives a professional the simplified personal agenda with day as the default view', () => {
    expect(resolveAgendaExperience('professional')).toEqual({
      mode: 'professional',
      defaultView: 'dia',
      compactHeader: true,
      showOperationalFilters: false,
      showWaitlist: false,
      showAdvancedPlanning: false,
    });
  });

  it.each(['recep', 'admin', 'owner'] as const)('preserves the operational agenda for %s', (role) => {
    const experience = resolveAgendaExperience(role);
    expect(experience.mode).toBe('operational');
    expect(experience.defaultView).toBe('semana');
    expect(experience.showOperationalFilters).toBe(true);
    expect(experience.showWaitlist).toBe(true);
    expect(experience.showAdvancedPlanning).toBe(true);
  });

  it('accepts only canonical agenda views from query state', () => {
    expect(parseAgendaView('dia')).toBe('dia');
    expect(parseAgendaView('semana')).toBe('semana');
    expect(parseAgendaView('mes')).toBe('mes');
    expect(parseAgendaView('legacy')).toBeNull();
  });
});
