import { describe, expect, it } from 'vitest';
import {
  classifyClinicalEncounterRecordError,
  clinicalEncounterRecordHasContent,
  materializeClinicalEncounterEvolution,
  type ClinicalEncounterRecordContent,
} from './clinicalEncounterRecord';

const content = (overrides: Partial<ClinicalEncounterRecordContent> = {}): ClinicalEncounterRecordContent => ({
  reason: '',
  history: '',
  findings: '',
  assessment: '',
  plan: '',
  additionalNotes: '',
  ...overrides,
});

describe('clinical encounter record contract', () => {
  it('materializes only non-empty sections in deterministic order', () => {
    expect(materializeClinicalEncounterEvolution(content({
      reason: '  Renovação de receita  ',
      findings: 'PA 130/80 mmHg',
      plan: 'Manter tratamento.',
    }))).toBe([
      'Motivo / demandas\nRenovação de receita',
      'Achados / exame\nPA 130/80 mmHg',
      'Plano / conduta\nManter tratamento.',
    ].join('\n\n'));
  });

  it('does not invent placeholders or clinical conclusions', () => {
    const text = materializeClinicalEncounterEvolution(content({ history: 'Paciente sem novas queixas.' }));
    expect(text).toBe('História atual\nPaciente sem novas queixas.');
    expect(text).not.toContain('Não informado');
    expect(text).not.toContain('N/A');
    expect(text).not.toContain('diagnóstico');
  });

  it('uses the conservative non-empty rule without requiring every field', () => {
    expect(clinicalEncounterRecordHasContent(content())).toBe(false);
    expect(clinicalEncounterRecordHasContent(content({ additionalNotes: 'Orientado retorno se necessário.' }))).toBe(true);
  });

  it('classifies revision and competing evolution conflicts explicitly', () => {
    expect(classifyClinicalEncounterRecordError(new Error('clinical_encounter_revision_conflict'))).toBe('revision_conflict');
    expect(classifyClinicalEncounterRecordError(new Error('clinical_encounter_evolution_conflict'))).toBe('evolution_conflict');
    expect(classifyClinicalEncounterRecordError(new Error('clinical_encounter_legacy_evolution_exists'))).toBe('legacy_evolution');
  });
});
