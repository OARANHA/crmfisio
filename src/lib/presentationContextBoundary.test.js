import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const shellSource = readFileSync(resolve(here, '../components/Shell.tsx'), 'utf8');
const appSource = readFileSync(resolve(here, '../App.tsx'), 'utf8');
const providerSource = readFileSync(resolve(here, './presentationContextContext.tsx'), 'utf8');
const privacySource = readFileSync(resolve(here, '../components/PresentationPrivacyBoundary.tsx'), 'utf8');
const permissionsSource = readFileSync(resolve(here, './permissions.ts'), 'utf8');
const activeEncounterSource = readFileSync(resolve(here, './activeClinicalEncounter.ts'), 'utf8');
const encounterRecordSource = readFileSync(resolve(here, '../components/ClinicalEncounterRecordEditor.tsx'), 'utf8');

describe('Consultório / Gestão presentation boundary', () => {
  it('layers presentation-safe navigation after real module, Nexus and entitlement visibility', () => {
    const moduleGate = shellSource.indexOf('(canView(n.key)');
    const nexusGate = shellSource.indexOf('(!n.nexus || nexusVisible)', moduleGate);
    const entitlementGate = shellSource.indexOf('isModuleVisibleByEntitlement(n.key, entitlementVisibility)', nexusGate);
    const presentationFilter = shellSource.indexOf('isNavigationPresentationSafe(n.to, presentationContext)', entitlementGate);

    expect(moduleGate).toBeGreaterThan(-1);
    expect(nexusGate).toBeGreaterThan(moduleGate);
    expect(entitlementGate).toBeGreaterThan(nexusGate);
    expect(presentationFilter).toBeGreaterThan(entitlementGate);
  });

  it('keeps Nexus capability + entitlement driven in either presentation context', () => {
    expect(shellSource).toContain("hasProfessionalCapability('nexus.access')");
    expect(shellSource).toContain('isModuleVisibleByEntitlement(n.key, entitlementVisibility)');
    expect(appSource).toContain("moduleGate('clinico', entitlementGate('nexus.access', <NexusGlobalPage />))");
  });

  it('does not expose global financial pending counts in Consultório', () => {
    expect(shellSource).toContain("presentationContext === 'clinical'");
    expect(shellSource).toContain('? consentPendencies');
    expect(shellSource).toContain(": transactions.filter((t) => t.status === 'atrasado').length + consentPendencies");
  });

  it('keeps desktop collapse, mobile drawer and dark/light controls in the presentation-aware shell', () => {
    expect(shellSource).toContain("medicspro-sidebar-collapsed");
    expect(shellSource).toContain("lg:hidden fixed inset-0 z-50");
    expect(shellSource).toContain('<ThemeButton theme={theme} onToggle={toggleTheme} />');
    expect(shellSource).toContain('PresentationModeControl compact={collapsed}');
    expect(shellSource).toContain('<PresentationModeControl />');
  });

  it('keeps real route guards outside the privacy boundary', () => {
    expect(appSource).toContain("protectedModule('financeiro', 'finance.access', privacyBoundary(<FinanceiroOperational />))");
    expect(appSource).toContain("protectedModule('crm', 'crm.access', privacyBoundary(<CrmOperational />))");
    expect(appSource).toContain("protectedModule('relatorios', 'reports.access', privacyBoundary(<RelatoriosHub />))");
    expect(appSource).toContain("moduleGate('config', privacyBoundary(<ConfigPremium />))");
    expect(appSource).toContain('const protectedModule =');
    expect(appSource).toContain('moduleGate(module, entitlementGate(entitlement, element))');
  });

  it('blocks the administrative surface instead of rendering a zeroed finance page in Consultório', () => {
    expect(privacySource).toContain('Você está no Modo Consultório. Para proteger informações administrativas durante o atendimento');
    expect(privacySource).toContain('Continuar no Consultório');
    expect(privacySource).toContain('Sair do Modo Consultório');
    expect(privacySource).toContain("if (context !== 'clinical') return <>{children}</>");
    expect(privacySource).toContain("availableContexts.includes('management')");
  });

  it('does not suggest privilege elevation to clinical-only professionals', () => {
    const clinicalOnlyCopy = privacySource.indexOf('Esta área não está disponível no Modo Consultório');
    const managementButton = privacySource.indexOf('{canUseManagement && (');
    expect(clinicalOnlyCopy).toBeGreaterThan(-1);
    expect(managementButton).toBeGreaterThan(-1);
    expect(privacySource).toContain("{canUseManagement ? 'Continuar no Consultório' : 'Voltar ao Consultório'}");
  });

  it('derives owner/admin clinical eligibility from existing read-only identity and capability contracts', () => {
    expect(providerSource).toContain("db.rpc('current_user_has_valid_clinical_identity')");
    expect(providerSource).toContain("db.rpc('current_user_has_clinical_capability', { p_capability: 'clinical.attend' })");
    expect(providerSource).toContain('profile?.clinic_id ?? null');
    expect(providerSource).toContain('`${userId}:${clinicId}`');
    expect(providerSource).not.toContain('set_config');
    expect(providerSource).not.toContain('.insert(');
    expect(providerSource).not.toContain('.update(');
    expect(providerSource).not.toContain('.delete(');
  });

  it('does not modify the coarse authorization matrix through presentation code', () => {
    expect(permissionsSource).toContain("professional: PROFESSIONAL_ACCESS");
    expect(permissionsSource).toContain("financeiro: 'read'");
    expect(permissionsSource).toContain("config: 'none'");
    expect(providerSource).not.toContain('ACCESS_MATRIX');
    expect(providerSource).not.toContain('accessFor(');
  });

  it('preserves the canonical active encounter resolver used by current clinical flows', () => {
    expect(activeEncounterSource).toContain('export function resolveOwnActiveEncounter');
    expect(activeEncounterSource).toContain("appointment.status === 'em_atendimento'");
    expect(activeEncounterSource).toContain('professionalIdOf(appointment) === professionalId');
    expect(activeEncounterSource).toContain('return matches.length === 1 ? matches[0] : null;');
  });

  it('does not replace or bypass the #394 Encounter Record workflow', () => {
    expect(encounterRecordSource).toContain('saveClinicalEncounterRecord(');
    expect(encounterRecordSource).toContain('finalizeClinicalEncounterRecord(');
    expect(encounterRecordSource).toContain('Revisar e concluir');
    expect(appSource).not.toContain('Cobertura deste atendimento');
  });
});
