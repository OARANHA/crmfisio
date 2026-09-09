UPDATE public.patient_packages
SET sessoes_usadas = sessoes_totais + 1,
    status = 'esgotado'
WHERE id = '61000000-0000-0000-0000-000000000002';
