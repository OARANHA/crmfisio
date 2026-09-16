import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");

const migration = read(
  "../../supabase-migrations/20260916_clinical_instrument_patient_delivery_v1.sql",
);
const verifier = read(
  "../../supabase-verifiers/VERIFY_20260916_CLINICAL_INSTRUMENT_PATIENT_DELIVERY_V1.sql",
);
const edge = read(
  "../../supabase/functions/clinical-instrument-patient-delivery/index.ts",
);
const processor = read(
  "../../supabase/functions/nexus-self-assessment-processor/index.ts",
);
const client = read("./clinicalInstrumentPatientDelivery.ts");
const ui = read("../components/ClinicalInstrumentPatientDelivery.tsx");
const workspace = read(
  "../components/ClinicianAssistedInstrumentWorkspace.tsx",
);
const historyClient = read("./clinicalInstrumentClinicianAssisted.ts");
const historyUi = read("../components/ClinicianAssistedInstrumentHistory.tsx");

const extractFunction = (name) =>
  migration.match(
    new RegExp(
      `CREATE OR REPLACE FUNCTION public\\.${name}\\([\\s\\S]*?\\$\\$;`,
      "i",
    ),
  )?.[0] ?? "";

describe("Clinical Instrument Patient Delivery V1 boundary", () => {
  it("authenticates the actor at the edge and never accepts tenant/professional authority from the browser", () => {
    expect(edge).toContain("admin.auth.getUser");
    expect(edge).toContain("p_actor_user_id: authData.user.id");
    expect(edge).toContain(
      "admin.rpc('enqueue_clinical_instrument_patient_delivery'",
    );
    expect(edge).not.toContain("clinicId");
    expect(edge).not.toContain("patientId");
    expect(edge).not.toContain("professionalId");
  });

  it("keeps patient delivery on a neutral authorization boundary instead of Nexus capability authority", () => {
    const boundary = extractFunction("can_send_clinical_instrument_to_patient");
    expect(boundary).toContain("clinical_instrument_base_authorized");
    expect(boundary).toContain("clinical_instrument_patient_self_contracts");
    expect(boundary).toContain("a.status = 'em_atendimento'");
    expect(boundary).not.toContain("nexus.scales");
    expect(boundary).not.toContain("nexus.access");
    expect(boundary).not.toContain("current_app_role");
  });

  it("drives available instruments from the versioned delivery registry rather than PHQ/GAD UI branches", () => {
    expect(client).toMatch(
      /db\.rpc\(\s*["']list_available_clinical_instrument_patient_delivery["']/,
    );
    expect(client).toMatch(
      /db\.rpc\(\s*["']list_clinical_instrument_patient_deliveries["']/,
    );
    expect(client).toMatch(
      /supabase\.functions\.invoke\(\s*["']clinical-instrument-patient-delivery["']/,
    );
    expect(ui).toContain("available.map((item) =>");
    expect(ui).toContain("item.displayLabel");
    expect(ui).toContain("item.engineRuleVersion");
    expect(ui).not.toContain("'phq9'");
    expect(ui).not.toContain("'gad7'");
    expect(client).not.toContain("nexus.scales");
  });

  it("preserves one request id across a retry and refreshes history only after server-confirmed status work", () => {
    expect(ui.match(/crypto\.randomUUID\(\)/g)).toHaveLength(1);
    expect(ui).toContain(
      "requestIds[item.instrumentKey] ?? crypto.randomUUID()",
    );
    expect(ui).toContain("requestId,");
    expect(ui).toContain("await reload(true)");
    expect(workspace).toContain("<ClinicalInstrumentPatientDelivery");
    expect(workspace).toContain(
      "onStatusRefresh={() => setHistoryRevision((current) => current + 1)}",
    );
  });

  it("keeps service writers and registry rows out of direct browser access", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.enqueue_clinical_instrument_patient_delivery",
    );
    expect(migration).toContain("FROM PUBLIC, anon, authenticated;");
    expect(migration).toContain(
      "GRANT EXECUTE ON FUNCTION public.enqueue_clinical_instrument_patient_delivery",
    );
    expect(migration).toContain("TO service_role;");
    expect(verifier).toContain(
      "has_table_privilege('authenticated','public.clinical_instrument_patient_self_contracts','SELECT')",
    );
  });

  it("separates historical Nexus processing from neutral clinical-instrument processing", () => {
    expect(processor).toContain("LEGACY_NEXUS_SELF_ASSESSMENT_TOOL_KEYS");
    expect(processor).toContain("authority: 'nexus'");
    expect(processor).toContain("authority: 'clinical_instrument'");
    expect(processor).toContain(
      "admin.rpc('claim_clinical_instrument_patient_invites'",
    );
    expect(processor).toContain(
      "admin.rpc('complete_clinical_instrument_patient_self_processing'",
    );
  });

  it("projects a single neutral longitudinal history for assisted and patient-self provenance", () => {
    expect(historyClient).toMatch(
      /db\.rpc\(\s*["']list_patient_clinical_instrument_history["']/,
    );
    expect(historyClient).toMatch(
      /["']clinician_assisted["']\s*\|\s*["']patient_self["']/,
    );
    expect(historyUi).toMatch(/item\.provenance\s*===\s*["']patient_self["']/);
    expect(historyUi).toContain("respondido pelo paciente");
    expect(historyClient).not.toContain(
      ".from('clinical_instrument_administrations')",
    );
  });
  it("keeps the newest delivery status for each instrument", () => {
    expect(ui).toMatch(
      /if\s*\(\s*!latest\.has\(item\.instrumentKey\)\s*\)\s*latest\.set\(item\.instrumentKey,\s*item\)/,
    );
    expect(migration).toContain("ORDER BY i.created_at DESC, i.id DESC");
  });
});
