import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const workspace = read('../components/ClinicalReferralWorkspace.tsx');
const agenda = read('../pages/AgendaReal.tsx');

describe('D2-E4 referral agenda handoff', () => {
  it('passes the immutable referral document id back through the server boundary', () => {
    expect(workspace).toContain('navigate(`/agenda?referral_operation=${document.id}`)');
    expect(workspace).not.toContain('referral_operation=${operation.id}');
    expect(workspace).not.toContain('&patient=${operation.patientId}');
    expect(agenda).toContain("const operationId = searchParams.get('referral_operation');");
    expect(agenda).toContain('openReferralOperation(operationId)');
  });

  it('does not fall back to generic patient-prefill when starting referral continuity', () => {
    expect(workspace).not.toContain('/agenda?referral_operation=${document.id}&patient=');
  });
});
