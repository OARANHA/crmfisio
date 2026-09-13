import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const migration = read('../../supabase-migrations/20260913_clinical_referral_target_professional_fix.sql');
const modal = read('../components/AppointmentCreateModal.tsx');

describe('D2-E4 fixed referral target scheduling', () => {
  it('allows a professional caller to schedule only the immutable internal-professional target', () => {
    expect(migration).toContain("v_op.destination_scope='internal_professional'");
    expect(migration).toContain('p_professional_id IS NOT DISTINCT FROM v_op.target_profile_id');
    expect(migration).toContain('clinical_referral_operation_self_or_fixed_target_required');
    expect(migration).toContain("v_op.destination_scope='internal_professional' AND p_professional_id IS DISTINCT FROM v_op.target_profile_id");
    expect(migration).not.toContain('clinical_referral_operation_self_schedule_required');
  });

  it('preserves the referral target instead of replacing it with the logged-in professional', () => {
    expect(modal).toContain('creating.referralOperationId');
    expect(modal).toContain('? (creating.fisioId ?? (user?.role === \'professional\' ? user.id : \'\'))');
    expect(modal).toContain('const referralFixedProfessional = Boolean(creating?.referralOperationId && creating.fisioId)');
    expect(modal).toContain('disabled={professionalLocked}');
  });

  it('locks patient identity during referral continuity', () => {
    expect(modal).toContain('const patientLocked = Boolean(creating?.referralOperationId)');
    expect(modal).toContain('disabled={patientLocked}');
  });
});
