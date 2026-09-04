BEGIN;

INSERT INTO public.nexus_evidence_sources (evidence_key, title, source, publication_year, clinical_version, status)
VALUES
  ('snap-iv-mattos-2006', 'Validação brasileira SNAP-IV', 'Mattos P et al. Rev Psiquiatr Rio Gd Sul. 2006;28(3):290-297.', 2006, 'nexus-2026-09-03', 'active'),
  ('isi-bastien-2001', 'Insomnia Severity Index validation', 'Bastien CH, Vallières A, Morin CM. Sleep Med. 2001;2(4):297-307.', 2001, 'nexus-2026-09-03', 'active'),
  ('hama-hamilton-1959', 'Hamilton Anxiety Rating Scale', 'Hamilton M. Br J Med Psychol. 1959;32(1):50-5.', 1959, 'nexus-2026-09-03', 'active'),
  ('mdq-hirschfeld-2000', 'Mood Disorder Questionnaire', 'Hirschfeld RM et al. Am J Psychiatry. 2000;157(11):1873-5.', 2000, 'nexus-2026-09-03', 'active'),
  ('pcptsd5-prins-2016', 'PC-PTSD-5 development', 'Prins A et al. J Gen Intern Med. 2016;31(10):1206-11.', 2016, 'nexus-2026-09-03', 'active'),
  ('pcl5-blevins-2015', 'PCL-5 development and psychometric evaluation', 'Blevins CA et al. J Trauma Stress. 2015;28(6):489-98.', 2015, 'nexus-2026-09-03', 'active')
ON CONFLICT (evidence_key, clinical_version) DO UPDATE
SET title = EXCLUDED.title,
    source = EXCLUDED.source,
    publication_year = EXCLUDED.publication_year,
    status = EXCLUDED.status,
    updated_at = now();

COMMIT;
