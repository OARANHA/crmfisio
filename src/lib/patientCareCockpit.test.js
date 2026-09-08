import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('../components/PatientCareCockpit.tsx', import.meta.url)), 'utf8');

describe('patient care cockpit', () => {
  it('keeps clinical continuation bound to clinical.attend and the assigned professional', () => {
    expect(source).toContain("useClinicalCapability('clinical.attend'");
    expect(source).toContain('professionalIdOf(activeSession) === user?.id');
    expect(source).toContain('Continuar atendimento');
  });

  it('does not expose financial context when the role has no financial access', () => {
    expect(source).toContain("access('financeiro') !== 'none'");
    expect(source).toContain("value={canSeeFinance ?");
    expect(source).toContain("'Protegido'");
  });

  it('keeps the patient page as the operational hub instead of creating a separate solo login', () => {
    expect(source).toContain('Cockpit do paciente');
    expect(source).toContain('Atendimento, prontuário, continuidade e próximos passos reunidos no mesmo contexto.');
    expect(source).toContain('Agendar atendimento');
    expect(source).toContain('Ver Financeiro');
  });
});
