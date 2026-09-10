import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../components/ClinicalEncounterWorkspaceV4.tsx'), 'utf8');

describe('Clinical Encounter V4.1 persistence feedback boundary', () => {
  it('never presents an unconfirmed evolution as persisted', () => {
    expect(source).toContain("hasLinkedEvolution ? 'Evolução registrada ✓' : 'Evolução pendente'");
    expect(source).toContain("hasLinkedEvolution\n      ? { label: 'Evolução confirmada ✓'");
    expect(source).toContain("savingEvolution\n    ? { label: 'Registrando evolução…'");
    expect(source).toContain("{ label: 'Evolução pendente'");
    expect(source).toContain('Nada é informado como salvo antes da confirmação.');
  });

  it('keeps the explicit persisted message inside the linked-evolution branch', () => {
    const confirmedBranch = source.indexOf('Persistência confirmada ✓');
    const linkedEvolutionBranch = source.indexOf('hasLinkedEvolution ? (');
    const pendingBranch = source.indexOf(': evolutionCapability.loading ?', linkedEvolutionBranch);

    expect(linkedEvolutionBranch).toBeGreaterThan(-1);
    expect(confirmedBranch).toBeGreaterThan(linkedEvolutionBranch);
    expect(confirmedBranch).toBeLessThan(pendingBranch);
  });
});
