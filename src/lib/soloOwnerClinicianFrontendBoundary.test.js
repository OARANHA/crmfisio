import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const hook = readFileSync(fileURLToPath(new URL('../hooks/usePhysiotherapyAuthorship.ts', import.meta.url)), 'utf8');
const dashboard = readFileSync(fileURLToPath(new URL('../pages/DashboardRoleAware.tsx', import.meta.url)), 'utf8');

describe('solo owner clinician frontend boundary', () => {
  it('uses the canonical server-side authorship helper and fails closed', () => {
    expect(hook).toContain("rpc('current_user_can_author_physiotherapy')");
    expect(hook).toContain('setAllowed(false)');
    expect(hook).not.toContain("role === 'owner'");
  });

  it('keeps Nexus restricted to the existing fisio medical path', () => {
    expect(dashboard).toContain("if (user?.role !== 'fisio')");
    expect(dashboard).toContain("hasProfessionalCapability('nexus.access')");
  });

  it('routes a validated owner clinician to the clinical home without changing role', () => {
    expect(dashboard).toContain('canAuthorPhysiotherapy');
    expect(dashboard).toContain('if (!authorshipLoading && canAuthorPhysiotherapy) return <ClinicianDashboard />;');
  });
});
