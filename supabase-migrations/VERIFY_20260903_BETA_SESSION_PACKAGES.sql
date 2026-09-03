\pset null '(nulo)'

SELECT
  c.name AS clinica,
  sp.nome,
  sp.sessoes,
  to_char(sp.preco / 100.0, 'FM999G999G990D00') AS preco_reais,
  to_char((sp.preco / 100.0) / sp.sessoes, 'FM999G999G990D00') AS valor_por_sessao,
  sp.validade_dias,
  sp.ativo
FROM public.session_packages sp
JOIN public.clinics c ON c.id = sp.clinic_id
WHERE sp.clinic_id = (
  SELECT clinic_id
  FROM public.profiles
  WHERE lower(email) = 'aranha.com@gmail.com'
    AND role = 'owner'
    AND ativo IS TRUE
  LIMIT 1
)
ORDER BY sp.sessoes, sp.nome;

SELECT count(*) AS pacotes_beta_encontrados
FROM public.session_packages sp
WHERE sp.clinic_id = (
  SELECT clinic_id
  FROM public.profiles
  WHERE lower(email) = 'aranha.com@gmail.com'
    AND role = 'owner'
    AND ativo IS TRUE
  LIMIT 1
)
AND sp.nome IN (
  'Fisioterapia — 5 sessões',
  'Fisioterapia — 10 sessões',
  'Fisioterapia — 20 sessões'
);
