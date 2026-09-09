import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const hook = readFileSync(fileURLToPath(new URL('../hooks/useClinicalCapability.ts', import.meta.url)), 'utf8');
const dashboard = readFileSync(fileURLToPath(new URL('../pages/DashboardRoleAware.tsx', import.meta.url)), 'utf8');
const presentation = readFileSync(fileURLToPath(new URL('./dashboardPresentation.ts', import.meta.url)), 'utf8');

describe('solo owner clinician frontend boundary', () => {
  it('uses the canonical server-side capability helper and fails closed', () => {
    expect(hook).toContain("rpc('current_user_has_clinical_capability'");
    expect(hook).toContain("{ p_capability: capability }");
    expect(hook).toContain("setResolution({ key: requestKey, status: 'error' })");
    expect(hook).toContain("allowed: status === 'allowed'");
    expect(hook).toContain('resolution.key === resolutionKey');
    expect(hook).not.toContain("role === 'owner'");
  });

  it('keeps Nexus on its separate medical capability path', () => {
    expect(dashboard).toContain("hasProfessionalCapability('nexus.access')");
    expect(dashboard).toContain('isPsychiatristIdentity(identity)');
    expect(presentation).toContain("if (input.nexusStatus === 'allowed') return 'psychiatry';");
  });

  it('routes only a confirmed attending clinician to the clinical home without changing operational role', () => {
    expect(dashboard).toContain("useClinicalCapability('clinical.attend'");
    expect(dashboard).toContain('attendStatus: attendCapability.status');
    expect(presentation).toContain("if (input.attendStatus !== 'allowed') return 'generic';");
    expect(presentation).toContain("if (input.attendStatus === 'loading') return 'loading';");
    expect(presentation).toContain("if (input.role !== 'professional' && input.role !== 'owner' && input.role !== 'admin') return 'generic';");
    expect(dashboard).toContain("if (presentation === 'clinician') return <ClinicianDashboard />;");
  });
});
