\set ON_ERROR_STOP on

-- Base tenant/auth fixture used by Clinic Configuration Core.
\ir clinic_configuration_core_fixture.sql

CREATE TABLE public.clinical_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id uuid NOT NULL REFERENCES public.clinics(id),
  document_type text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON TABLE public.clinical_documents TO authenticated;
GRANT ALL ON TABLE public.clinical_documents TO service_role;
