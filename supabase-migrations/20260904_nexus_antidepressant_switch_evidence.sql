BEGIN;

INSERT INTO public.nexus_evidence_sources
  (evidence_key, topic, title, source, publication_year, evidence_version, active)
VALUES
  ('hayasaka-antidepressant-equivalence-2015', 'Psicofarmacologia', 'Dose equivalents of antidepressants: evidence-based recommendations from randomized controlled trials', 'Hayasaka Y et al. J Affect Disord. 2015.', 2015, 'nexus-antidepressant-switch-2026-09-04', true),
  ('maudsley-prescribing-guidelines-14', 'Psicofarmacologia', 'The Maudsley Prescribing Guidelines in Psychiatry, 14th Edition', 'Taylor D, Barnes TRE, Young AH.', 2021, 'nexus-antidepressant-switch-2026-09-04', true)
ON CONFLICT (evidence_key) DO UPDATE
SET topic = EXCLUDED.topic,
    title = EXCLUDED.title,
    source = EXCLUDED.source,
    publication_year = EXCLUDED.publication_year,
    evidence_version = EXCLUDED.evidence_version,
    active = true,
    updated_at = now();

COMMIT;
