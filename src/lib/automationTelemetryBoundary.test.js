import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const tenantAutomation = source('./automation.ts');
const operationalHealth = source('../components/dashboards/OperationalHealthCard.tsx');
const automationControl = source('../components/messages/AutomationControlPanel.tsx');
const platformAdmin = source('./platformAdmin.ts');
const securityMigration = source('../../supabase-migrations/20260904_platform_automation_observability_security.sql');

describe('automation telemetry authorization boundary', () => {
  it('keeps platform-wide automation_runs out of tenant browser code', () => {
    expect(tenantAutomation).not.toContain('automation_runs');
    expect(operationalHealth).not.toContain('loadAutomationRuns');
    expect(automationControl).not.toContain('loadAutomationRuns');
  });

  it('keeps global run telemetry behind the Platform Admin RPC', () => {
    expect(platformAdmin).toContain("db.rpc('platform_get_automation_runs'");
    expect(securityMigration).toContain('REVOKE SELECT ON TABLE public.automation_runs FROM authenticated');
    expect(securityMigration).toContain('Platform-admin-only operational telemetry');
  });

  it('keeps clinic automation settings available without claiming global health', () => {
    expect(tenantAutomation).toContain("from('automation_settings' as never)");
    expect(automationControl).toContain('telemetria global das execuções é restrita ao Platform Admin');
    expect(operationalHealth).not.toContain('automação saudável');
  });
});
