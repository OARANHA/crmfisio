import { describe, expect, it } from 'vitest';
import { resolveHelpContext } from './helpContent';

describe('contextual help', () => {
  it('routes agenda screens to agenda help', () => {
    expect(resolveHelpContext('/agenda', 'recep')?.key).toBe('agenda');
    expect(resolveHelpContext('/hoje', 'fisio')?.key).toBe('agenda');
  });

  it('uses clinical help on a patient chart only for clinical/manager roles', () => {
    expect(resolveHelpContext('/pacientes/patient-1', 'fisio')?.key).toBe('atendimento');
    expect(resolveHelpContext('/pacientes/patient-1', 'admin')?.key).toBe('atendimento');
    expect(resolveHelpContext('/pacientes/patient-1', 'recep')?.key).toBe('pacientes');
  });

  it('does not teach a physiotherapist to settle receivables', () => {
    const help = resolveHelpContext('/financeiro', 'fisio');
    expect(help?.key).toBe('financeiro');
    expect(help?.steps.some((step) => step.title.includes('Baixe somente'))).toBe(false);
    expect(help?.steps.some((step) => step.title === 'Profissional clínico consulta sem operar caixa')).toBe(true);
  });

  it('does not expose clinical evolution instructions to reception', () => {
    const help = resolveHelpContext('/pacientes/patient-1', 'recep');
    const text = help?.steps.map((step) => `${step.title} ${step.body}`).join(' ') ?? '';
    expect(text).not.toContain('Registre a evolução da sessão');
    expect(text).not.toContain('session_id');
  });

  it('returns no help outside the implemented P0 contexts', () => {
    expect(resolveHelpContext('/crm', 'admin')).toBeNull();
    expect(resolveHelpContext('/mensagens', 'recep')).toBeNull();
  });
});
