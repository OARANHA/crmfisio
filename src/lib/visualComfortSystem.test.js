import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (relative) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const css = read('../index.css');
const ui = read('./ui.tsx');
const shell = read('../components/Shell.tsx');
const metrics = read('../components/dashboards/DashboardMetricGrid.tsx');
const clinician = read('../components/dashboards/ClinicianDashboard.tsx');
const reception = read('../components/dashboards/ReceptionDashboard.tsx');

const highFrequencyPages = [
  '../pages/Pacientes.tsx',
  '../pages/Crm.tsx',
  '../pages/Mensagens.tsx',
  '../pages/Relatorios.tsx',
  '../pages/ConfigPremium.tsx',
].map(read);

describe('MedicsPro Visual Comfort System V1', () => {
  it('raises sustained-use legibility without returning to compact typography', () => {
    expect(css).toContain('--color-fog: #465b52');
    expect(css).toContain('font-size: 16px');
    expect(css).toContain('.medicspro-page-title');
    expect(css).toContain('.medicspro-page-subtitle');
    expect(shell).toContain('medicspro-workspace');
  });

  it('centralizes shared cards, controls and fields instead of styling each module independently', () => {
    expect(ui).toContain('medicspro-card rounded-[18px] border border-line/75 bg-panel');
    expect(ui).toContain('medicspro-card-head');
    expect(ui).toContain('medicspro-button');
    expect(ui).toContain('medicspro-field');
  });

  it('uses restrained semantic color as orientation rather than decoration', () => {
    for (const tone of ['info', 'focus', 'attention', 'success', 'document']) {
      expect(css).toContain(`.comfort-tone-${tone}`);
    }
    expect(metrics).toContain('dashboard-metric');
    expect(metrics).toContain('dashboard-metric-icon');
    expect(metrics).toContain('grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5');
    expect(clinician).toContain("surface: 'attention'");
    expect(clinician).toContain("surface: 'success'");
    expect(reception).toContain("surface: 'document'");
  });

  it('keeps page hierarchy consistent across high-frequency operational modules', () => {
    for (const source of highFrequencyPages) {
      expect(source).toContain('medicspro-page-title');
    }
  });

  it('reaches Agenda and Financeiro through the shared comfortable card foundation', () => {
    expect(read('../pages/AgendaReal.tsx')).toContain('<Card');
    expect(read('../pages/FinanceiroOperational.tsx')).toContain('<Card');
    expect(ui).toContain('medicspro-card');
  });

  it('respects reduced-motion preferences for long working sessions', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain('background-image: linear-gradient');
    expect(css).toContain('animation-duration: 0.01ms !important');
  });
});
