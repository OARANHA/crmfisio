-- MedicsPro / Nexus Clinical Engine — PHQ-9 vertical slice
-- Metadados de evidência e proveniência. Não altera a regra clínica.

BEGIN;

INSERT INTO public.nexus_evidence_sources (
  evidence_key,
  topic,
  title,
  source,
  publication_year,
  summary,
  key_points,
  evidence_version,
  active
)
VALUES
  (
    'phq9-kroenke-2001',
    'mental-health/depression/phq-9',
    'The PHQ-9: validity of a brief depression severity measure',
    'Kroenke K, Spitzer RL, Williams JB. J Gen Intern Med. 2001;16(9):606-13.',
    2001,
    'Fonte primária usada pelo Nexus para o PHQ-9.',
    '["Instrumento de 9 itens", "Escore total de 0 a 27", "Base do versionamento clínico PHQ-9 no Nexus"]'::jsonb,
    'nexus-2026-09-03',
    true
  ),
  (
    'phq9-brazil-validation',
    'mental-health/depression/phq-9',
    'Validação brasileira do PHQ-9',
    'Osório FL et al. (2009); Santos IS et al. (2013).',
    2009,
    'Referências de validação brasileira registradas na implementação clínica original do Nexus.',
    '["Validação brasileira", "Uso em contexto de APS"]'::jsonb,
    'nexus-2026-09-03',
    true
  )
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
