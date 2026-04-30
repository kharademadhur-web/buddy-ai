/**
 * App-wide in-app notification service.
 * Stores notifications in Supabase and pushes them via SSE to connected clients.
 */
import { getSupabaseClient } from "../config/supabase";
import { EventEmitter } from "events";
import { sendWebPushToUser } from "./web-push.service";

export type NotificationType =
  | "patient_checked_in"
  | "patient_next_in_queue"
  | "prescription_saved"
  | "report_uploaded"
  | "end_of_day_reminder"
  | "follow_up_due"
  | "consultation_completed"
  | "payment_received"
  | "follow_up_booked"
  | "new_patient_registered"
  | "subscription_expiry"
  | "staff_slot_request"
  | "staff_slot_approved"
  | "staff_slot_rejected"
  | "staff_created"
  | "day_closed"
  | "device_approved"
  | "general";

export interface CreateNotificationInput {
  userId: string;
  clinicId?: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, unknown>;
}

// In-memory SSE emitter per user
const userEmitter = new EventEmitter();
userEmitter.setMaxListeners(500);

function userChannel(userId: string) {
  return `user:${userId}`;
}

/**
 * Create and persist a notification, then push it to any connected SSE stream.
 */
export async function createNotification(input: CreateNotificationInput): Promise<void> {
  const supabase = getSupabaseClient();

  let id: string | undefined;

  try {
    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id: input.userId,
        clinic_id: input.clinicId ?? null,
        type: input.type,
        title: input.title,
        message: input.message,
        data: input.data ?? {},
      })
      .select("id")
      .single();

    if (error) {
      console.warn("[notifications] insert failed:", error.message);
    } else {
      id = data?.id;
    }
  } catch (e) {
    console.warn("[notifications] createNotification error:", e);
  }

  // Push to any connected SSE stream (non-blocking)
  const payload = {
    id,
    type: input.type,
    title: input.title,
    message: input.message,
    data: input.data ?? {},
    createdAt: new Date().toISOString(),
    isRead: false,
  };
  userEmitter.emit(userChannel(input.userId), payload);
  void sendWebPushToUser(input.userId, {
    title: input.title,
    message: input.message,
    data: input.data,
  });
}

/**
 * Subscribe a user's SSE response to notifications.
 * Returns an unsubscribe function.
 */
export function subscribeUserNotifications(
  userId: string,
  listener: (notification: Record<string, unknown>) => void
): () => void {
  const ch = userChannel(userId);
  userEmitter.on(ch, listener);
  return () => userEmitter.off(ch, listener);
}

/**
 * Bulk-notify multiple users (e.g. all doctors in a clinic).
 */
export async function notifyMultiple(
  userIds: string[],
  input: Omit<CreateNotificationInput, "userId">
): Promise<void> {
  await Promise.all(userIds.map((uid) => createNotification({ ...input, userId: uid })));
}
