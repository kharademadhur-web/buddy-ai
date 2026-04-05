/**
 * Notification Service
 * Handles sending notifications via SMS, Email, and WhatsApp
 * Currently uses mock/placeholder implementation for testing
 */

export type NotificationMethod = "sms" | "email" | "whatsapp";

interface NotificationPayload {
  recipient: string;
  method: NotificationMethod;
  type: "otp" | "password_reset" | "credentials" | "account_unlock";
  data: Record<string, any>;
}

interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send OTP via SMS, Email, or WhatsApp
 */
export async function sendOTP(
  userId: string,
  recipient: string,
  otp: string,
  method: NotificationMethod = "sms"
): Promise<NotificationResult> {
  const payload: NotificationPayload = {
    recipient,
    method,
    type: "otp",
    data: { userId, otp },
  };

  return sendNotification(payload);
}

/**
 * Send password reset link
 */
export async function sendPasswordReset(
  userId: string,
  recipient: string,
  resetLink: string,
  method: NotificationMethod = "email"
): Promise<NotificationResult> {
  const payload: NotificationPayload = {
    recipient,
    method,
    type: "password_reset",
    data: { userId, resetLink, expiresIn: "1 hour" },
  };

  return sendNotification(payload);
}

/**
 * Send user credentials (User ID and temporary password)
 */
export async function sendCredentials(
  userId: string,
  recipient: string,
  temporaryPassword: string,
  method: NotificationMethod = "sms"
): Promise<NotificationResult> {
  const payload: NotificationPayload = {
    recipient,
    method,
    type: "credentials",
    data: { userId, temporaryPassword },
  };

  return sendNotification(payload);
}

/**
 * Send account unlock notification
 */
export async function sendAccountUnlock(
  userId: string,
  recipient: string,
  method: NotificationMethod = "sms"
): Promise<NotificationResult> {
  const payload: NotificationPayload = {
    recipient,
    method,
    type: "account_unlock",
    data: { userId },
  };

  return sendNotification(payload);
}

/**
 * Internal function to send notifications
 * This is a placeholder that can be extended with actual SMS/Email providers
 * Configure with environment variables for real providers:
 * - SMS: Twilio, AWS SNS, or similar
 * - Email: SendGrid, AWS SES, or similar
 * - WhatsApp: Twilio WhatsApp API or similar
 */
async function sendNotification(
  payload: NotificationPayload
): Promise<NotificationResult> {
  try {
    const { method, recipient, type, data } = payload;

    // Placeholder implementation - replace with actual provider
    console.log(`[${method.toUpperCase()}] Sending ${type} notification:`, {
      recipient,
      data,
    });

    // Mock success response
    return {
      success: true,
      messageId: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    };

    // Real implementations would look like:
    // if (method === "sms") {
    //   return await sendSMS(recipient, constructMessage(type, data));
    // } else if (method === "email") {
    //   return await sendEmail(recipient, constructEmailBody(type, data));
    // } else if (method === "whatsapp") {
    //   return await sendWhatsApp(recipient, constructMessage(type, data));
    // }
  } catch (error) {
    console.error("Error sending notification:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
}

/**
 * Construct message based on notification type
 */
function constructMessage(type: string, data: Record<string, any>): string {
  switch (type) {
    case "otp":
      return `Your OTP is: ${data.otp}. Valid for 5 minutes. Do not share this with anyone.`;
    case "credentials":
      return `Your User ID is: ${data.userId}\nTemporary Password: ${data.temporaryPassword}\nPlease change your password after first login.`;
    case "account_unlock":
      return `Your account has been unlocked. You can now log in.`;
    case "password_reset":
      return `Click the link to reset your password: ${data.resetLink}\nThis link is valid for ${data.expiresIn}.`;
    default:
      return "You have a new notification.";
  }
}

/**
 * Construct email body
 */
function constructEmailBody(
  type: string,
  data: Record<string, any>
): { subject: string; body: string } {
  switch (type) {
    case "otp":
      return {
        subject: "Your OTP Code",
        body: `<p>Your OTP is: <strong>${data.otp}</strong></p><p>Valid for 5 minutes. Do not share this with anyone.</p>`,
      };
    case "credentials":
      return {
        subject: "Your Account Credentials",
        body: `<p>User ID: <strong>${data.userId}</strong></p><p>Temporary Password: <strong>${data.temporaryPassword}</strong></p><p>Please change your password after first login.</p>`,
      };
    case "account_unlock":
      return {
        subject: "Account Unlocked",
        body: `<p>Your account has been unlocked. You can now log in.</p>`,
      };
    case "password_reset":
      return {
        subject: "Password Reset Request",
        body: `<p><a href="${data.resetLink}">Click here to reset your password</a></p><p>This link is valid for ${data.expiresIn}.</p>`,
      };
    default:
      return {
        subject: "Notification",
        body: "<p>You have a new notification.</p>",
      };
  }
}
