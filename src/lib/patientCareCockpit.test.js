import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('../components/PatientCareCockpit.tsx', import.meta.url)), 'utf8');

describe('patient care cockpit', () => {
  it('keeps clinical continuation bound to the assigned physiotherapist', () => {
    expect(source).toContain("user?.role === 'fisio'");
    expect(source).toContain('activeSession.fisioId === user.id');
    expect(source).toContain('Continuar atendimento');
  });

  it('does not expose financial context when the role has no financial access', () => {
    expect(source).toContain("access('financeiro') !== 'none'");
    expect(source).toContain("value={canSeeFinance ?");
    expect(source).toContain("'Protegido'");
  });

  it('keeps the patient page as the operational hub instead of creating a separate solo login', () => {
    expect(source).toContain('Central do paciente');
    expect(source).toContain('Seu consultório em um único contexto');
    expect(source).toContain('Agendar próxima sessão');
    expect(source).toContain('Ver Financeiro');
  });
});
