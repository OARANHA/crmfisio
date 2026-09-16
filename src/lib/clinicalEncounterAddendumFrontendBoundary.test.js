import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { classifyClinicalEncounterAddendumError } from './clinicalEncounterAddendum';

const here = dirname(fileURLToPath(import.meta.url));
const client = readFileSync(resolve(here, './clinicalEncounterAddendum.ts'), 'utf8');
const panel = readFileSync(resolve(here, '../components/ClinicalEncounterAddendumPanel.tsx'), 'utf8');
const timeline = readFileSync(resolve(here, '../components/ClinicalEncounterAddendumTimeline.tsx'), 'utf8');
const workspaceV3 = readFileSync(resolve(here, '../components/ClinicalWorkspaceV3.tsx'), 'utf8');

describe('Encounter Record Correction/Addendum V1 frontend boundary', () => {
  it('reads finalized record provenance and creates acts only through the canonical RPC', () => {
    expect(client).toContain(".eq('status', 'finalized')");
    expect(client).toContain("client.rpc('create_clinical_encounter_record_addendum'");
    expect(client).not.toContain('.insert(');
    expect(client).not.toContain('.update(');
    expect(client).not.toContain('.delete(');
  });

  it('presents addenda beneath the original Evolution instead of replacing it', () => {
    expect(workspaceV3).toContain('<ClinicalEncounterAddendumTimeline patientId={patient.id} />');
    expect(timeline).toContain('<ClinicalEncounterAddendumPanel');
    expect(timeline).toContain('original preservado');
    expect(panel).toContain('Ato posterior auditável · registro original preservado.');
  });
  it('shows the write affordance only when the caller has explicit author eligibility', () => {
    expect(timeline).toContain('user?.id === record.professionalId');
    expect(timeline).toContain('&& attend.allowed');
    expect(timeline).toContain('&& evolution.allowed');
    expect(panel).toContain('{canCreate && (');
    expect(panel).toContain('Registrar retificação/adendo');
  });

  it('requires type, reason and clinical content while warning that the original stays unchanged', () => {
    expect(panel).toContain('O registro original não será alterado.');
    expect(panel).toContain('Tipo do ato');
    expect(panel).toContain('Motivo');
    expect(panel).toContain('Conteúdo clínico');
    expect(panel).toContain("!reason.trim() || !content.trim()");
    expect(panel).toContain("globalThis.crypto.randomUUID()");
  });

  it('does not introduce appointment or financial mutations', () => {
    expect(client).not.toContain('appointments');
    expect(client).not.toContain('payments');
    expect(client).not.toContain('finance');
    expect(panel).not.toContain('Finance');
    expect(panel).not.toContain('CHARGE');
    expect(panel).not.toContain('WAIVE');
  });
  it('classifies server failures into recoverable UI states without claiming success', () => {
    expect(classifyClinicalEncounterAddendumError({ message: 'clinical_encounter_addendum_idempotency_conflict' })).toBe('idempotency_conflict');
    expect(classifyClinicalEncounterAddendumError({ message: 'clinical_encounter_addendum_finalized_record_required' })).toBe('record_not_finalized');
    expect(classifyClinicalEncounterAddendumError({ message: 'clinical_encounter_addendum_content_required' })).toBe('invalid_content');
    expect(classifyClinicalEncounterAddendumError({ message: 'clinical_encounter_addendum_original_author_required' })).toBe('access_denied');
    expect(panel).toContain('O registro original não foi alterado.');
  });
});
