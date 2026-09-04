-- Nexus Clinical Engine — evidências do lote final do Scale Runtime
-- Aditivo/idempotente. Não altera resultados históricos.

BEGIN;

INSERT INTO public.nexus_evidence_sources
  (evidence_key, topic, title, source, publication_year, evidence_version, active)
VALUES
  ('snap-iv-mattos-2006', 'TDAH / neurodesenvolvimento', 'Validação brasileira SNAP-IV', 'Mattos P et al. Rev Psiquiatr Rio Gd Sul. 2006;28(3):290-297.', 2006, 'nexus-2026-09-03', true),
  ('isi-bastien-2001', 'Sono / insônia', 'Insomnia Severity Index validation', 'Bastien CH, Vallières A, Morin CM. Sleep Med. 2001;2(4):297-307.', 2001, 'nexus-2026-09-03', true),
  ('hama-hamilton-1959', 'Ansiedade', 'Hamilton Anxiety Rating Scale', 'Hamilton M. Br J Med Psychol. 1959;32(1):50-5.', 1959, 'nexus-2026-09-03', true),
  ('mdq-hirschfeld-2000', 'Bipolaridade', 'Mood Disorder Questionnaire', 'Hirschfeld RM et al. Am J Psychiatry. 2000;157(11):1873-5.', 2000, 'nexus-2026-09-03', true),
  ('pcptsd5-prins-2016', 'Trauma / TEPT', 'PC-PTSD-5 development', 'Prins A et al. J Gen Intern Med. 2016;31(10):1206-11.', 2016, 'nexus-2026-09-03', true),
  ('pcl5-blevins-2015', 'Trauma / TEPT', 'PCL-5 development and psychometric evaluation', 'Blevins CA et al. J Trauma Stress. 2015;28(6):489-98.', 2015, 'nexus-2026-09-03', true)
ON CONFLICT (evidence_key) DO UPDATE
SET topic = EXCLUDED.topic,
    title = EXCLUDED.title,
    source = EXCLUDED.source,
    publication_year = EXCLUDED.publication_year,
    evidence_version = EXCLUDED.evidence_version,
    active = true,
    updated_at = now();

COMMIT;
