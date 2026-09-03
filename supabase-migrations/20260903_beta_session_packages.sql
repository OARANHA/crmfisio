-- MEDICSPRO — catálogo inicial de pacotes para o beta acompanhado
-- Escopo deliberadamente restrito à clínica cujo owner é aranha.com@gmail.com.
-- Valores em centavos. A carga é idempotente e não sobrescreve pacotes existentes.

BEGIN;

DO $$
DECLARE
  v_clinic_id uuid;
  v_matches integer;
BEGIN
  SELECT count(DISTINCT clinic_id), min(clinic_id::text)::uuid
  INTO v_matches, v_clinic_id
  FROM public.profiles
  WHERE lower(email) = 'aranha.com@gmail.com'
    AND role = 'owner'
    AND ativo IS TRUE;

  IF v_matches <> 1 OR v_clinic_id IS NULL THEN
    RAISE EXCEPTION
      'Carga cancelada: esperado exatamente um owner ativo aranha.com@gmail.com; encontrados %',
      v_matches;
  END IF;

  INSERT INTO public.session_packages (
    clinic_id,
    nome,
    sessoes,
    preco,
    validade_dias,
    descricao,
    ativo,
    updated_at
  )
  SELECT
    v_clinic_id,
    seed.nome,
    seed.sessoes,
    seed.preco,
    seed.validade_dias,
    seed.descricao,
    TRUE,
    now()
  FROM (
    VALUES
      ('Fisioterapia — 5 sessões', 5, 67500, 45,
       'Pacote inicial com 10% de desconto sobre a sessão-base de R$ 150.'),
      ('Fisioterapia — 10 sessões', 10, 127500, 90,
       'Pacote de tratamento com 15% de desconto sobre a sessão-base de R$ 150.'),
      ('Fisioterapia — 20 sessões', 20, 240000, 180,
       'Pacote de continuidade com 20% de desconto sobre a sessão-base de R$ 150.')
  ) AS seed(nome, sessoes, preco, validade_dias, descricao)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.session_packages existing
    WHERE existing.clinic_id = v_clinic_id
      AND lower(trim(existing.nome)) = lower(trim(seed.nome))
  );
END;
$$;

COMMIT;
