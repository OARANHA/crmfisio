import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const shellSource = readFileSync(fileURLToPath(new URL('../components/Shell.tsx', import.meta.url)), 'utf8');
const clinicianSource = readFileSync(fileURLToPath(new URL('../components/dashboards/ClinicianDashboard.tsx', import.meta.url)), 'utf8');
const metricSource = readFileSync(fileURLToPath(new URL('../components/dashboards/DashboardMetricGrid.tsx', import.meta.url)), 'utf8');
const cssSource = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');

describe('MedicsPro UI Foundation V2 system scale', () => {
  it('keeps a comfortable desktop shell instead of returning to the compact legacy scale', () => {
    expect(shellSource).toContain("collapsed ? 'w-ui-sidebar-compact' : 'w-ui-sidebar-expanded'");
    expect(shellSource).toContain('min-h-ui-control items-center');
    expect(shellSource).toContain("collapsed ? 'lg:pl-ui-sidebar-compact' : 'lg:pl-ui-sidebar-expanded'");
    expect(shellSource).toContain('md:text-ui-body');
  });

  it('keeps the clinician home visually prioritized around the working day', () => {
    expect(clinicianSource).toContain('Seu dia está aqui');
    expect(clinicianSource).toContain('sm:text-ui-hero-title-lg');
    expect(clinicianSource).toContain('xl:grid-cols-[1.4fr_1fr]');
    expect(metricSource).toContain('text-ui-metric-value');
    expect(metricSource).toContain('min-h-ui-control items-center');
  });

  it('codifies the approved comfortable scale as additive semantic tokens', () => {
    expect(cssSource).toContain('--spacing-ui-control: 3rem');
    expect(cssSource).toContain('--spacing-ui-sidebar-compact: 5.5rem');
    expect(cssSource).toContain('--spacing-ui-sidebar-expanded: 18.25rem');
    expect(cssSource).toContain('--text-ui-page-title: 2.125rem');
    expect(cssSource).toContain('--text-ui-hero-title-lg: 2.625rem');
    expect(cssSource).toContain('--radius-ui-surface: 1.5rem');
    expect(cssSource).toContain('--radius-ui-data-surface: 1.375rem');
  });

  it('treats the light theme as a first-class UI surface', () => {
    expect(cssSource).toContain("html[data-theme='light'] .medicspro-sidebar");
    expect(cssSource).toContain('--color-ink: #f1f5f3');
    expect(cssSource).toContain('--color-mint: #0f8069');
  });
});
