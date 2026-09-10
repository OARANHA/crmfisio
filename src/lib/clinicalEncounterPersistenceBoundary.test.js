import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../components/ClinicalEncounterWorkspaceV4.tsx'), 'utf8');
const assessmentSource = readFileSync(resolve(here, '../components/ClinicalAssessmentRunner.tsx'), 'utf8');
const toolsSource = readFileSync(resolve(here, '../components/ActiveEncounterClinicalTools.tsx'), 'utf8');
const uxSource = readFileSync(resolve(here, './clinicalEncounterUx.ts'), 'utf8');

function collectPresentationText(segment) {
  const quoted = [...segment.matchAll(/(['"`])((?:\\.|(?!\1)[\s\S])*?)\1/g)].map((match) => match[2]);
  const jsxText = [...segment.matchAll(/>([^<>{}]+)</g)].map((match) => match[1]);
  return [...quoted, ...jsxText].join('\n').toLowerCase();
}

describe('Clinical Encounter V4.1 persistence feedback boundary', () => {
  it('never presents an unconfirmed evolution as persisted', () => {
    expect(source).toContain("hasLinkedEvolution ? 'Evolução registrada ✓' : 'Evolução pendente'");
    expect(source).toContain("hasLinkedEvolution\n      ? { label: 'Evolução confirmada ✓'");
    expect(source).toContain("savingEvolution\n    ? { label: 'Registrando evolução…'");
    expect(source).toContain("{ label: 'Evolução pendente'");
    expect(source).toContain('Registre a evolução desta consulta antes de encerrar o atendimento.');
  });

  it('keeps the explicit persisted message inside the linked-evolution branch', () => {
    const confirmedBranch = source.indexOf('Registrada no prontuário ✓');
    const linkedEvolutionBranch = source.indexOf('hasLinkedEvolution ? (');
    const pendingBranch = source.indexOf(': evolutionCapability.loading ?', linkedEvolutionBranch);

    expect(linkedEvolutionBranch).toBeGreaterThan(-1);
    expect(confirmedBranch).toBeGreaterThan(linkedEvolutionBranch);
    expect(confirmedBranch).toBeLessThan(pendingBranch);
  });

  it('keeps engineering terminology out of professional Encounter Mode copy', () => {
    const workspaceStart = source.indexOf('<section data-clinical-encounter-mode="active"');
    const toolsStart = toolsSource.indexOf('<div className="space-y-3">');
    const closingStart = uxSource.indexOf('export function resolveEncounterClosingState');
    const closingEnd = uxSource.indexOf('export function resolveEncounterProgress');

    expect(workspaceStart).toBeGreaterThan(-1);
    expect(toolsStart).toBeGreaterThan(-1);
    expect(closingStart).toBeGreaterThan(-1);
    expect(closingEnd).toBeGreaterThan(closingStart);

    const presentationText = [
      collectPresentationText(source.slice(workspaceStart)),
      collectPresentationText(toolsSource.slice(toolsStart)),
      collectPresentationText(uxSource.slice(closingStart, closingEnd)),
    ].join('\n');

    for (const forbidden of [
      'encounter-scoped',
      'capability',
      'entitlement',
      'boundary',
      'workflow canônico',
      'assessment engine canônico',
      'draft',
      'session_id',
      'v4.1',
      'simular maturidade',
      'postgresql',
      'guard canônico',
      'banco também',
    ]) {
      expect(presentationText).not.toContain(forbidden);
    }

    expect(source).toContain('Registro obrigatório para encerrar o atendimento.');
    expect(source).toContain('Avaliação estruturada opcional para esta consulta.');
    expect(source).toContain('Recursos disponíveis para este atendimento');
    expect(source).toContain('Registre ou consulte informações relevantes para a continuidade do cuidado.');
  });

  it('uses a consultation-specific assessment empty state without removing administrative guidance elsewhere', () => {
    const encounterRunner = '<ClinicalAssessmentRunner patient={patient} presentation="encounter" />';
    const encounterEmptyState = 'Nenhuma avaliação estruturada disponível para este atendimento.';
    const administrativeGuidance = 'Publique um modelo em Configurações para iniciar avaliações estruturadas.';

    expect(source).toContain(encounterRunner);
    expect(assessmentSource).toContain("presentation = 'default'");
    expect(assessmentSource).toContain("presentation === 'encounter'");
    expect(assessmentSource).toContain(`<Empty title="${encounterEmptyState}" />`);
    expect(assessmentSource).toContain(administrativeGuidance);

    const encounterCondition = assessmentSource.indexOf("presentation === 'encounter'");
    const encounterEmpty = assessmentSource.indexOf(encounterEmptyState, encounterCondition);
    const adminEmpty = assessmentSource.indexOf(administrativeGuidance, encounterEmpty);
    expect(encounterEmpty).toBeGreaterThan(encounterCondition);
    expect(adminEmpty).toBeGreaterThan(encounterEmpty);
  });
});
