-- SaaS subscription: plan price, period dates, payment ledger, extended status values.

-- 1) New columns on clinics
ALTER TABLE clinics
  ADD COLUMN IF NOT EXISTS saas_plan_amount_monthly NUMERIC(12, 2) DEFAULT 5999 NOT NULL,
  ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN clinics.saas_plan_amount_monthly IS 'Monthly SaaS fee in INR (base plan)';
COMMENT ON COLUMN clinics.subscription_started_at IS 'When current paid period started';
COMMENT ON COLUMN clinics.subscription_expires_at IS 'End of prepaid access; after this, status should be payment_due';

-- 2) Widen subscription_status allowed values (drop old check, migrate, re-add)
ALTER TABLE clinics DROP CONSTRAINT IF EXISTS clinics_subscription_status_check;

-- Map legacy "active" to "live" (paid / operational)
UPDATE clinics SET subscription_status = 'live' WHERE subscription_status = 'active';

ALTER TABLE clinics
  ADD CONSTRAINT clinics_subscription_status_check
  CHECK (
    subscription_status IN (
      'pending',
      'inactive',
      'live',
      'payment_due',
      'suspended'
    )
  );

-- Backfill: existing live clinics without an end date get a grace window (ops can adjust)
UPDATE clinics
SET subscription_expires_at = COALESCE(
  subscription_expires_at,
  now() + interval '30 days'
)
WHERE subscription_status = 'live'
  AND subscription_expires_at IS NULL;

UPDATE clinics
SET subscription_started_at = COALESCE(subscription_started_at, created_at, now())
WHERE subscription_status = 'live'
  AND subscription_started_at IS NULL;

-- 3) Payment ledger (super-admin recorded advances)
CREATE TABLE IF NOT EXISTS clinic_saas_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id UUID NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'completed' CHECK (status IN ('completed', 'pending')),
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clinic_saas_payments_clinic_id ON clinic_saas_payments(clinic_id);
CREATE INDEX IF NOT EXISTS idx_clinic_saas_payments_paid_at ON clinic_saas_payments(paid_at DESC);

COMMENT ON TABLE clinic_saas_payments IS 'Clinic SaaS subscription payments (advance); source for admin Payment History and MRR';

ALTER TABLE clinic_saas_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinic_saas_payments: service role full access" ON clinic_saas_payments;
CREATE POLICY "clinic_saas_payments: service role full access"
ON clinic_saas_payments
AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "clinic_saas_payments: super admin full access" ON clinic_saas_payments;
CREATE POLICY "clinic_saas_payments: super admin full access"
ON clinic_saas_payments
AS PERMISSIVE FOR ALL TO authenticated
USING (app.is_super_admin())
WITH CHECK (app.is_super_admin());
