-- Reminder worker marks when a WhatsApp reminder was sent (due-date - 1 day pattern in API).
ALTER TABLE followups
  ADD COLUMN IF NOT EXISTS whatsapp_reminder_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN followups.whatsapp_reminder_sent_at IS 'Set when automated WhatsApp reminder was sent before due_date';
