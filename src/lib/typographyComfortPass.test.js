import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const css = read('../index.css');
const ui = read('./ui.tsx');
const metrics = read('../components/dashboards/DashboardMetricGrid.tsx');
const clinician = read('../components/dashboards/ClinicianDashboard.tsx');
const shell = read('../components/Shell.tsx');

describe('MedicsPro Typography Comfort Pass V1', () => {
  it('raises the sustained-use workspace scale to an 18px operational body', () => {
    expect(css).toContain('--text-ui-body: 1.125rem');
    expect(shell).toContain('medicspro-workspace');
    expect(shell).toContain('text-ui-body');
  });

  it('promotes legacy microtype instead of leaving 9–15px operational copy untouched', () => {
    expect(css).toContain('font-size: 13.5px !important');
    expect(css).toContain('font-size: 16.5px !important');
    expect(css).toContain('font-size: 18px !important');
    expect(css).toContain('.medicspro-workspace .text-sm { font-size: 1rem !important');
  });

  it('makes shared card hierarchy and controls readable for all-day work', () => {
    expect(ui).toContain('text-[20px] leading-tight');
    expect(ui).toContain('text-[17px] leading-relaxed text-fog');
    expect(ui).toContain('text-[16.5px] font-semibold');
    expect(ui).toContain('py-2.5 text-[17px] text-paper');
  });

  it('makes dashboard cards visually readable rather than micro-labelled', () => {
    expect(metrics).toContain('truncate text-[19px] font-semibold');
    expect(metrics).toContain('min-h-[48px] text-[17px]');
    expect(metrics).toContain('min-h-[184px]');
  });

  it('raises the clinician working-day copy while preserving title and KPI hierarchy', () => {
    expect(clinician).toContain('mt-2 text-[17px] capitalize text-fog');
    expect(clinician).toContain('font-display text-[18px] font-semibold');
    expect(clinician).toContain('block truncate text-[17.5px] font-semibold');
    expect(clinician).toContain('text-ui-hero-title');
  });
});
