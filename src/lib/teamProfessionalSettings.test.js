import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const team = readFileSync(fileURLToPath(new URL('../components/TeamAdmin.tsx', import.meta.url)), 'utf8');
const identity = readFileSync(fileURLToPath(new URL('./professionalIdentity.ts', import.meta.url)), 'utf8');
const edge = readFileSync(fileURLToPath(new URL('../../supabase/functions/admin-team/index.ts', import.meta.url)), 'utf8');

describe('multiprofessional team settings', () => {
  it('separates operational function from professional identity', () => {
    expect(team).toContain('Função operacional');
    expect(team).toContain('Identidade profissional');
    expect(team).toContain('Atuação clínica');
    expect(team).toContain('Também atua clinicamente');
  });

  it('models the initial professional catalog without making psychiatry a profession', () => {
    expect(identity).toContain("'fisioterapeuta'");
    expect(identity).toContain("'medico'");
    expect(identity).toContain("'psicologo'");
    expect(identity).toContain("'quiropraxista'");
    expect(identity).toContain("specialtyPlaceholder: 'Ex.: Psiquiatria'");
    expect(identity).not.toContain("ProfessionalType = 'psiquiatra'");
  });

  it('keeps clinical capability grants explicit and server-controlled', () => {
    for (const capability of [
      'clinical.attend',
      'clinical.timeline.read',
      'clinical.evolution.write',
      'clinical.assessment.apply',
      'clinical.body_map',
      'clinical.documents',
    ]) {
      expect(identity).toContain(capability);
      expect(edge).toContain(capability);
    }
    expect(edge).toContain(".from('professional_capabilities')");
    expect(edge).toContain("onConflict: 'professional_id,capability_key'");
    expect(edge).not.toContain("onConflict: 'clinic_id,professional_id,capability_key'");
  });

  it('lets the owner receive clinical identity without changing owner role', () => {
    expect(team).toContain("const ownerEditing = editingRole === 'owner'");
    expect(team).toContain("if (!ownerEditing)");
    expect(edge).toContain("if (payload.role !== undefined || payload.unit_ids !== undefined)");
  });
});
