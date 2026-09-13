import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const edge = read('../../supabase/functions/clinical-instrument-clinician-assisted/index.ts');
const processor = read('../../supabase/functions/nexus-self-assessment-processor/index.ts');
const engine = read('../../supabase/functions/_shared/clinical-instrument-engine.ts');
const migration = read('../../supabase-migrations/20260913_clinician_assisted_clinical_instruments_v1.sql');
const uiAdapter = read('./clinicalInstrumentClinicianAssisted.ts');
const ui = read('../components/ClinicianAssistedInstrumentApplyNow.tsx');
const workspace = read('../components/ClinicalEncounterWorkspaceV4.tsx');

describe('Clinician-Assisted Administration V1 boundary', () => {
  it('authenticates the clinician before using the service-only writer', () => {
    expect(edge).toContain('admin.auth.getUser');
    expect(edge).toContain('authData.user.id');
    expect(edge).toContain("admin.rpc('record_clinician_assisted_clinical_instrument'");
    expect(edge).not.toContain('p_actor_user_id: body');
    expect(edge).not.toContain('clinicId');
    expect(edge).not.toContain('patientId');
  });

  it('reuses one shared server-side PHQ-9/GAD-7 engine for both delivery modes', () => {
    expect(edge).toContain("../_shared/clinical-instrument-engine.ts");
    expect(processor).toContain("../_shared/clinical-instrument-engine.ts");
    expect(processor).not.toContain('const PHQ9:');
    expect(processor).not.toContain('const GAD7:');
    expect(processor).not.toContain('function requireIntegerRange(');
    expect(engine).toContain("ruleKey: 'nexus.phq9'");
    expect(engine).toContain("ruleKey: 'nexus.gad7'");
    expect(engine).toContain("ruleVersion: PHQ9_RULE_VERSION");
    expect(engine).toContain("flagCode: 'phq9.item9.positive'");
  });

  it('persists only canonical validated answers instead of arbitrary browser keys', () => {
    expect(edge).toContain('const canonicalAnswers = Object.fromEntries(');
    expect(edge).toContain("calculated.answersArray.map((value, index) => [`q${index + 1}`, value])");
    expect(edge).toContain('p_answers: canonicalAnswers');
    expect(edge).not.toContain('p_answers: answers,');
  });

  it('keeps Nexus capability metadata out of neutral clinician-assisted authorization', () => {
    expect(edge).not.toContain('nexus.scales');
    expect(edge).not.toContain('requiredCapability');
    const writer = migration.match(/CREATE OR REPLACE FUNCTION public\.record_clinician_assisted_clinical_instrument\([\s\S]*?\$\$;/i)?.[0] ?? '';
    expect(writer).toContain('can_apply_clinical_instrument_in_encounter');
    expect(writer).toContain('clinical_instrument_catalog');
    expect(writer).not.toContain('nexus.scales');
    expect(writer).not.toContain('nexus_clinical_results');
    expect(writer).not.toContain('current_app_role');
    expect(writer).not.toContain('professional_type');
    expect(writer).not.toContain('fisio_id');
  });

  it('persists an immutable encounter-scoped clinician_assisted snapshot', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.clinical_instrument_administrations');
    expect(migration).toContain("CHECK (provenance = 'clinician_assisted')");
    expect(migration).toContain('UNIQUE (professional_id, appointment_id, request_id)');
    expect(migration).toContain('BEFORE UPDATE OR DELETE ON public.clinical_instrument_administrations');
    expect(migration).toContain("a.status = 'em_atendimento'");
    expect(migration).toContain('a.professional_id = p_actor_user_id');
  });

  it('resolves Apply Now availability through the neutral Encounter act boundary', () => {
    expect(uiAdapter).toContain("db.rpc('can_apply_clinical_instrument_in_encounter'");
    expect(uiAdapter).toContain("supabase.functions.invoke('clinical-instrument-clinician-assisted'");
    expect(uiAdapter).not.toContain('nexus.access');
    expect(uiAdapter).not.toContain('nexus.scales');
    expect(uiAdapter).not.toContain('clinical.assessment.apply');
  });

  it('keeps Apply Now independent from the Assessment Engine capability gate', () => {
    const sectionStart = workspace.indexOf("workspace === 'assessment'");
    const applyNow = workspace.indexOf('<ClinicianAssistedInstrumentApplyNow', sectionStart);
    const assessmentGate = workspace.indexOf('assessmentCapability.loading', sectionStart);
    const sectionEnd = workspace.indexOf("workspace === 'prescription'", sectionStart);

    expect(sectionStart).toBeGreaterThan(-1);
    expect(applyNow).toBeGreaterThan(sectionStart);
    expect(assessmentGate).toBeGreaterThan(applyNow);
    expect(sectionEnd).toBeGreaterThan(assessmentGate);
    expect(workspace.slice(sectionStart, sectionEnd)).not.toContain('nexus.scales');
  });

  it('renders only server-returned score and safety signals without browser clinical inference', () => {
    expect(ui).toContain('result.totalScore');
    expect(ui).toContain('result.maxScore');
    expect(ui).toContain('result.classification');
    expect(ui).toContain('result.interpretation');
    expect(ui).toContain('result.safetySignals');
    expect(ui).not.toContain('answers.q9');
    expect(ui).not.toContain('q9 >');
    expect(ui).not.toContain('.reduce(');
    expect(ui).not.toContain('totalScore =');
    expect(ui).not.toContain('classification =');
  });

  it('creates one request id per application and preserves it for retry', () => {
    expect(ui.match(/crypto\.randomUUID\(\)/g)).toHaveLength(1);
    expect(ui).toContain('requestId: session.requestId');
    expect(ui).toContain('Você pode tentar novamente sem duplicar a aplicação.');
  });
});
