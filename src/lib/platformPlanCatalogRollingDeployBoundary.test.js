import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const client = source('./platformAdmin.ts');
const planPanel = source('../components/PlatformClinicPlanPanel.tsx');
const entitlementPanel = source('../components/PlatformClinicEntitlementsPanel.tsx');

describe('Platform Plan Catalog rolling deploy boundary', () => {
  it('falls back to v2 entitlements only when the v3 RPC is explicitly missing', () => {
    expect(client).toContain("isMissingRpcError(current.error, 'platform_get_clinic_entitlements_v3')");
    expect(client).toContain("rpc('platform_get_clinic_entitlements_v2'");
    expect(client).toContain('if (legacy.error) throw legacy.error');
    expect(client).toContain("key === 'finance.access'");
    expect(client).toContain("key === 'whatsapp.access'");
  });

  it('does not enable Plan Catalog actions before the backend contract exists', () => {
    expect(client).toContain('PlatformPlanCatalogUnavailableError');
    expect(planPanel).toContain('catalogAvailable === false');
    expect(planPanel).toContain('Catálogo aguardando promoção do backend.');
    expect(planPanel).toContain('Verificando contrato do Plan Catalog…');
    expect(planPanel).toContain('setCatalogAvailable(plansAvailable && assignmentAvailable)');
    expect(planPanel).toContain('catalogAvailable === true');
  });

  it('renders no-baseline products as blocked instead of inherited rollout', () => {
    expect(entitlementPanel).toContain("return item.effective ? 'Rollout herdado' : 'Sem baseline · bloqueado'");
    expect(entitlementPanel).toContain("item.effective ? 'Herdar rollout' : 'Sem override'");
    expect(entitlementPanel).toContain("item.effective ? 'Baseline: rollout legado' : 'Baseline: sem baseline'");
  });
});
