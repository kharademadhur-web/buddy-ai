-- ============================================================
-- Migration 027: Payment-gated staff slot requests
-- ============================================================

CREATE TABLE IF NOT EXISTS staff_slot_requests (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  clinic_id           UUID        NOT NULL REFERENCES clinics(id) ON DELETE CASCADE,
  requested_by        UUID        NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  staff_role          TEXT        NOT NULL CHECK (staff_role IN ('doctor', 'receptionist')),
  staff_name          TEXT        NOT NULL,
  staff_email         TEXT        NOT NULL,
  staff_phone         TEXT        NOT NULL,
  payment_status      TEXT        NOT NULL DEFAULT 'pending'
                                      CHECK (payment_status IN ('pending', 'paid', 'failed')),
  approval_status     TEXT        NOT NULL DEFAULT 'awaiting_payment'
                                      CHECK (approval_status IN ('awaiting_payment', 'pending_admin', 'approved', 'rejected')),
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  refund_id           TEXT,
  amount              INTEGER     NOT NULL DEFAULT 250000,
  rejection_reason    TEXT,
  created_user_id     UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_user_login  TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at         TIMESTAMPTZ,
  activated_at        TIMESTAMPTZ,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_slot_requests_positive_amount CHECK (amount > 0),
  CONSTRAINT staff_slot_requests_payment_order_unique UNIQUE (razorpay_order_id),
  CONSTRAINT staff_slot_requests_payment_id_unique UNIQUE (razorpay_payment_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_slot_requests_clinic_created
  ON staff_slot_requests (clinic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_slot_requests_approval_status
  ON staff_slot_requests (approval_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_slot_requests_payment_status
  ON staff_slot_requests (payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_staff_slot_requests_requested_by
  ON staff_slot_requests (requested_by, created_at DESC);

ALTER TABLE staff_slot_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'staff_slot_requests'
      AND policyname = 'staff_slot_requests_clinic_admin_own_clinic'
  ) THEN
    CREATE POLICY staff_slot_requests_clinic_admin_own_clinic
      ON staff_slot_requests
      FOR SELECT
      USING (
        clinic_id::text = current_setting('app.clinic_id', true)
        OR requested_by::text = current_setting('app.user_id', true)
      );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'staff_slot_requests'
      AND policyname = 'staff_slot_requests_super_admin_all'
  ) THEN
    CREATE POLICY staff_slot_requests_super_admin_all
      ON staff_slot_requests
      FOR SELECT
      USING (current_setting('app.role', true) = 'super-admin');
  END IF;
END$$;

CREATE OR REPLACE FUNCTION set_staff_slot_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_slot_requests_updated_at ON staff_slot_requests;
CREATE TRIGGER trg_staff_slot_requests_updated_at
  BEFORE UPDATE ON staff_slot_requests
  FOR EACH ROW
  EXECUTE FUNCTION set_staff_slot_requests_updated_at();
