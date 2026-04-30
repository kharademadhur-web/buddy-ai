-- ============================================================
-- Migration 026: Notifications, Daily Summaries, Push Subscriptions
-- Run this in Supabase → SQL Editor or supabase db push
-- ============================================================

-- ============================================================
-- 1. notifications table (in-app notification center)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       VARCHAR(100) NOT NULL,
  clinic_id     VARCHAR(100),
  type          VARCHAR(100) NOT NULL,
  title         TEXT         NOT NULL,
  message       TEXT         NOT NULL,
  data          JSONB        NOT NULL DEFAULT '{}',
  is_read       BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  read_at       TIMESTAMPTZ
);

-- Foreign key to users (soft — don't block if user deleted)
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_unread
  ON notifications (user_id, is_read)
  WHERE NOT is_read;

CREATE INDEX IF NOT EXISTS idx_notifications_clinic
  ON notifications (clinic_id, created_at DESC)
  WHERE clinic_id IS NOT NULL;

-- ============================================================
-- 2. daily_summaries table (end-of-day doctor summary)
-- ============================================================
CREATE TABLE IF NOT EXISTS daily_summaries (
  id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id           VARCHAR(100) NOT NULL,
  clinic_id           VARCHAR(100),
  summary_date        DATE         NOT NULL,
  total_seen          INT          NOT NULL DEFAULT 0,
  total_pending       INT          NOT NULL DEFAULT 0,
  total_prescriptions INT          NOT NULL DEFAULT 0,
  revenue             NUMERIC(12,2)         DEFAULT 0,
  closed_at           TIMESTAMPTZ,
  notes               TEXT,
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (doctor_id, summary_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_doctor
  ON daily_summaries (doctor_id, summary_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_summaries_clinic
  ON daily_summaries (clinic_id, summary_date DESC)
  WHERE clinic_id IS NOT NULL;

-- ============================================================
-- 3. push_subscriptions table (Web Push / PWA VAPID)
-- ============================================================
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    VARCHAR(100) NOT NULL,
  endpoint   TEXT         NOT NULL,
  p256dh     TEXT         NOT NULL,
  auth_key   TEXT         NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, endpoint)
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON push_subscriptions (user_id);

-- ============================================================
-- 4. Enable RLS on all new tables
-- ============================================================
ALTER TABLE notifications        ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summaries      ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_subscriptions   ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. RLS policies (server uses service_role which bypasses RLS;
--    these policies protect the anon/authenticated PostgREST paths)
-- ============================================================

-- Notifications: users can only see/update their own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications'
      AND policyname = 'notifications_own_user'
  ) THEN
    CREATE POLICY notifications_own_user ON notifications
      FOR ALL
      USING (user_id = current_setting('app.user_id', true));
  END IF;
END$$;

-- Daily summaries: doctor can see own; clinic-admin can see clinic
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'daily_summaries'
      AND policyname = 'daily_summaries_own_doctor'
  ) THEN
    CREATE POLICY daily_summaries_own_doctor ON daily_summaries
      FOR ALL
      USING (doctor_id = current_setting('app.user_id', true));
  END IF;
END$$;

-- Push subscriptions: users manage their own
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions'
      AND policyname = 'push_subscriptions_own_user'
  ) THEN
    CREATE POLICY push_subscriptions_own_user ON push_subscriptions
      FOR ALL
      USING (user_id = current_setting('app.user_id', true));
  END IF;
END$$;

-- ============================================================
-- 6. consultations: add ai_summary and report_url columns if missing
-- ============================================================
ALTER TABLE consultations
  ADD COLUMN IF NOT EXISTS ai_summary        TEXT,
  ADD COLUMN IF NOT EXISTS report_url        TEXT,
  ADD COLUMN IF NOT EXISTS report_url_expiry TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS started_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ended_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS day_closed        BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================================
-- 7. users: doctor_status column (availability toggle)
-- ============================================================
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS doctor_status VARCHAR(20) DEFAULT 'available'
  CHECK (doctor_status IN ('available', 'on_break', 'done'));

-- ============================================================
-- 8. Storage bucket for patient reports
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('patient-reports', 'patient-reports', false)
ON CONFLICT (id) DO NOTHING;
