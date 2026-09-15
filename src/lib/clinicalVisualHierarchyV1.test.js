import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const encounter = read('../components/ClinicalEncounterWorkspaceV4.tsx');
const shell = read('../components/Shell.tsx');
const css = read('../index.css');

describe('Consultório V5 clinical visual hierarchy V1', () => {
  it('keeps color semantic instead of decorative', () => {
    expect(css).toContain('--clinical-focus: var(--color-aqua)');
    expect(css).toContain('--clinical-action: var(--color-mint)');
    expect(css).toContain('--clinical-attention: var(--color-amber)');
    expect(encounter).toContain("border-amber/35 text-amber");
    expect(encounter).toContain("bg-mint text-on-accent");
  });

  it('adds stronger but contained clinical surfaces without changing global density tokens', () => {
    expect(encounter).toContain('clinical-encounter-hero');
    expect(encounter).toContain('clinical-workspace-nav');
    expect(encounter).toContain('clinical-encounter-section');
    expect(encounter).toContain('clinical-context-card');
    expect(css).toContain("html[data-theme='light'] .clinical-encounter-section");
    expect(css).toContain('box-shadow: 0 10px 30px rgba(31, 58, 48, 0.055)');
  });

  it('moves longitudinal history from the page bottom into an on-demand reference drawer', () => {
    expect(encounter).toContain('const [historyOpen, setHistoryOpen] = useState(false)');
    expect(encounter).toContain('onClick={() => setHistoryOpen(true)}');
    expect(encounter).toContain('role="dialog" aria-modal="true"');
    expect(encounter).toContain('Prontuário longitudinal e histórico');
    expect(encounter).toContain("if (event.key === 'Escape') setHistoryOpen(false)");
    expect(encounter).not.toContain('<details id="encounter-history"');
  });

  it('strengthens the global navigation active state without adding another navigation model', () => {
    expect(shell).toContain('medicspro-nav-item relative');
    expect(shell).toContain("bg-mint/[0.16] text-mint ring-1 ring-inset ring-mint/20 shadow-sm");
    expect(css).toContain(".medicspro-nav-item[aria-current='page']::before");
  });
});
