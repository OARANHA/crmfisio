import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const page = readFileSync(fileURLToPath(new URL('../pages/RecepcaoHoje.tsx', import.meta.url)), 'utf8');

describe('today queue clinical handoff', () => {
  it('shows clinical actions only to the assigned physiotherapist', () => {
    expect(page).toContain("user?.role === 'fisio' && item.professional_id === user.id");
    expect(page).toContain('isAssignedClinician && arrived');
  });

  it('hands a started session directly into the clinical workspace', () => {
    expect(page).toContain("await status(item, 'em_atendimento')");
    expect(page).toContain('if (accepted) nav(clinicalSessionPath(item))');
    expect(page).toContain('?session=${item.appointment_id}#clinical-workspace');
  });

  it('does not offer direct finalization outside the chart', () => {
    expect(page).toContain('Continuar atendimento');
    expect(page).not.toContain("status(item, 'finalizado')");
  });
});
