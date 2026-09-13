import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../../supabase-migrations/20260913_clinic_referral_authoring_policy_v1.sql');
const configPage = read('../pages/ConfigPremium.tsx');
const configPanel = read('../components/configuration/ClinicClinicalFlowsAdmin.tsx');

describe('Clinic Referral Authoring Policy V1', () => {
  it('keeps configuration separate from user authorization and historical referral lifecycle', () => {
    expect(migration).toContain('referral_authoring_enabled boolean NOT NULL DEFAULT true');
    expect(migration).toContain('clinical_referral_authoring_disabled');
    expect(migration).toContain("OLD.status = 'draft'");
    expect(migration).toContain("NEW.status IN ('draft', 'issued')");
    expect(migration).not.toContain("OLD.status = 'issued' AND NEW.status = 'canceled'");
  });

  it('does not expose direct authenticated writes to the clinic policy table', () => {
    expect(migration).toContain('REVOKE ALL ON TABLE public.clinic_clinical_flow_settings FROM PUBLIC, anon, authenticated');
    expect(migration).toContain("v_role NOT IN ('owner', 'admin')");
    expect(migration).toContain('ON CONFLICT (clinic_id) DO NOTHING');
  });

  it('surfaces the policy under a dedicated clinical flows configuration area', () => {
    expect(configPage).toContain("{ key: 'fluxos', title: 'Fluxos clínicos'");
    expect(configPage).toContain("section === 'fluxos' && <ClinicClinicalFlowsAdmin />");
    expect(configPanel).toContain('Permitir que profissionais emitam encaminhamentos');
    expect(configPanel).toContain('O bloqueio é aplicado no PostgreSQL');
  });
});
