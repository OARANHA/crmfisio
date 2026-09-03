BEGIN;

-- Explicitly require an active authenticated profile for direct guardian access.
DROP POLICY IF EXISTS patient_guardians_select_tenant ON public.patient_guardians;
CREATE POLICY patient_guardians_select_tenant ON public.patient_guardians
FOR SELECT TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid()
      AND p.ativo = true
      AND p.clinic_id = patient_guardians.clinic_id
  )
);

DROP POLICY IF EXISTS patient_guardians_insert_tenant ON public.patient_guardians;
CREATE POLICY patient_guardians_insert_tenant ON public.patient_guardians
FOR INSERT TO authenticated
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'fisio', 'recep')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true AND p.clinic_id = patient_guardians.clinic_id
  )
  AND EXISTS (
    SELECT 1 FROM public.patients pt
    WHERE pt.id = patient_guardians.patient_id
      AND pt.clinic_id = patient_guardians.clinic_id
      AND pt.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS patient_guardians_update_tenant ON public.patient_guardians;
CREATE POLICY patient_guardians_update_tenant ON public.patient_guardians
FOR UPDATE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'fisio', 'recep')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true AND p.clinic_id = patient_guardians.clinic_id
  )
)
WITH CHECK (
  clinic_id = public.current_clinic_id()
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true AND p.clinic_id = patient_guardians.clinic_id
  )
  AND EXISTS (
    SELECT 1 FROM public.patients pt
    WHERE pt.id = patient_guardians.patient_id
      AND pt.clinic_id = patient_guardians.clinic_id
      AND pt.deleted_at IS NULL
  )
);

DROP POLICY IF EXISTS patient_guardians_delete_tenant ON public.patient_guardians;
CREATE POLICY patient_guardians_delete_tenant ON public.patient_guardians
FOR DELETE TO authenticated
USING (
  clinic_id = public.current_clinic_id()
  AND public.current_app_role() IN ('owner', 'admin', 'recep')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true AND p.clinic_id = patient_guardians.clinic_id
  )
);

-- Storage also denies stale/inactive authenticated sessions.
DROP POLICY IF EXISTS patient_avatars_select_tenant ON storage.objects;
CREATE POLICY patient_avatars_select_tenant ON storage.objects
FOR SELECT TO authenticated
USING (
  bucket_id = 'patient-avatars'
  AND (storage.foldername(name))[1] = public.current_clinic_id()::text
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true AND p.clinic_id = public.current_clinic_id()
  )
);

DROP POLICY IF EXISTS patient_avatars_insert_tenant ON storage.objects;
CREATE POLICY patient_avatars_insert_tenant ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'patient-avatars'
  AND (storage.foldername(name))[1] = public.current_clinic_id()::text
  AND public.current_app_role() IN ('owner', 'admin', 'fisio', 'recep')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true AND p.clinic_id = public.current_clinic_id()
  )
);

DROP POLICY IF EXISTS patient_avatars_update_tenant ON storage.objects;
CREATE POLICY patient_avatars_update_tenant ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'patient-avatars'
  AND (storage.foldername(name))[1] = public.current_clinic_id()::text
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true AND p.clinic_id = public.current_clinic_id()
  )
)
WITH CHECK (
  bucket_id = 'patient-avatars'
  AND (storage.foldername(name))[1] = public.current_clinic_id()::text
  AND public.current_app_role() IN ('owner', 'admin', 'fisio', 'recep')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true AND p.clinic_id = public.current_clinic_id()
  )
);

DROP POLICY IF EXISTS patient_avatars_delete_tenant ON storage.objects;
CREATE POLICY patient_avatars_delete_tenant ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'patient-avatars'
  AND (storage.foldername(name))[1] = public.current_clinic_id()::text
  AND public.current_app_role() IN ('owner', 'admin', 'recep')
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.ativo = true AND p.clinic_id = public.current_clinic_id()
  )
);

-- Audit guardian changes without copying CPF/phone/e-mail into audit details.
CREATE OR REPLACE FUNCTION public.audit_patient_guardian_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row public.patient_guardians%ROWTYPE;
BEGIN
  v_row := CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;

  INSERT INTO public.audit_log (clinic_id, usuario_id, acao, detalhe)
  VALUES (
    v_row.clinic_id,
    auth.uid(),
    TG_OP || ' patient_guardians',
    jsonb_build_object(
      'guardian_id', v_row.id,
      'patient_id', v_row.patient_id,
      'relationship', v_row.relationship,
      'is_legal_guardian', v_row.is_legal_guardian,
      'is_financial_responsible', v_row.is_financial_responsible,
      'is_primary_contact', v_row.is_primary_contact
    )::text
  );

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS audit_patient_guardian_change ON public.patient_guardians;
CREATE TRIGGER audit_patient_guardian_change
AFTER INSERT OR UPDATE OR DELETE ON public.patient_guardians
FOR EACH ROW EXECUTE FUNCTION public.audit_patient_guardian_change();

-- Safe capability/status view for owner/admin UI. Never exposes storage credentials.
CREATE OR REPLACE FUNCTION public.get_medicspro_storage_status()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_bucket storage.buckets%ROWTYPE;
  v_count BIGINT;
BEGIN
  SELECT * INTO v_profile
  FROM public.profiles
  WHERE id = auth.uid() AND ativo = true;

  IF v_profile.id IS NULL OR v_profile.role NOT IN ('owner', 'admin') THEN
    RAISE EXCEPTION 'Sem permissão para consultar armazenamento';
  END IF;

  SELECT * INTO v_bucket
  FROM storage.buckets
  WHERE id = 'patient-avatars';

  SELECT count(*) INTO v_count
  FROM storage.objects
  WHERE bucket_id = 'patient-avatars'
    AND (storage.foldername(name))[1] = v_profile.clinic_id::text;

  RETURN jsonb_build_object(
    'provider', 'supabase-storage',
    'managed_by_platform', true,
    'patient_avatars_enabled', v_bucket.id IS NOT NULL,
    'patient_avatars_private', COALESCE(NOT v_bucket.public, false),
    'file_size_limit', v_bucket.file_size_limit,
    'allowed_mime_types', to_jsonb(v_bucket.allowed_mime_types),
    'clinic_avatar_objects', v_count
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_medicspro_storage_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_medicspro_storage_status() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_medicspro_storage_status() TO authenticated;

COMMIT;
