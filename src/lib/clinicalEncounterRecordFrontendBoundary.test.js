import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const editor = readFileSync(resolve(here, '../components/ClinicalEncounterRecordEditor.tsx'), 'utf8');
const workspace = readFileSync(resolve(here, '../components/ClinicalEncounterWorkspaceV4.tsx'), 'utf8');

describe('Encounter Clinical Record frontend boundary', () => {
  it('keys async draft state by patient, professional and appointment and ignores stale responses', () => {
    expect(editor).toContain('`${patient.id}:${userId}:${encounter.id}`');
    expect(editor).toContain('if (contextRef.current !== requestKey) return;');
    expect(editor).toContain('setRecord(null);');
    expect(editor).toContain('setContent(emptyContent());');
    expect(editor).toContain('setBaseline(emptyContent());');
  });

  it('uses server-confirmed revision for subsequent saves and never last-write-wins silently', () => {
    expect(editor).toContain("saveClinicalEncounterRecord(encounter.id, record?.revision ?? 0, content)");
    expect(editor).toContain("setMessage('Este registro foi atualizado em outra aba. Recarregue antes de salvar novamente.');");
    expect(editor).toContain("setSaveState('conflict')");
    expect(editor).toContain("'Rascunho salvo'");
    expect(editor).toContain("'Salvando...'");
    expect(editor).toContain("'Não salvo'");
  });

  it('replaces the universal evolution textarea with one structured record and no autosave', () => {
    expect(workspace).toContain('<ClinicalEncounterRecordEditor');
    expect(workspace).not.toContain('evolutionText');
    expect(workspace).not.toContain('addEvolution');
    expect(editor).not.toContain('setTimeout(');
    expect(editor).not.toContain('onBlur=');
    expect(editor).toContain('Motivo / demandas');
    expect(editor).toContain('História atual');
    expect(editor).toContain('Achados / exame');
    expect(editor).toContain('Avaliação clínica / problemas');
    expect(editor).toContain('Plano / conduta');
    expect(editor).toContain('Observações adicionais');
  });

  it('reviews deterministic text without a second editable evolution field', () => {
    expect(editor).toContain('materializeClinicalEncounterEvolution(content)');
    expect(editor).toContain('Ao confirmar, este registro ficará definitivo');
    expect(editor).toContain('Confirmar e encerrar atendimento');
    const modalStart = editor.indexOf('<Modal open={reviewOpen}');
    const modalEnd = editor.indexOf('</Modal>', modalStart);
    expect(modalStart).toBeGreaterThan(-1);
    expect(editor.slice(modalStart, modalEnd)).not.toContain('<Textarea');
  });

  it('does not mutate longitudinal patient fields and keeps Assessment and Nexus separate', () => {
    expect(editor).not.toContain('queixaPrincipal');
    expect(editor).not.toContain('updatePatient');
    expect(workspace).toContain('<ClinicalAssessmentRunner patient={patient} presentation="encounter" />');
    expect(workspace).toContain('<ActiveEncounterClinicalTools');
    expect(workspace).toContain('<NexusRecordIncorporationPanel patient={patient} />');
  });

  it('preserves legacy Evolution finalization without creating a duplicate', () => {
    expect(editor).toContain('if (!record && hasLinkedEvolution) return <>{legacyFallback}</>;');
    expect(editor).toContain("record?.status === 'draft' && hasLinkedEvolution");
    expect(workspace).toContain('updateAppointmentStatusVerified(canonicalEncounter.id, \'finalizado\')');
    expect(workspace).toContain('finishLegacyEncounter');
  });

  it('never reports final success before the transactional RPC resolves', () => {
    const rpc = editor.indexOf('await finalizeClinicalEncounterRecord(encounter.id, record.revision)');
    const finalized = editor.indexOf('setRecord(finalized)', rpc);
    const callback = editor.indexOf('await onFinalized()', finalized);
    expect(rpc).toBeGreaterThan(-1);
    expect(finalized).toBeGreaterThan(rpc);
    expect(callback).toBeGreaterThan(finalized);
    expect(editor).toContain('Nenhuma conclusão foi informada como realizada.');
  });
});
