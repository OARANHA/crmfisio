import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const hook = source('../hooks/useClinicalCapability.ts');
const modal = source('../components/AppointmentActionModal.tsx');
const workspace = source('../components/ClinicalWorkspace.tsx');
const dashboard = source('../pages/DashboardRoleAware.tsx');

describe('clinical capability consumer boundary', () => {
  it('uses only the canonical RPC parameter name', () => {
    expect(hook).toContain("{ p_capability: capability }");
    expect(hook).not.toContain('p_capability_key');
  });

  it('keeps technical errors distinct from explicit denials and keys resolved state to the current request', () => {
    expect(hook).toContain("export type ClinicalCapabilityStatus = 'loading' | 'allowed' | 'denied' | 'error'");
    expect(hook).toContain('resolution.key === resolutionKey');
    expect(hook).toContain("setResolution({ key: requestKey, status: 'error' })");
    expect(hook).toContain("status: data === true ? 'allowed' : 'denied'");
  });

  it('does not grant clinical actions from role fallbacks', () => {
    expect(modal).not.toContain('if (!canAttend) return true');
    expect(workspace).toContain('const clinicalRead = canReadTimeline;');
    expect(workspace).not.toContain("useClinicalCapability('clinical.documents'");
    expect(workspace).not.toContain('canReadTimeline || isClinicManager');
    expect(workspace).not.toContain('canManageClinicalDocuments || isClinicManager');
  });

  it('keeps professional type and specialty as UX context, never a MedicsPro capability bypass', () => {
    expect(modal).not.toContain('isPsychiatristIdentity');
    expect(workspace).not.toContain('isPsychiatristIdentity');
    expect(modal).not.toContain('professionalType');
    expect(workspace).not.toContain('professionalType');
    expect(dashboard).toContain("useClinicalCapability('clinical.attend'");
    expect(dashboard).toContain('if (!capabilityLoading && canAttend)');
    expect(dashboard).toContain("nexusAllowed === true && isPsychiatristIdentity(identity)");
  });

  it('shows a safe user-facing message for capability verification failures', () => {
    expect(modal).toContain('Não foi possível verificar suas permissões clínicas.');
    expect(workspace).toContain('Não foi possível verificar suas permissões clínicas.');
  });
});
