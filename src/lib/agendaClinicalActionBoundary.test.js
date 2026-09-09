import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const modal = readFileSync(fileURLToPath(new URL('../components/AppointmentActionModal.tsx', import.meta.url)), 'utf8');

describe('agenda clinical action boundary', () => {
  it('binds clinical actions to confirmed clinical.attend and the assigned professional', () => {
    expect(modal).toContain("useClinicalCapability('clinical.attend'");
    expect(modal).toContain('attendCapability.allowed');
    expect(modal).toContain('user?.id === professionalIdOf(appointment)');
    expect(modal).toContain("if (action.status === 'em_atendimento') return canClinicalTransition");
    expect(modal).not.toContain('if (!canAttend) return true');
  });

  it('keeps loading, denied and error states fail-closed for clinical agenda actions', () => {
    expect(modal).toContain('attendCapability.error');
    expect(modal).toContain('attendCapability.loading');
    expect(modal).toContain('Não foi possível verificar suas permissões clínicas.');
    expect(modal).toContain("if (action.status === 'finalizado') return false");
  });

  it('removes direct clinical finalization from the agenda drawer', () => {
    expect(modal).toContain("if (action.status === 'finalizado') return false");
    expect(modal).toContain('Continuar atendimento no prontuário');
  });
});
