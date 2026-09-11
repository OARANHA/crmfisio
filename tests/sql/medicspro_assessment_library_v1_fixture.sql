CREATE TABLE public.assessment_templates (
  id uuid PRIMARY KEY, clinic_id uuid NULL, owner_type text NOT NULL CHECK (owner_type IN ('platform','clinic')),
  name text NOT NULL, description text, specialty text, status text NOT NULL CHECK (status IN ('draft','active','archived')),
  created_by uuid NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT assessment_templates_owner_scope CHECK ((owner_type='platform' AND clinic_id IS NULL) OR (owner_type='clinic' AND clinic_id IS NOT NULL))
);
CREATE TABLE public.assessment_template_versions (
 id uuid PRIMARY KEY, template_id uuid NOT NULL REFERENCES public.assessment_templates(id) ON DELETE RESTRICT,
 version integer NOT NULL CHECK (version > 0), schema jsonb NOT NULL DEFAULT '{}'::jsonb,
 published_at timestamptz, published_by uuid NULL, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(template_id,version)
);
