import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('../pages/Pacientes.tsx', import.meta.url)), 'utf8');

describe('patient directory operational surface', () => {
  it('does not expose complaint or CID as clinic-wide directory columns', () => {
    expect(source).not.toContain('<th className="px-5 py-3.5 text-left">Queixa principal</th>');
    expect(source).not.toContain('patient.cid10.join');
    expect(source).not.toContain('patient.queixaPrincipal.toLowerCase()');
  });

  it('searches operational identifiers instead of clinical content', () => {
    expect(source).toContain('Nome, telefone, e-mail ou CPF');
    expect(source).toContain('patient.telefone');
    expect(source).toContain('patient.email');
    expect(source).toContain('cpfDigits');
  });

  it('makes the care relationship boundary explicit in the directory copy', () => {
    expect(source).toContain('dados clínicos ficam no prontuário conforme relação assistencial');
  });
});
