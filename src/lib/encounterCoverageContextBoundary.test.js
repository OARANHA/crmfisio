import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const component = readFileSync(new URL('../components/EncounterCoverageContextCard.tsx', import.meta.url), 'utf8');
const client = readFileSync(new URL('./encounterCoverageContext.ts', import.meta.url), 'utf8');
const workspace = readFileSync(new URL('../components/ClinicalEncounterWorkspaceV4.tsx', import.meta.url), 'utf8');
const migration = readFileSync(new URL('../../supabase-migrations/20260915_encounter_coverage_context_v1.sql', import.meta.url), 'utf8');

describe('Encounter Coverage Context V1 boundary', () => {
  it('uses a dedicated appointment-scoped RPC instead of FinanceContext', () => {
    expect(client).toContain("supabase.rpc('get_encounter_coverage_context'");
    expect(component).not.toContain('useFinance');
    expect(component).not.toContain('/financeiro');
    expect(component).not.toContain('resolveFinancialException');
  });

  it('does not grant global finance authority or financial mutations', () => {
    expect(migration).not.toContain("current_clinic_entitlement_allowed('finance.access')");
    expect(migration).not.toMatch(/GRANT\s+(?:SELECT|INSERT|UPDATE|DELETE)\s+ON\s+public\.(?:payments|appointment_financial_exceptions)/i);
    expect(migration).not.toMatch(/CREATE\s+POLICY/i);
    expect(migration).toContain("current_user_has_clinical_capability('clinical.attend')");
    expect(migration).toContain('a.professional_id = v_uid');
    expect(migration).toContain("a.status = 'em_atendimento'");
  });

  it('mounts coverage in the persistent active-Encounter context rail', () => {
    expect(workspace).toContain("import { EncounterCoverageContextCard } from './EncounterCoverageContextCard';");
    expect(workspace).toContain('<EncounterCoverageContextCard appointmentId={canonicalEncounter.id} />');
  });

  it('keeps the human reading order patient -> closing -> coverage in the context rail', () => {
    const railStart = workspace.indexOf('aria-label="Contexto persistente da consulta"');
    const railEnd = workspace.indexOf('</aside>', railStart);
    const rail = workspace.slice(railStart, railEnd);
    const patientIndex = rail.indexOf('Paciente em contexto');
    const closingIndex = rail.indexOf('<ConsultationStateCard');
    const coverageIndex = rail.indexOf('<EncounterCoverageContextCard');
    expect(patientIndex).toBeGreaterThan(-1);
    expect(closingIndex).toBeGreaterThan(patientIndex);
    expect(coverageIndex).toBeGreaterThan(closingIndex);
    expect(workspace).toContain('>Encerramento</p>');
  });
});
