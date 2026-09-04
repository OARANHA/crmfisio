BEGIN;

INSERT INTO public.nexus_evidence_sources
  (evidence_key, topic, title, source, publication_year, evidence_version, active)
VALUES
  ('ckd-epi-2021-inge-2021', 'Função renal', 'CKD-EPI 2021 sem raça', 'Inker LA et al. New Creatinine- and Cystatin C-Based Equations to Estimate GFR without Race. N Engl J Med. 2021.', 2021, 'nexus-egfr-2026-09-04', true)
ON CONFLICT (evidence_key) DO UPDATE
SET topic = EXCLUDED.topic,
    title = EXCLUDED.title,
    source = EXCLUDED.source,
    publication_year = EXCLUDED.publication_year,
    evidence_version = EXCLUDED.evidence_version,
    active = true,
    updated_at = now();

COMMIT;
