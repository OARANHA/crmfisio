-- Nexus cardiovascular risk evidence. Additive/idempotent.
BEGIN;

INSERT INTO public.nexus_evidence_sources
  (evidence_key, topic, title, source, publication_year, evidence_version, active)
VALUES
  ('cv-framingham-dagostino-2008', 'Risco cardiovascular', 'General cardiovascular risk profile', 'D''Agostino RB Sr, Vasan RS, Pencina MJ, et al. Circulation. 2008;117(6):743-753.', 2008, 'nexus-cv-risk-2026-09-04', true),
  ('cv-sbc-prevention', 'Risco cardiovascular', 'Diretriz Brasileira de Prevenção Cardiovascular', 'Sociedade Brasileira de Cardiologia.', NULL, 'nexus-cv-risk-2026-09-04', true)
ON CONFLICT (evidence_key) DO UPDATE
SET topic = EXCLUDED.topic,
    title = EXCLUDED.title,
    source = EXCLUDED.source,
    publication_year = EXCLUDED.publication_year,
    evidence_version = EXCLUDED.evidence_version,
    active = true,
    updated_at = now();

COMMIT;
