-- D2-B.2C test-only schema enrichment for the minimal PostgreSQL harness.
-- Production already owns these canonical clinic/patient columns.

ALTER TABLE public.clinics
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS nascimento date;

UPDATE public.clinics
SET address = CASE id
      WHEN 'd2000000-0000-4000-8000-000000000001'::uuid THEN 'Av. Clínica, 100 - Porto Alegre/RS'
      ELSE 'Rua Tenant B, 200 - Rio de Janeiro/RJ'
    END,
    phone = CASE id
      WHEN 'd2000000-0000-4000-8000-000000000001'::uuid THEN '(51) 3333-4444'
      ELSE '(21) 2222-3333'
    END
WHERE id IN (
  'd2000000-0000-4000-8000-000000000001'::uuid,
  'd2000000-0000-4000-8000-000000000002'::uuid
);

UPDATE public.patients
SET nascimento = CASE id
      WHEN 'd2200000-0000-4000-8000-000000000001'::uuid THEN DATE '1985-03-15'
      ELSE DATE '1990-07-20'
    END
WHERE id IN (
  'd2200000-0000-4000-8000-000000000001'::uuid,
  'd2200000-0000-4000-8000-000000000002'::uuid
);