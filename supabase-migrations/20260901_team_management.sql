-- MEDICSPRO — Gestão administrativa da equipe
-- Metadados profissionais, vínculo multiunidade e trilha segura de implantação.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS professional_type text,
  ADD COLUMN IF NOT EXISTS council_type text,
  ADD COLUMN IF NOT EXISTS council_state text,
  ADD COLUMN IF NOT EXISTS especialidade text,
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.profile_units (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  unit_id uuid NOT NULL REFERENCES public.units(id) ON DELETE CASCADE,
  clinic_id uuid NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_profile_units_clinic_profile
  ON public.profile_units (clinic_id, profile_id);

ALTER TABLE public.profile_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profile_units_select_tenant ON public.profile_units;
CREATE POLICY profile_units_select_tenant ON public.profile_units
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

DROP POLICY IF EXISTS profile_units_write_admin ON public.profile_units;
CREATE POLICY profile_units_write_admin ON public.profile_units
FOR ALL TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin')
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_units TO authenticated;

-- A atualização de perfis continua protegida pela policy existente.
-- Criação de auth.users NÃO é feita por SQL nem pelo browser; será feita pela Edge Function admin-team.

COMMIT;
