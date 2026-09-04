-- Nexus Clinical Engine — evidências MEEM/Cognição
-- Aditivo/idempotente. Não altera resultados históricos.

BEGIN;

INSERT INTO public.nexus_evidence_sources
  (evidence_key, topic, title, source, publication_year, evidence_version, active)
VALUES
  ('meem-folstein-1975', 'Cognição', 'Mini-Mental State Examination', 'Folstein MF, Folstein SE, McHugh PR. J Psychiatr Res. 1975;12(3):189-98.', 1975, 'nexus-2026-09-04', true),
  ('meem-brucki-2003', 'Cognição', 'Sugestões para o uso do mini-exame do estado mental no Brasil', 'Brucki SMD, Nitrini R, Caramelli P, Bertolucci PH, Okamoto IH. Arq Neuropsiquiatr. 2003;61(3B):777-781.', 2003, 'nexus-2026-09-04', true)
ON CONFLICT (evidence_key) DO UPDATE
SET topic = EXCLUDED.topic,
    title = EXCLUDED.title,
    source = EXCLUDED.source,
    publication_year = EXCLUDED.publication_year,
    evidence_version = EXCLUDED.evidence_version,
    active = true,
    updated_at = now();

COMMIT;
