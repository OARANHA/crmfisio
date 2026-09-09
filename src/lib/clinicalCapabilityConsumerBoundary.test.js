import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

const hook = source('../hooks/useClinicalCapability.ts');
const modal = source('../components/AppointmentActionModal.tsx');
const workspace = source('../components/ClinicalWorkspace.tsx');

describe('clinical capability consumer boundary', () => {
  it('uses only the canonical RPC parameter name', () => {
    expect(hook).toContain("{ p_capability: capability }");
    expect(hook).not.toContain('p_capability_key');
  });

  it('keeps technical errors distinct from explicit denials', () => {
    expect(hook).toContain("export type ClinicalCapabilityStatus = 'loading' | 'allowed' | 'denied' | 'error'");
    expect(hook).toContain("setStatus('error')");
    expect(hook).toContain("setStatus(data === true ? 'allowed' : 'denied')");
  });

  it('does not grant clinical actions from role fallbacks', () => {
    expect(modal).not.toContain('if (!canAttend) return true');
    expect(workspace).toContain('const clinicalRead = canReadTimeline;');
    expect(workspace).toContain('const documentWrite = canManageClinicalDocuments;');
    expect(workspace).not.toContain('canReadTimeline || isClinicManager');
    expect(workspace).not.toContain('canManageClinicalDocuments || isClinicManager');
  });

  it('does not use professional type or specialty as a capability bypass', () => {
    expect(modal).not.toContain('isPsychiatristIdentity');
    expect(workspace).not.toContain('isPsychiatristIdentity');
    expect(modal).not.toContain('professionalType');
    expect(workspace).not.toContain('professionalType');
  });

  it('shows a safe user-facing message for capability verification failures', () => {
    expect(modal).toContain('Não foi possível verificar suas permissões clínicas.');
    expect(workspace).toContain('Não foi possível verificar suas permissões clínicas.');
  });
});
