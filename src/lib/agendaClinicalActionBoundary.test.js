import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const modal = readFileSync(fileURLToPath(new URL('../components/AppointmentActionModal.tsx', import.meta.url)), 'utf8');

describe('agenda clinical action boundary', () => {
  it('binds clinical actions to the assigned physiotherapist', () => {
    expect(modal).toContain("role === 'fisio' && user?.id === appointment.fisioId");
    expect(modal).toContain("if (action.status === 'em_atendimento') return canClinicalTransition");
  });

  it('removes direct clinical finalization from the agenda drawer', () => {
    expect(modal).toContain("if (action.status === 'finalizado') return false");
    expect(modal).toContain('Continuar atendimento no prontuário');
  });
});
