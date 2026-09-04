-- MedicsPro / Nexus — alcohol screening evidence provenance
BEGIN;

INSERT INTO public.nexus_evidence_sources (
  evidence_key, topic, title, source, publication_year, summary, key_points, evidence_version, active
)
VALUES
  ('audit-who-babor-2001', 'mental-health.alcohol', 'AUDIT manual', 'Babor TF, Higgins-Biddle JC, Saunders JB, Monteiro MG. WHO/MSD/MSB/01.6a, 2001.', 2001, 'Referência principal do AUDIT usada pelo Nexus.', '["10 itens", "0-40 pontos", "zonas I-IV", "corte >=8"]'::jsonb, 'nexus-2026-09-03', true),
  ('audit-brazil-validation', 'mental-health.alcohol', 'Validação brasileira do AUDIT', 'Mendez EB (1999); Moretti-Pires RO, Corradi-Webster CM (2011).', NULL, 'Referências brasileiras registradas na implementação Nexus.', '["validação brasileira", "atenção primária"]'::jsonb, 'nexus-2026-09-03', true),
  ('auditc-bush-1998', 'mental-health.alcohol', 'AUDIT-C', 'Bush K, Kivlahan DR, McDonell MB, Fihn SD, Bradley KA. Arch Intern Med. 1998;158(16):1789-95.', 1998, 'Referência original do AUDIT-C usada pelo Nexus.', '["3 itens", "rastreio breve"]'::jsonb, 'nexus-2026-09-03', true),
  ('cage-ewing-1984', 'mental-health.alcohol', 'CAGE questionnaire', 'Ewing JA. JAMA. 1984;252(14):1905-7.', 1984, 'Referência clássica do CAGE.', '["4 itens", "corte >=2"]'::jsonb, 'nexus-2026-09-03', true),
  ('cage-brazil-masur-1983', 'mental-health.alcohol', 'Validação brasileira CAGE', 'Masur J, Monteiro MG. Rev Assoc Med Bras. 1983.', 1983, 'Referência brasileira registrada pelo Nexus para o CAGE.', '["validação brasileira"]'::jsonb, 'nexus-2026-09-03', true)
ON CONFLICT (evidence_key) DO UPDATE
SET topic = EXCLUDED.topic,
    title = EXCLUDED.title,
    source = EXCLUDED.source,
    publication_year = EXCLUDED.publication_year,
    summary = EXCLUDED.summary,
    key_points = EXCLUDED.key_points,
    evidence_version = EXCLUDED.evidence_version,
    active = true,
    updated_at = now();

COMMIT;
