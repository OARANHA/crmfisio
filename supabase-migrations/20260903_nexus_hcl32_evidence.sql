-- MedicsPro / Nexus — HCL-32 evidence provenance
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
    'hcl32-angst-2005',
    'mental-health.hypomania',
    'HCL-32 original',
    'Angst J, Adolfsson R, Benazzi F, et al. J Affect Disord. 2005;88(2):217-33.',
    2005,
    'Fonte original do Hypomania Checklist de 32 itens usada como referência pelo Nexus.',
    '["32 itens binários", "rastreamento de hipomania", "uso em história de episódios depressivos"]'::jsonb,
    'nexus-2026-09-03',
    true
  ),
  (
    'hcl32-brazil-soares-2010',
    'mental-health.hypomania',
    'Validação brasileira do HCL-32',
    'Soares OT, Moreno RA, Moura EC, Angst J. Rev Bras Psiquiatr. 2010;32(4):438-445.',
    2010,
    'Validação brasileira usada pelo Nexus para o ponto de corte de 18 pontos.',
    '["corte brasileiro >= 18", "sensibilidade 75%", "especificidade 58%", "alfa de Cronbach 0,86"]'::jsonb,
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
