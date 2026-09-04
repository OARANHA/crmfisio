-- Nexus Clinical Engine — evidências do segundo lote de escalas
-- Aditivo/idempotente. Não altera resultados históricos.

BEGIN;

INSERT INTO public.nexus_evidence_sources
  (evidence_key, topic, title, source, publication_year, evidence_version, active)
VALUES
  ('asrs-kessler-2005', 'TDAH adulto', 'ASRS v1.1', 'Kessler RC, Adler L, Ames M, et al. Psychol Med. 2005;35(2):245-56.', 2005, 'nexus-2026-09-03', true),
  ('asrs-brazil-mattos-2006', 'TDAH adulto', 'Validação brasileira ASRS-18', 'Mattos P, Segenreich D, Saboya E, Louzã M, et al. Rev Psiquiatr Clín. 2006;33(4):188-94.', 2006, 'nexus-2026-09-03', true),
  ('ybocs-goodman-1989', 'TOC', 'Y-BOCS', 'Goodman WK, Price LH, Rasmussen SA, et al. Arch Gen Psychiatry. 1989;46(11):1006-11.', 1989, 'nexus-2026-09-03', true),
  ('ybocs-brazil-cordioli-1998', 'TOC', 'Validação brasileira Y-BOCS', 'Cordioli AV et al. 1998.', NULL, 'nexus-2026-09-03', true),
  ('epds-cox-1987', 'Saúde mental perinatal', 'EPDS', 'Cox JL, Holden JM, Sagovsky R. Br J Psychiatry. 1987;150:782-6.', 1987, 'nexus-2026-09-03', true),
  ('epds-brazil-santos-2007', 'Saúde mental perinatal', 'Validação brasileira EPDS', 'Santos IS et al. Cad Saude Publica. 2007.', 2007, 'nexus-2026-09-03', true),
  ('srq20-harding-1980', 'Transtornos mentais comuns', 'Self-Reporting Questionnaire', 'Harding TW et al. Psychol Med. 1980;10(2):231-41.', 1980, 'nexus-2026-09-03', true),
  ('srq20-brazil-mari-1986', 'Transtornos mentais comuns', 'Validação brasileira SRQ', 'Mari JJ, Williams P. 1986.', 1986, 'nexus-2026-09-03', true),
  ('phq15-kroenke-2002', 'Sintomas somáticos', 'PHQ-15', 'Kroenke K, Spitzer RL, Williams JB. Psychosom Med. 2002;64(2):258-66.', 2002, 'nexus-2026-09-03', true)
ON CONFLICT (evidence_key) DO UPDATE
SET topic = EXCLUDED.topic,
    title = EXCLUDED.title,
    source = EXCLUDED.source,
    publication_year = EXCLUDED.publication_year,
    evidence_version = EXCLUDED.evidence_version,
    active = true,
    updated_at = now();

COMMIT;
