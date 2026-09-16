import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const edge = read(
  "../../supabase/functions/clinical-instrument-clinician-assisted/index.ts",
);
const processor = read(
  "../../supabase/functions/nexus-self-assessment-processor/index.ts",
);
const engine = read(
  "../../supabase/functions/_shared/clinical-instrument-engine.ts",
);
const migration = read(
  "../../supabase-migrations/20260913_clinician_assisted_clinical_instruments_v1.sql",
);
const phq15Migration = read(
  "../../supabase-migrations/20260913_phq15_clinician_assisted_v1.sql",
);
const cageMigration = read(
  "../../supabase-migrations/20260916_cage_clinician_assisted_v1.sql",
);
const pcl5Migration = read(
  "../../supabase-migrations/20260916_pcl5_clinician_assisted_v1.sql",
);
const pcptsd5Migration = read(
  "../../supabase-migrations/20260916_pcptsd5_clinician_assisted_v1.sql",
);
const uiAdapter = read("./clinicalInstrumentClinicianAssisted.ts");
const assistedCatalog = read("./nexus/clinicianAssistedInstrumentCatalog.ts");
const publicCatalog = read("./nexus/publicSelfAssessmentCatalog.ts");
const ui = read("../components/ClinicianAssistedInstrumentApplyNow.tsx");
const workspace = read("../components/ClinicalEncounterWorkspaceV4.tsx");
const instrumentWorkspace = read(
  "../components/ClinicianAssistedInstrumentWorkspace.tsx",
);

describe("Clinician-Assisted Administration V1 boundary", () => {
  it("authenticates the clinician before using the service-only writer", () => {
    expect(edge).toContain("admin.auth.getUser");
    expect(edge).toContain("authData.user.id");
    expect(edge).toContain(
      "admin.rpc('record_clinician_assisted_clinical_instrument'",
    );
    expect(edge).not.toContain("p_actor_user_id: body");
    expect(edge).not.toContain("clinicId");
    expect(edge).not.toContain("patientId");
  });

  it("reuses the shared server-side engine while keeping PHQ-15, CAGE and PCL-5 assisted-only", () => {
    expect(edge).toContain("../_shared/clinical-instrument-engine.ts");
    expect(processor).toContain("../_shared/clinical-instrument-engine.ts");
    expect(processor).not.toContain("const PHQ9:");
    expect(processor).not.toContain("const GAD7:");
    expect(processor).not.toContain("function requireIntegerRange(");
    expect(processor).toContain(
      "const LEGACY_NEXUS_SELF_ASSESSMENT_TOOL_KEYS = new Set(['phq9', 'gad7'])",
    );
    expect(processor).toContain(
      "LEGACY_NEXUS_SELF_ASSESSMENT_TOOL_KEYS.has(item.toolKey)",
    );
    expect(processor).toContain("legacyNexusScales: legacyProcessors.map");
    expect(processor).toContain(
      "admin.rpc('claim_clinical_instrument_patient_invites'",
    );
    expect(processor).toContain(
      "admin.rpc('complete_clinical_instrument_patient_self_processing'",
    );
    expect(engine).toMatch(/ruleKey:\s*["']nexus\.phq9["']/);
    expect(engine).toMatch(/ruleKey:\s*["']nexus\.gad7["']/);
    expect(engine).toContain("ruleVersion: PHQ9_RULE_VERSION");
    expect(engine).toMatch(/flagCode:\s*["']phq9\.item9\.positive["']/);
    expect(engine).toMatch(/ruleKey:\s*["']nexus\.phq15["']/);
    expect(engine).toContain("ruleVersion: PHQ15_RULE_VERSION");
    expect(engine).toMatch(/ruleKey:\s*["']nexus\.cage["']/);
    expect(engine).toContain("ruleVersion: CAGE_RULE_VERSION");
    expect(engine).toMatch(/ruleKey:\s*["']nexus\.pcl5["']/);
    expect(engine).toContain("ruleVersion: PCL5_RULE_VERSION");
    expect(engine).toMatch(/ruleKey:\s*["']nexus\.pcptsd5["']/);
    expect(engine).toContain("ruleVersion: PCPTSD5_RULE_VERSION");
    expect(assistedCatalog).toMatch(/toolKey:\s*["']phq15["']/);
    expect(assistedCatalog).toMatch(/toolKey:\s*["']cage["']/);
    expect(assistedCatalog).toMatch(/toolKey:\s*["']pcl5["']/);
    expect(assistedCatalog).toMatch(/toolKey:\s*["']pcptsd5["']/);
    expect(publicCatalog).not.toContain("'phq15'");
    expect(publicCatalog).not.toContain("'pcl5'");
    expect(publicCatalog).not.toContain("'pcptsd5'");
  });

  it("adds PHQ-15 as an additive neutral catalog contract without auto-grants", () => {
    expect(phq15Migration).toContain(
      "'scales', 'phq15', 'nexus.phq15', 'nexus-phq15-2026-09-13', 'nexus.scales'",
    );
    expect(phq15Migration).toContain("'phq15', 'nexus', 'scales', 'phq15'");
    expect(phq15Migration).not.toMatch(
      /INSERT\s+INTO\s+public\.professional_capabilities/i,
    );
    expect(phq15Migration).not.toMatch(
      /INSERT\s+INTO\s+public\.clinic_clinical_instrument_settings/i,
    );
  });


  it("adds CAGE as an additive neutral catalog contract without auto-grants or patient-self exposure", () => {
    expect(cageMigration).toContain(
      "'scales', 'cage', 'nexus.cage', 'nexus-cage-2026-09-16', 'nexus.scales'",
    );
    expect(cageMigration).toContain("'cage', 'nexus', 'scales', 'cage'");
    expect(cageMigration).not.toMatch(/INSERT\s+INTO\s+public\.professional_capabilities/i);
    expect(cageMigration).not.toMatch(/INSERT\s+INTO\s+public\.clinic_clinical_instrument_settings/i);
    expect(cageMigration).not.toMatch(/INSERT\s+INTO\s+public\.clinical_instrument_patient_self_contracts/i);
  });


  it("adds PCL-5 as a versioned Brazilian neutral catalog contract without auto-grants or patient-self exposure", () => {
    expect(pcl5Migration).toContain(
      "'scales', 'pcl5', 'nexus.pcl5', 'nexus-pcl5-br-2026-09-16', 'nexus.scales'",
    );
    expect(pcl5Migration).toContain("'pcl5', 'nexus', 'scales', 'pcl5'");
    expect(pcl5Migration).not.toMatch(/INSERT\s+INTO\s+public\.professional_capabilities/i);
    expect(pcl5Migration).not.toMatch(/INSERT\s+INTO\s+public\.clinic_clinical_instrument_settings/i);
    expect(pcl5Migration).not.toMatch(/INSERT\s+INTO\s+public\.clinical_instrument_patient_self_contracts/i);
  });


  it("adds PC-PTSD-5 as an operational PT-BR assisted-only contract without auto-grants or patient-self exposure", () => {
    expect(pcptsd5Migration).toContain(
      "'scales', 'pcptsd5', 'nexus.pcptsd5', 'nexus-pcptsd5-ptbr-ops-2026-09-16', 'nexus.scales'",
    );
    expect(pcptsd5Migration).toContain("'pcptsd5', 'nexus', 'scales', 'pcptsd5'");
    expect(pcptsd5Migration).toContain('no Brazilian validation');
    expect(pcptsd5Migration).not.toMatch(/INSERT\s+INTO\s+public\.professional_capabilities/i);
    expect(pcptsd5Migration).not.toMatch(/INSERT\s+INTO\s+public\.clinic_clinical_instrument_settings/i);
    expect(pcptsd5Migration).not.toMatch(/INSERT\s+INTO\s+public\.clinical_instrument_patient_self_contracts/i);
  });

  it("persists only canonical validated answers instead of arbitrary browser keys", () => {
    expect(edge).toContain("const canonicalAnswers = calculated.canonicalAnswers ?? Object.fromEntries(");
    expect(edge).toContain(
      "calculated.answersArray.map((value, index) => [`q${index + 1}`, value])",
    );
    expect(engine).toContain('canonicalAnswers: { q0: 0 }');
    expect(edge).toContain("p_answers: canonicalAnswers");
    expect(edge).not.toContain("p_answers: answers,");
  });

  it("keeps Nexus capability metadata out of neutral clinician-assisted authorization", () => {
    expect(edge).not.toContain("nexus.scales");
    expect(edge).not.toContain("requiredCapability");
    const writer =
      migration.match(
        /CREATE OR REPLACE FUNCTION public\.record_clinician_assisted_clinical_instrument\([\s\S]*?\$\$;/i,
      )?.[0] ?? "";
    expect(writer).toContain("can_apply_clinical_instrument_in_encounter");
    expect(writer).toContain("clinical_instrument_catalog");
    expect(writer).not.toContain("nexus.scales");
    expect(writer).not.toContain("nexus_clinical_results");
    expect(writer).not.toContain("current_app_role");
    expect(writer).not.toContain("professional_type");
    expect(writer).not.toContain("fisio_id");
  });

  it("persists an immutable encounter-scoped clinician_assisted snapshot", () => {
    expect(migration).toContain(
      "CREATE TABLE IF NOT EXISTS public.clinical_instrument_administrations",
    );
    expect(migration).toContain("CHECK (provenance = 'clinician_assisted')");
    expect(migration).toContain(
      "UNIQUE (professional_id, appointment_id, request_id)",
    );
    expect(migration).toContain(
      "BEFORE UPDATE OR DELETE ON public.clinical_instrument_administrations",
    );
    expect(migration).toContain("a.status = 'em_atendimento'");
    expect(migration).toContain("a.professional_id = p_actor_user_id");
  });

  it("resolves Apply Now availability through the neutral Encounter act boundary", () => {
    expect(uiAdapter).toMatch(
      /db\.rpc\(\s*["']can_apply_clinical_instrument_in_encounter["']/,
    );
    expect(uiAdapter).toMatch(
      /supabase\.functions\.invoke\(\s*["']clinical-instrument-clinician-assisted["']/,
    );
    expect(uiAdapter).not.toContain("nexus.access");
    expect(uiAdapter).not.toContain("nexus.scales");
    expect(uiAdapter).not.toContain("clinical.assessment.apply");
  });

  it("keeps Apply Now independent from the Assessment Engine capability gate", () => {
    const assessmentStart = workspace.indexOf(
      "activeWorkspace === 'assessment'",
    );
    const instrumentsStart = workspace.indexOf(
      "activeWorkspace === 'instruments'",
    );
    const prescriptionStart = workspace.indexOf(
      "activeWorkspace === 'prescription'",
    );
    const assessmentGate = workspace.indexOf(
      "assessmentCapability.loading",
      assessmentStart,
    );
    const instrumentSurface = workspace.indexOf(
      "<ClinicianAssistedInstrumentWorkspace",
      instrumentsStart,
    );

    expect(assessmentStart).toBeGreaterThan(-1);
    expect(instrumentsStart).toBeGreaterThan(assessmentStart);
    expect(prescriptionStart).toBeGreaterThan(instrumentsStart);
    expect(assessmentGate).toBeGreaterThan(assessmentStart);
    expect(assessmentGate).toBeLessThan(instrumentsStart);
    expect(instrumentSurface).toBeGreaterThan(instrumentsStart);
    expect(instrumentSurface).toBeLessThan(prescriptionStart);
    expect(instrumentWorkspace).toContain(
      "<ClinicianAssistedInstrumentApplyNow",
    );
    expect(instrumentWorkspace).toContain(
      "<ClinicianAssistedInstrumentHistory",
    );
    expect(workspace.slice(assessmentStart, instrumentsStart)).not.toContain(
      "ClinicianAssistedInstrumentWorkspace",
    );
    expect(workspace.slice(instrumentsStart, prescriptionStart)).not.toContain(
      "assessmentCapability",
    );
    expect(workspace.slice(instrumentsStart, prescriptionStart)).not.toContain(
      "nexus.scales",
    );
  });

  it("renders only server-returned score and safety signals without browser clinical inference", () => {
    expect(ui).toContain("result.totalScore");
    expect(ui).toContain("result.maxScore");
    expect(ui).toContain("result.classification");
    expect(ui).toContain("result.interpretation");
    expect(ui).toContain("result.safetySignals");
    expect(ui).not.toContain("answers.q9");
    expect(ui).not.toContain("q9 >");
    expect(ui).not.toContain(".reduce(");
    expect(ui).not.toContain("totalScore =");
    expect(ui).not.toContain("classification =");
  });

  it("clears gated symptom answers when a clinician changes the trauma gate to the stopping response", () => {
    expect(ui).toContain('const answerQuestion = (questionId: string, value: number) =>');
    expect(ui).toContain('definition?.gate?.questionId === questionId');
    expect(ui).toContain('value !== definition.gate.continueWhenValue');
    expect(ui).toContain('return { [questionId]: value };');
    expect(ui).toContain('onClick={() => answerQuestion(question.id, option.value)}');
  });

  it("creates one request id per application and preserves it for retry", () => {
    expect(ui.match(/crypto\.randomUUID\(\)/g)).toHaveLength(1);
    expect(ui).toContain("requestId: session.requestId");
    expect(ui).toContain(
      "Você pode tentar novamente sem duplicar a aplicação.",
    );
  });
});
