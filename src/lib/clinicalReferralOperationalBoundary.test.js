import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../../supabase-migrations/20260913_clinical_referral_operational_continuity_v1.sql');
const referral = read('./clinicalReferral.ts');
const agenda = read('../pages/AgendaReal.tsx');

describe('D2-E4 referral operational continuity boundary', () => {
  it('keeps operational state separate from the immutable referral document', () => {
    expect(migration).toContain('CREATE TABLE IF NOT EXISTS public.clinical_referral_operations');
    expect(migration).toContain('referral_document_id uuid NOT NULL UNIQUE REFERENCES public.clinical_documents');
    expect(migration).not.toContain('ALTER TABLE public.clinical_documents ADD COLUMN');
  });

  it('creates or recovers one server-validated appointment link', () => {
    expect(migration).toContain('schedule_clinical_referral_operation');
    expect(migration).toContain("v_op.destination_scope='internal_professional' AND p_professional_id IS DISTINCT FROM v_op.target_profile_id");
    expect(migration).toContain('IF v_op.appointment_id IS NOT NULL THEN');
  });

  it('preserves the operational link through canonical rescheduling', () => {
    expect(migration).toContain('NEW.rescheduled_from_id');
    expect(migration).toContain("'rescheduled'");
  });

  it('uses the Agenda creation surface without trusting a browser referral link', () => {
    expect(referral).toContain("db.rpc('open_clinical_referral_operation'");
    expect(agenda).toContain("'schedule_clinical_referral_operation'");
    expect(agenda).toContain('referral_operation');
  });
});
