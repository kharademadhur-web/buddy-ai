/**
 * Daily (or on-demand) job: remind clinics whose SaaS subscription is expiring soon or is payment_due.
 * Run via cron, e.g. `0 9 * * * cd /app && pnpm subscription:reminders`
 *
 * Requires: Supabase env, optional Twilio/Meta WhatsApp for delivery.
 */
import "dotenv/config";
import { getSupabaseClient } from "../config/supabase";
import { sendWhatsAppMessage, formatPhoneNumberForWhatsApp } from "../services/whatsapp.service";

const DAYS_AHEAD = Math.max(1, parseInt(process.env.SUBSCRIPTION_REMINDER_DAYS || "7", 10) || 7);

async function main() {
  const supabase = getSupabaseClient();
  const now = new Date();
  const horizon = new Date(now.getTime() + DAYS_AHEAD * 86400000);

  const { data: expiring, error: e1 } = await supabase
    .from("clinics")
    .select("id, name, clinic_code, phone, subscription_status, subscription_expires_at")
    .eq("subscription_status", "live")
    .not("subscription_expires_at", "is", null)
    .lte("subscription_expires_at", horizon.toISOString())
    .gte("subscription_expires_at", now.toISOString());

  if (e1) {
    console.error("[subscription-reminders] query expiring:", e1.message);
    process.exit(1);
  }

  const { data: due, error: e2 } = await supabase
    .from("clinics")
    .select("id, name, clinic_code, phone, subscription_status, subscription_expires_at")
    .eq("subscription_status", "payment_due");

  if (e2) {
    console.error("[subscription-reminders] query payment_due:", e2.message);
    process.exit(1);
  }

  const seen = new Set<string>();
  const rows = [...(expiring || []), ...(due || [])].filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });

  const baseUrl = (process.env.PUBLIC_URL || process.env.ADMIN_URL || "").replace(/\/$/, "");
  const billingPath = "/admin-dashboard/billing";
  const link = baseUrl ? `${baseUrl}${billingPath}` : billingPath;

  let sent = 0;
  let skipped = 0;

  for (const clinic of rows) {
    const { data: admins } = await supabase
      .from("users")
      .select("phone, name")
      .eq("clinic_id", clinic.id)
      .eq("role", "clinic-admin")
      .limit(3);

    const phoneRaw =
      (admins && admins[0]?.phone) ||
      (clinic as { phone?: string | null }).phone ||
      null;

    if (!phoneRaw) {
      console.warn(`[subscription-reminders] no phone for clinic ${clinic.name} (${clinic.clinic_code})`);
      skipped++;
      continue;
    }

    const phone = formatPhoneNumberForWhatsApp(phoneRaw);
    const exp = (clinic as { subscription_expires_at?: string }).subscription_expires_at;
    const expStr = exp
      ? new Date(exp).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
      : "soon";

    const msg = `SmartClinic: Your subscription for "${clinic.name}" needs attention (expiry ${expStr}, status: ${(clinic as { subscription_status?: string }).subscription_status}). Renew here: ${link}`;

    const res = await sendWhatsAppMessage(phone, msg);
    if (res.success) {
      sent++;
      console.log(`[subscription-reminders] sent to ${phone} (${clinic.clinic_code})`);
    } else {
      console.warn(`[subscription-reminders] failed ${clinic.clinic_code}: ${res.error || "unknown"}`);
      skipped++;
    }
  }

  console.log(`[subscription-reminders] done clinics=${rows.length} sent=${sent} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
