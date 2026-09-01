BEGIN;

CREATE TABLE IF NOT EXISTS public.units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  endereco TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES public.clinics(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES public.units(id) ON DELETE RESTRICT,
  nome TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'sala' CHECK (tipo IN ('sala','equipamento')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_units_clinic_active ON public.units(clinic_id, ativo);
CREATE INDEX IF NOT EXISTS idx_rooms_clinic_unit_active ON public.rooms(clinic_id, unit_id, ativo);

ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS units_select_tenant ON public.units;
CREATE POLICY units_select_tenant ON public.units
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

DROP POLICY IF EXISTS units_insert_admin ON public.units;
CREATE POLICY units_insert_admin ON public.units
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin')
);

DROP POLICY IF EXISTS units_update_admin ON public.units;
CREATE POLICY units_update_admin ON public.units
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin')
);

DROP POLICY IF EXISTS rooms_select_tenant ON public.rooms;
CREATE POLICY rooms_select_tenant ON public.rooms
FOR SELECT TO authenticated
USING (clinic_id = public.current_clinic_id());

DROP POLICY IF EXISTS rooms_insert_admin ON public.rooms;
CREATE POLICY rooms_insert_admin ON public.rooms
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin')
  AND EXISTS (
    SELECT 1 FROM public.units u
    WHERE u.id = unit_id
      AND u.clinic_id = public.current_clinic_id()
      AND u.ativo = true
  )
);

DROP POLICY IF EXISTS rooms_update_admin ON public.rooms;
CREATE POLICY rooms_update_admin ON public.rooms
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin')
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner','admin')
  AND EXISTS (
    SELECT 1 FROM public.units u
    WHERE u.id = unit_id
      AND u.clinic_id = public.current_clinic_id()
  )
);

GRANT SELECT, INSERT, UPDATE ON public.units TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rooms TO authenticated;

-- Vincula appointments.room_id a salas reais sem quebrar instalações antigas.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'appointments_room_id_fkey'
      AND conrelid = 'public.appointments'::regclass
  ) THEN
    ALTER TABLE public.appointments
      ADD CONSTRAINT appointments_room_id_fkey
      FOREIGN KEY (room_id) REFERENCES public.rooms(id) NOT VALID;
  END IF;
END $$;

COMMIT;
