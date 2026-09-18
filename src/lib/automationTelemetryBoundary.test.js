import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const tenantAutomation = source('./automation.ts');
const operationalHealth = source('../components/dashboards/OperationalHealthCard.tsx');
const automationControl = source('../components/messages/AutomationControlPanel.tsx');
const communicationAdmin = source('../components/configuration/ClinicCommunicationAdmin.tsx');
const configPremium = source('../pages/ConfigPremium.tsx');
const mensagensOperational = source('../pages/MensagensOperational.tsx');
const automationMigration = source('../../supabase-migrations/20260902_whatsapp_automation_orchestrator.sql');
const communicationConfigMigration = source('../../supabase-migrations/20260917_clinic_communication_configuration_v1.sql');
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

  it('places clinic automation administration under Configurações → Comunicação without weakening server authority', () => {
    expect(configPremium).toContain("{ key: 'comunicacao', title: 'Comunicação'");
    expect(configPremium).toContain("section === 'comunicacao' && <ClinicCommunicationAdmin />");
    expect(communicationAdmin).toContain("loadCurrentClinicEntitlementState('whatsapp.access')");
    expect(communicationAdmin).toContain('isCurrentClinicEntitlementAllowed(entitlement)');
    expect(communicationAdmin).toContain('isClinicManager(user?.role)');
    expect(mensagensOperational).not.toContain('AutomationControlPanel');
    expect(automationMigration).toContain("current_app_role() IN ('owner','admin')");
    expect(communicationConfigMigration).toContain("current_clinic_entitlement_allowed('whatsapp.access')");
    expect(communicationConfigMigration).toContain("current_app_role() IN ('owner', 'admin')");
  });

  it('keeps clinic automation settings available without claiming global health', () => {
    expect(tenantAutomation).toContain("from('automation_settings' as never)");
    expect(tenantAutomation).toContain(".select('clinic_id')");
    expect(tenantAutomation).toContain("if (!data) throw new Error('A configuração não pôde ser alterada com o acesso atual.')");
    expect(automationControl).toContain('telemetria global das execuções é restrita ao Platform Admin');
    expect(operationalHealth).not.toContain('automação saudável');
  });
});
