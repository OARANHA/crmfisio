import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../components/ClinicalEncounterWorkspaceV4.tsx'), 'utf8');
const assessmentSource = readFileSync(resolve(here, '../components/ClinicalAssessmentRunner.tsx'), 'utf8');
const toolsSource = readFileSync(resolve(here, '../components/ActiveEncounterClinicalTools.tsx'), 'utf8');
const uxSource = readFileSync(resolve(here, './clinicalEncounterUx.ts'), 'utf8');

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
    // These are the actual user-visible phrases that leaked implementation
    // vocabulary into the consultation UI. Internal identifiers/comments may
    // still use the corresponding engineering terms.
    const professionalSources = [source, toolsSource, uxSource].join('\n');
    const forbiddenVisiblePhrases = [
      'Assessment Engine canônico',
      'capability clínica',
      'entitlement, capabilities',
      'demais boundaries',
      'workflow canônico',
      'encounter-scoped obrigatório',
      'session_id =',
      'simular maturidade',
      'O V4.1',
      'capabilities atuais',
      'sessão canônica',
      'O banco também exige',
      'validada pelo PostgreSQL',
      'O PostgreSQL exige',
      'guard canônico',
    ];

    for (const phrase of forbiddenVisiblePhrases) {
      expect(professionalSources).not.toContain(phrase);
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
