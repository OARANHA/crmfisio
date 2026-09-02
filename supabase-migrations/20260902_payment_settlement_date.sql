-- MEDICSPRO — data efetiva de liquidação dos lançamentos financeiros
BEGIN;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

COMMENT ON COLUMN public.payments.paid_at IS
  'Instante da primeira transição do lançamento para pago; registros históricos usam updated_at como aproximação.';

CREATE OR REPLACE FUNCTION public.set_payment_paid_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.paid_at := CASE WHEN NEW.status = 'pago' THEN now() ELSE NULL END;
  ELSIF NEW.status = 'pago' AND OLD.status IS DISTINCT FROM 'pago' THEN
    NEW.paid_at := now();
  ELSIF NEW.status IS DISTINCT FROM 'pago' THEN
    NEW.paid_at := NULL;
  ELSE
    NEW.paid_at := OLD.paid_at;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.set_payment_paid_at() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_set_payment_paid_at ON public.payments;
CREATE TRIGGER trg_set_payment_paid_at
BEFORE INSERT OR UPDATE OF status, paid_at ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.set_payment_paid_at();

-- Para baixas anteriores à migration, updated_at é a melhor referência disponível.
UPDATE public.payments
SET paid_at = COALESCE(updated_at, created_at)
WHERE status = 'pago'
  AND paid_at IS NULL;

CREATE INDEX IF NOT EXISTS payments_clinic_paid_at_idx
  ON public.payments (clinic_id, paid_at DESC)
  WHERE status = 'pago';

COMMIT;
