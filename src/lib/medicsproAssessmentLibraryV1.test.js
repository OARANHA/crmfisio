import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../supabase-migrations/20260911_medicspro_general_psychiatric_assessments_v1.sql', import.meta.url), 'utf8');

describe('MedicsPro assessment library V1', () => {
  it('ships only the two curated platform templates as published immutable content', () => {
    expect(migration).toContain("'Anamnese Médica Geral'");
    expect(migration).toContain("'Anamnese Psiquiátrica'");
    expect(migration).toContain("'platform'");
    expect(migration).toContain('ON CONFLICT (id) DO NOTHING');
    expect(migration).toContain('published_at');
  });

  it('uses the existing section/component engine and keeps validated instruments out', () => {
    expect(migration).toContain('"sections"');
    expect(migration).toContain('"multiple_choice"');
    expect(migration).toContain('"single_choice"');
    expect(migration).toContain('"risco_atual"');
    expect(migration).not.toMatch(/PHQ-9|GAD-7/);
  });
});
