import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const migration = read(
  "../../supabase-migrations/20260915_clinician_assisted_instrument_history_v1.sql",
);
const verifier = read(
  "../../supabase-verifiers/VERIFY_20260915_CLINICIAN_ASSISTED_INSTRUMENT_HISTORY_V1.sql",
);
const client = read("./clinicalInstrumentClinicianAssisted.ts");
const history = read("../components/ClinicianAssistedInstrumentHistory.tsx");
const instrumentWorkspace = read(
  "../components/ClinicianAssistedInstrumentWorkspace.tsx",
);
const encounterWorkspace = read(
  "../components/ClinicalEncounterWorkspaceV4.tsx",
);
const longitudinalWorkspace = read("../components/ClinicalWorkspaceV3.tsx");

describe("Neutral clinician-assisted instrument history V1 boundary", () => {
  it("uses the canonical chart-read boundary instead of apply or Nexus authority", () => {
    expect(migration).toContain(
      "can_access_patient_clinical_record(p_patient_id)",
    );
    expect(migration).not.toContain("clinical.instrument.apply");
    expect(migration).not.toContain("nexus.access");
    expect(migration).not.toContain("nexus.scales");
    expect(verifier).toContain("can_access_patient_clinical_record");
  });
  it("keeps the immutable administration ledger browser-inaccessible", () => {
    expect(migration).not.toMatch(
      /GRANT\s+SELECT\s+ON\s+TABLE\s+public\.clinical_instrument_administrations\s+TO\s+authenticated/i,
    );
    expect(client).toMatch(
      /db\.rpc\(\s*["']list_patient_clinical_instrument_history["']/,
    );
    expect(client).not.toContain(
      ".from('clinical_instrument_administrations')",
    );
    expect(verifier).toContain(
      "has_table_privilege('authenticated','public.clinical_instrument_administrations','SELECT')",
    );
  });

  it("projects only longitudinal summary fields and never raw clinical payload snapshots", () => {
    for (const forbidden of [
      "answers_snapshot",
      "output_snapshot",
      "evidence_snapshot",
      "soap_text",
    ]) {
      expect(migration).not.toContain(forbidden);
    }
    expect(migration).toContain("has_safety_signal boolean");
    expect(migration).toContain("has_critical_safety_signal boolean");
    expect(history.replace(/\s+/g, " ")).toContain(
      "Instrumento de rastreio. O resultado não estabelece diagnóstico nem conduta isoladamente.",
    );
  });
  it("shows the same neutral history in the active Instrumentos workspace and the longitudinal chart", () => {
    expect(instrumentWorkspace).toContain(
      "<ClinicianAssistedInstrumentApplyNow",
    );
    expect(instrumentWorkspace).toContain("<ClinicalInstrumentPatientDelivery");
    expect(instrumentWorkspace).toContain(
      "<ClinicianAssistedInstrumentHistory",
    );
    expect(encounterWorkspace).toContain(
      "<ClinicianAssistedInstrumentWorkspace appointmentId={canonicalEncounter.id} patientId={patient.id} />",
    );
    expect(longitudinalWorkspace).toContain(
      "<ClinicianAssistedInstrumentHistory patientId={patient.id} />",
    );
  });

  it("refreshes history only after a server-confirmed clinician-assisted administration", () => {
    expect(instrumentWorkspace).toContain("onRecorded={handleRecorded}");
    expect(instrumentWorkspace).toContain(
      "setHistoryRevision((current) => current + 1)",
    );
    expect(instrumentWorkspace).toContain("refreshKey={historyRevision}");
    expect(history).toMatch(
      /useClinicalCapability\(\s*["']clinical\.timeline\.read["']/,
    );
    expect(history).toMatch(/item\.provenance\s*===\s*["']patient_self["']/);
    expect(history).toContain("respondido pelo paciente");
    expect(history).not.toContain("clinical.instrument.apply");
    expect(history).not.toContain("nexus.access");
  });
});
