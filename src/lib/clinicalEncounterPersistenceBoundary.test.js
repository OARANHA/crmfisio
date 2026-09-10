import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../components/ClinicalEncounterWorkspaceV4.tsx'), 'utf8');
const editorSource = readFileSync(resolve(here, '../components/ClinicalEncounterRecordEditor.tsx'), 'utf8');
const recordSource = readFileSync(resolve(here, './clinicalEncounterRecord.ts'), 'utf8');
const assessmentSource = readFileSync(resolve(here, '../components/ClinicalAssessmentRunner.tsx'), 'utf8');
const toolsSource = readFileSync(resolve(here, '../components/ActiveEncounterClinicalTools.tsx'), 'utf8');
const uxSource = readFileSync(resolve(here, './clinicalEncounterUx.ts'), 'utf8');

describe('Clinical Encounter V4.1 persistence feedback boundary', () => {
  it('distinguishes local, saving, persisted, conflict and error states without generic autosave', () => {
    expect(editorSource).toContain("'idle' | 'saving' | 'saved' | 'conflict' | 'error'");
    expect(editorSource).toContain("saveState === 'saving' ? 'Salvando...'");
    expect(editorSource).toContain("saveState === 'saved' && !dirty ? 'Rascunho salvo'");
    expect(editorSource).toContain("saveState === 'conflict' ? 'Conflito de versão'");
    expect(editorSource).toContain("saveState === 'error' ? 'Erro ao salvar'");
    expect(editorSource).toContain(": 'Não salvo'");
    expect(editorSource).not.toContain('setTimeout(');
    expect(editorSource).not.toContain('debounce');
  });

  it('does not claim a draft is persisted until the save RPC returns server data', () => {
    const awaitSave = editorSource.indexOf('const saved = await saveClinicalEncounterRecord(');
    const persistBaseline = editorSource.indexOf('setBaseline(persisted);', awaitSave);
    const savedState = editorSource.indexOf("setSaveState('saved');", persistBaseline);
    expect(awaitSave).toBeGreaterThan(-1);
    expect(persistBaseline).toBeGreaterThan(awaitSave);
    expect(savedState).toBeGreaterThan(persistBaseline);
    expect(recordSource).toContain("if (error || !data) throw error ?? new Error('Registro da consulta sem confirmação do servidor.')");
  });

  it('only presents Evolution as registered when a persisted Evolution actually exists', () => {
    expect(source).toContain("hasLinkedEvolution ? 'Evolução registrada ✓' : 'Registro em elaboração'");
    expect(source).toContain('currentEvolution');
    expect(source).toContain('evolution.sessionId === encounter.id');
    expect(source).toContain('professionalIdOf(evolution) === user?.id');
    expect(source).not.toContain("'Evolução pendente'");
  });

  it('only renders the finalized Encounter Record after the finalize RPC returns confirmation', () => {
    const awaitFinalize = editorSource.indexOf('const finalized = await finalizeClinicalEncounterRecord(');
    const setRecordFinalized = editorSource.indexOf('setRecord(finalized);', awaitFinalize);
    const finalizedPresentation = editorSource.indexOf("if (record?.status === 'finalized')");
    expect(awaitFinalize).toBeGreaterThan(-1);
    expect(setRecordFinalized).toBeGreaterThan(awaitFinalize);
    expect(finalizedPresentation).toBeGreaterThan(-1);
    expect(recordSource).toContain("if (error || !data) throw error ?? new Error('Conclusão da consulta sem confirmação do servidor.')");
  });

  it('does not show false success after a failed finalize RPC', () => {
    const finalizeStart = editorSource.indexOf('const finalize = async () =>');
    const finalizeCatch = editorSource.indexOf('} catch (error) {', finalizeStart);
    const failureCopy = editorSource.indexOf('Nenhuma conclusão foi informada como realizada.', finalizeCatch);
    expect(finalizeCatch).toBeGreaterThan(finalizeStart);
    expect(failureCopy).toBeGreaterThan(finalizeCatch);
    const catchBody = editorSource.slice(finalizeCatch, editorSource.indexOf('} finally {', finalizeCatch));
    expect(catchBody).not.toContain('setRecord(finalized)');
    expect(catchBody).not.toContain('Atendimento finalizado ✓');
  });

  it('uses review-and-confirm closing with one structured clinical record and no second evolution textarea', () => {
    expect(editorSource).toContain('Revisar e concluir');
    expect(editorSource).toContain('Revisar registro da consulta');
    expect(editorSource).toContain('Confirmar e encerrar atendimento');
    expect(editorSource).toContain('a evolução oficial será gerada a partir do conteúdo abaixo');
    expect(source).toContain('sem digitar uma segunda evolução');
    expect(source).not.toContain('evolutionText');
    expect(source).not.toContain('Registrar evolução');
  });

  it('keeps engineering terminology out of professional Encounter Mode copy', () => {
    const professionalSources = [source, editorSource, toolsSource, uxSource].join('\n');
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

    expect(source).toContain('Avaliação estruturada opcional para esta consulta.');
    expect(source).toContain('Recursos disponíveis para este atendimento');
    expect(source).toContain('Registre ou consulte informações relevantes para a continuidade do cuidado.');
    expect(editorSource).toContain('Preencha somente o que for relevante para este atendimento.');
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
