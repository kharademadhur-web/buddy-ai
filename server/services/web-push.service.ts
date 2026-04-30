import webpush from "web-push";
import { getSupabaseClient } from "../config/supabase";

let configured = false;

function configureWebPush(): boolean {
  const publicKey = process.env.VITE_VAPID_PUBLIC_KEY?.trim() || process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim() || `mailto:${process.env.RESEND_FROM_EMAIL || "support@smartclinic.local"}`;
  if (!publicKey || !privateKey) return false;
  if (!configured) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configured = true;
  }
  return true;
}

export async function sendWebPushToUser(
  userId: string,
  payload: { title: string; message: string; data?: Record<string, unknown> }
): Promise<void> {
  if (!configureWebPush()) return;

  const supabase = getSupabaseClient();
  const { data: subs } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth_key")
    .eq("user_id", userId);

  for (const sub of subs || []) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth_key },
        },
        JSON.stringify(payload)
      );
    } catch (e) {
      const statusCode = (e as { statusCode?: number }).statusCode;
      if (statusCode === 404 || statusCode === 410) {
        await supabase.from("push_subscriptions").delete().eq("id", sub.id);
      } else {
        console.warn("[web-push] send failed:", e);
      }
    }
  }
}
