-- Enforce clinic SaaS expiry transitions at DB layer.
-- 1) Row-level trigger: prevents storing "live" when already expired.
-- 2) Batch function: can be called by cron/job to flip all expired live clinics.

CREATE OR REPLACE FUNCTION set_payment_due_when_expired()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.subscription_status = 'live'
     AND NEW.subscription_expires_at IS NOT NULL
     AND NEW.subscription_expires_at < now() THEN
    NEW.subscription_status := 'payment_due';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clinics_status_expiry_enforce ON clinics;
CREATE TRIGGER trg_clinics_status_expiry_enforce
BEFORE INSERT OR UPDATE OF subscription_status, subscription_expires_at
ON clinics
FOR EACH ROW
EXECUTE FUNCTION set_payment_due_when_expired();

CREATE OR REPLACE FUNCTION sync_expired_clinics_to_payment_due()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_count integer := 0;
BEGIN
  UPDATE clinics
  SET subscription_status = 'payment_due',
      updated_at = now()
  WHERE subscription_status = 'live'
    AND subscription_expires_at IS NOT NULL
    AND subscription_expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION sync_expired_clinics_to_payment_due()
IS 'Flips expired live clinics to payment_due for SaaS access control.';

