import type { Role } from './types';

export type AgendaExperienceMode = 'professional' | 'operational';
export type AgendaView = 'dia' | 'semana' | 'mes';

export type AgendaExperience = {
  mode: AgendaExperienceMode;
  defaultView: AgendaView;
  compactHeader: boolean;
  showOperationalFilters: boolean;
  showWaitlist: boolean;
  showAdvancedPlanning: boolean;
};

export function resolveAgendaExperience(role: Role | null | undefined): AgendaExperience {
  if (role === 'professional') {
    return {
      mode: 'professional',
      defaultView: 'dia',
      compactHeader: true,
      showOperationalFilters: false,
      showWaitlist: false,
      showAdvancedPlanning: false,
    };
  }

  return {
    mode: 'operational',
    defaultView: 'semana',
    compactHeader: false,
    showOperationalFilters: true,
    showWaitlist: true,
    showAdvancedPlanning: true,
  };
}

export function parseAgendaView(value: string | null | undefined): AgendaView | null {
  return value === 'dia' || value === 'semana' || value === 'mes' ? value : null;
}
