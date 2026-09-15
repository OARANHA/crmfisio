import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const indexHtml = readFileSync(fileURLToPath(new URL('../../index.html', import.meta.url)), 'utf8');

describe('MedicsPro public branding boundary', () => {
  it('presents the canonical multiprofessional product identity in browser metadata', () => {
    expect(indexHtml).toContain('<title>MedicsPro — SaaS multiprofissional para clínicas</title>');
    expect(indexHtml).toContain('content="MedicsPro — SaaS multiprofissional para clínicas:');
  });

  it('does not regress the platform identity to the legacy physiotherapy-only brand', () => {
    expect(indexHtml).not.toContain('Coração — Gestão de Clínica de Fisioterapia');
    expect(indexHtml).not.toContain('sistema de gestão para clínicas de fisioterapia');
  });
});
