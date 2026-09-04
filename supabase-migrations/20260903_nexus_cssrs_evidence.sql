-- Nexus Clinical Engine — proveniência da C-SSRS preservada do conteúdo clínico validado.
-- Depende de 20260903_nexus_wave0_foundation.sql.

BEGIN;

INSERT INTO public.nexus_evidence_sources (
  evidence_key,
  topic,
  title,
  source,
  publication_year,
  summary,
  evidence_version,
  active
)
VALUES (
  'cssrs-posner-2011',
  'suicide-risk',
  'The Columbia-Suicide Severity Rating Scale: initial validity and internal consistency findings',
  'Posner K, Brown GK, Stanley B, et al. Am J Psychiatry. 2011;168(12):1266-77.',
  2011,
  'Fonte clínica utilizada pela implementação Nexus da C-SSRS adaptada à APS.',
  'nexus-2026-09-03',
  true
)
ON CONFLICT (evidence_key) DO UPDATE
SET topic = EXCLUDED.topic,
    title = EXCLUDED.title,
    source = EXCLUDED.source,
    publication_year = EXCLUDED.publication_year,
    summary = EXCLUDED.summary,
    evidence_version = EXCLUDED.evidence_version,
    active = true,
    updated_at = now();

COMMIT;
