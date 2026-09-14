import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const shellSource = readFileSync(fileURLToPath(new URL('../components/Shell.tsx', import.meta.url)), 'utf8');
const clinicianSource = readFileSync(fileURLToPath(new URL('../components/dashboards/ClinicianDashboard.tsx', import.meta.url)), 'utf8');
const metricSource = readFileSync(fileURLToPath(new URL('../components/dashboards/DashboardMetricGrid.tsx', import.meta.url)), 'utf8');
const cssSource = readFileSync(fileURLToPath(new URL('../index.css', import.meta.url)), 'utf8');

describe('MedicsPro UI Foundation V2 system scale', () => {
  it('keeps a comfortable desktop shell instead of returning to the compact legacy scale', () => {
    expect(shellSource).toContain("collapsed ? 'w-[88px]' : 'w-[292px]'");
    expect(shellSource).toContain('min-h-12 items-center');
    expect(shellSource).toContain("collapsed ? 'lg:pl-[88px]' : 'lg:pl-[292px]'");
    expect(shellSource).toContain('md:text-[16px]');
  });

  it('keeps the clinician home visually prioritized around the working day', () => {
    expect(clinicianSource).toContain('Seu dia está aqui');
    expect(clinicianSource).toContain('sm:text-[42px]');
    expect(clinicianSource).toContain('xl:grid-cols-[1.4fr_1fr]');
    expect(metricSource).toContain('text-[34px]');
    expect(metricSource).toContain('min-h-12 items-center');
  });

  it('treats the light theme as a first-class UI surface', () => {
    expect(cssSource).toContain("html[data-theme='light'] .medicspro-sidebar");
    expect(cssSource).toContain('--color-ink: #f1f5f3');
    expect(cssSource).toContain('--color-mint: #0f8069');
  });
});
