-- Nexus Clinical Engine — referências estruturantes do EEM
-- Aditivo/idempotente.

BEGIN;

INSERT INTO public.nexus_evidence_sources
  (evidence_key, topic, title, source, publication_year, evidence_version, active)
VALUES
  ('eem-dalgalarrondo', 'Exame do Estado Mental', 'Psicopatologia e Semiologia dos Transtornos Mentais', 'Dalgalarrondo P.', NULL, 'nexus-eem-2026-09-03', true),
  ('eem-kaplan-sadock', 'Exame do Estado Mental', 'Kaplan & Sadock’s Synopsis of Psychiatry', 'Kaplan & Sadock.', NULL, 'nexus-eem-2026-09-03', true)
ON CONFLICT (evidence_key) DO UPDATE
SET topic = EXCLUDED.topic,
    title = EXCLUDED.title,
    source = EXCLUDED.source,
    evidence_version = EXCLUDED.evidence_version,
    active = true,
    updated_at = now();

COMMIT;
