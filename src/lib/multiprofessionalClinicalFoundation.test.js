import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  fileURLToPath(new URL('../../supabase-migrations/20260907_multiprofessional_clinical_foundation.sql', import.meta.url)),
  'utf8',
);
const model = readFileSync(
  fileURLToPath(new URL('../../docs/MULTIPROFESSIONAL_DOMAIN_MODEL.md', import.meta.url)),
  'utf8',
);
const agenda = readFileSync(fileURLToPath(new URL('../pages/AgendaReal.tsx', import.meta.url)), 'utf8');
const dashboard = readFileSync(fileURLToPath(new URL('../pages/Dashboard.tsx', import.meta.url)), 'utf8');
const reports = readFileSync(fileURLToPath(new URL('../pages/Relatorios.tsx', import.meta.url)), 'utf8');

describe('multiprofessional clinical foundation', () => {
  it('separates operational role from clinical identity and capability', () => {
    expect(model).toContain('Papel operacional na clínica');
    expect(model).toContain('Identidade profissional');
    expect(model).toContain('Capabilities clínicas');
    expect(model).toContain('owner');
    expect(model).toContain('professional');
  });

  it('models medicine, psychology, physiotherapy and chiropractic without new clinical roles', () => {
    expect(migration).toContain("v_council = 'crefito'");
    expect(migration).toContain("v_council = 'crp'");
    expect(migration).toContain("v_council = 'crm'");
    expect(migration).toContain("'quiropraxista'");
    expect(model).toContain('Psiquiatria é especialidade de Medicina');
  });

  it('authorizes clinical work through generic capabilities instead of profession name', () => {
    expect(migration).toContain('current_user_has_clinical_capability');
    expect(migration).toContain("'clinical.attend'");
    expect(migration).toContain("'clinical.evolution.write'");
    expect(migration).toContain("'clinical.assessment.apply'");
    expect(migration).toContain("'clinical.body_map'");
    expect(migration).not.toContain('current_user_can_author_physiotherapy()');
  });

  it('keeps the legacy physiotherapy bridge explicitly temporary rather than canonical', () => {
    expect(model).toContain('`fisio` é legado de compatibilidade');
    expect(migration).toContain('Temporary compatibility bridge');
  });

  it('discovers care providers by professional identity rather than operational role', () => {
    for (const source of [agenda, dashboard, reports]) {
      expect(source).toContain('hasClinicalDirectoryIdentity');
    }
    expect(dashboard).toContain('u.ativo && hasClinicalDirectoryIdentity(u.professionalType)');
    expect(reports).toContain('u.ativo && hasClinicalDirectoryIdentity(u.professionalType)');
  });
});
