-- MedicsPro / Nexus Clinical Engine — evidências GAD-7
-- Apenas semeia proveniência clínica; não altera contratos existentes.

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
    'gad7-spitzer-2006',
    'GAD-7',
    'A brief measure for assessing generalized anxiety disorder',
    'Spitzer RL, Kroenke K, Williams JB, Löwe B. Arch Intern Med. 2006;166(10):1092-7.',
    2006,
    'Estudo de desenvolvimento e validação do GAD-7 para rastreamento e mensuração da gravidade de sintomas ansiosos.',
    '["instrumento de 7 itens","pontuação 0-21","corte clínico relevante em 10 pontos"]'::jsonb,
    'nexus-2026-09-03',
    true
  ),
  (
    'gad7-brazil-validation',
    'GAD-7',
    'Validação brasileira do GAD-7',
    'Moreno AL et al. Trends Psychiatry Psychother. 2016.',
    2016,
    'Referência de validação brasileira preservada pelo Nexus.',
    '["validação brasileira","interpretação contextual no Brasil"]'::jsonb,
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
