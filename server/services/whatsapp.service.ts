/**
 * WhatsApp outbound
 * - Twilio WhatsApp: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_WHATSAPP_FROM (e.g. whatsapp:+14155238886)
 * - Twilio approved templates (Content API): pass options.twilioContent { contentSid, variables } to sendWhatsAppMessage,
 *   or set TWILIO_FOLLOWUP_CONTENT_SID + use follow-up notifications (variables {"1","2"} configurable).
 * - Meta Cloud API: WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID (optional WHATSAPP_API_VERSION default v21.0)
 * - Otherwise: mock (logs only)
 */

interface WhatsAppMessage {
  to: string;
  message: string;
  templateName?: string;
  variables?: Record<string, string>;
}

interface WhatsAppResponse {
  success: boolean;
  messageId?: string;
  status?: string;
  error?: string;
  timestamp: Date;
}

/**
 * Send a WhatsApp message (mock implementation)
 * 
 * In production, this would integrate with:
 * - Twilio WhatsApp Business API: https://www.twilio.com/whatsapp
 * - Meta (Facebook) Business API: https://developers.facebook.com/docs/whatsapp
 * - Custom WhatsApp webhook handler
 * 
 * @param phoneNumber - Recipient phone number (format: +91XXXXXXXXXX for India)
 * @param message - Message text to send
 * @returns Promise with response status
 */
type TwilioSendPayload =
  | { mode: "body"; body: string }
  | { mode: "content"; contentSid: string; contentVariables: Record<string, string> };

async function sendViaTwilio(toE164: string, payload: TwilioSendPayload): Promise<{ ok: boolean; id?: string; err?: string }> {
  const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const token = process.env.TWILIO_AUTH_TOKEN?.trim();
  const from = process.env.TWILIO_WHATSAPP_FROM?.trim();
  if (!sid || !token || !from) return { ok: false };

  const to = toE164.startsWith("+") ? `whatsapp:${toE164}` : `whatsapp:+${toE164.replace(/\D/g, "")}`;
  const auth = Buffer.from(`${sid}:${token}`).toString("base64");
  const params = new URLSearchParams();
  params.set("To", to);
  params.set("From", from);
  if (payload.mode === "body") {
    params.set("Body", payload.body);
  } else {
    params.set("ContentSid", payload.contentSid);
    params.set("ContentVariables", JSON.stringify(payload.contentVariables));
  }

  const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
  const data = (await res.json()) as { sid?: string; message?: string };
  if (!res.ok) {
    return { ok: false, err: data.message || `Twilio ${res.status}` };
  }
  return { ok: true, id: data.sid };
}

async function sendViaMetaCloud(toDigits: string, body: string): Promise<{ ok: boolean; id?: string; err?: string }> {
  const graphToken = process.env.WHATSAPP_ACCESS_TOKEN?.trim();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID?.trim();
  const ver = process.env.WHATSAPP_API_VERSION?.trim() || "v21.0";
  if (!graphToken || !phoneId) return { ok: false };

  const res = await fetch(`https://graph.facebook.com/${ver}/${phoneId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${graphToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: toDigits.replace(/\D/g, ""),
      type: "text",
      text: { body: body.slice(0, 4096) },
    }),
  });
  const data = (await res.json()) as { messages?: Array<{ id?: string }>; error?: { message?: string } };
  if (!res.ok) {
    return { ok: false, err: data.error?.message || `Meta ${res.status}` };
  }
  return { ok: true, id: data.messages?.[0]?.id };
}

export type SendWhatsAppOptions = {
  /** Twilio Content API (approved WhatsApp template). Mutually exclusive with plain Body on Twilio. */
  twilioContent?: { contentSid: string; variables: Record<string, string> };
};

export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
  options?: SendWhatsAppOptions
): Promise<WhatsAppResponse> {
  try {
    const e164 = formatPhoneNumberForWhatsApp(phoneNumber);
    if (!e164 || e164.length < 8) {
      return {
        success: false,
        error: "Invalid phone number format",
        timestamp: new Date(),
      };
    }

    const tc = options?.twilioContent;
    const twilio = tc
      ? await sendViaTwilio(e164, {
          mode: "content",
          contentSid: tc.contentSid,
          contentVariables: tc.variables,
        })
      : await sendViaTwilio(e164, { mode: "body", body: message });

    if (twilio.ok) {
      console.log(`[WhatsApp] Twilio sent to ${e164} id=${twilio.id}${tc ? " (ContentSid)" : ""}`);
      return {
        success: true,
        messageId: twilio.id,
        status: "sent",
        timestamp: new Date(),
      };
    }

    if (tc) {
      console.warn(`[WhatsApp] Twilio template send failed: ${twilio.err || "unknown"}`);
      return {
        success: false,
        error: twilio.err || "Twilio template send failed",
        timestamp: new Date(),
      };
    }

    const meta = await sendViaMetaCloud(e164.replace("+", ""), message);
    if (meta.ok) {
      console.log(`[WhatsApp] Meta sent to ${e164} id=${meta.id}`);
      return {
        success: true,
        messageId: meta.id,
        status: "sent",
        timestamp: new Date(),
      };
    }

    console.log("🚀 [WhatsApp Mock] (configure TWILIO_* or WHATSAPP_ACCESS_TOKEN + WHATSAPP_PHONE_NUMBER_ID)");
    console.log(`   To: ${e164}`);
    console.log(`   Message: ${message.slice(0, 200)}${message.length > 200 ? "…" : ""}`);

    const messageId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return {
      success: true,
      messageId,
      status: "mock",
      timestamp: new Date(),
    };
  } catch (error) {
    console.error("WhatsApp send error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send WhatsApp message",
      timestamp: new Date(),
    };
  }
}

/**
 * Send a templated WhatsApp message
 * Useful for follow-up reminders, appointment notifications, etc.
 * 
 * @param phoneNumber - Recipient phone number
 * @param templateName - Name of WhatsApp template (e.g., "appointment_reminder")
 * @param variables - Template variables to substitute
 * @returns Promise with response status
 */
export async function sendWhatsAppTemplate(
  phoneNumber: string,
  templateName: string,
  variables: Record<string, string> = {}
): Promise<WhatsAppResponse> {
  try {
    if (!isValidPhoneNumber(phoneNumber)) {
      return {
        success: false,
        error: "Invalid phone number format",
        timestamp: new Date(),
      };
    }

    // Define available templates
    const templates: Record<string, string> = {
      appointment_reminder: "Hi {{name}}, you have an appointment on {{date}} at {{time}}. Please confirm.",
      follow_up_reminder: "Hi {{name}}, it's time for your follow-up with Dr. {{doctor}}. Please call {{clinic_number}}.",
      payment_reminder: "Hi {{name}}, your subscription expires on {{expiry_date}}. Please renew to continue using our services.",
      kyc_approved: "Congratulations {{name}}! Your KYC has been approved. You can now start using all features.",
      clinic_welcome: "Welcome to {{clinic_name}}! Your account has been created. Use code {{code}} to get started.",
    };

    const template = templates[templateName];
    if (!template) {
      return {
        success: false,
        error: `Template '${templateName}' not found`,
        timestamp: new Date(),
      };
    }

    // Substitute variables in template
    let message = template;
    Object.entries(variables).forEach(([key, value]) => {
      message = message.replace(`{{${key}}}`, value);
    });

    return sendWhatsAppMessage(phoneNumber, message);
  } catch (error) {
    console.error("WhatsApp template send error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to send WhatsApp message",
      timestamp: new Date(),
    };
  }
}

/**
 * Send follow-up reminder via WhatsApp
 * 
 * @param phoneNumber - Patient's phone number
 * @param doctorName - Name of the doctor
 * @param clinicName - Name of the clinic
 * @param appointmentDate - Scheduled follow-up date
 * @returns Promise with response status
 */
export async function sendFollowUpReminder(
  phoneNumber: string,
  doctorName: string,
  clinicName: string,
  appointmentDate: Date
): Promise<WhatsAppResponse> {
  const dateStr = appointmentDate.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const timeStr = appointmentDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const message = `Hello! This is a reminder from ${clinicName}. You have a follow-up appointment with Dr. ${doctorName} on ${dateStr} at ${timeStr}. Please call to confirm. Thank you!`;

  return sendWhatsAppMessage(phoneNumber, message);
}

/**
 * Send appointment confirmation via WhatsApp
 * 
 * @param phoneNumber - Patient's phone number
 * @param patientName - Name of the patient
 * @param doctorName - Name of the doctor
 * @param clinicName - Name of the clinic
 * @param appointmentDate - Appointment date
 * @returns Promise with response status
 */
export async function sendAppointmentConfirmation(
  phoneNumber: string,
  patientName: string,
  doctorName: string,
  clinicName: string,
  appointmentDate: Date
): Promise<WhatsAppResponse> {
  const dateStr = appointmentDate.toLocaleDateString("en-IN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const timeStr = appointmentDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const message = `Hi ${patientName}, your appointment is confirmed with Dr. ${doctorName} at ${clinicName} on ${dateStr} at ${timeStr}. Please arrive 10 minutes early. Thank you!`;

  return sendWhatsAppMessage(phoneNumber, message);
}

/**
 * Send subscription renewal reminder via WhatsApp
 * 
 * @param phoneNumber - Clinic admin's phone number
 * @param clinicName - Name of the clinic
 * @param renewalDate - Subscription renewal date
 * @returns Promise with response status
 */
export async function sendSubscriptionRenewalReminder(
  phoneNumber: string,
  clinicName: string,
  renewalDate: Date
): Promise<WhatsAppResponse> {
  const dateStr = renewalDate.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const message = `Hello! This is a reminder that your subscription for ${clinicName} will expire on ${dateStr}. Please renew to continue using our services. Click here to renew: [Link]`;

  return sendWhatsAppMessage(phoneNumber, message);
}

/**
 * Validate phone number format (India-specific)
 * Expected format: +91XXXXXXXXXX or 91XXXXXXXXXX or XXXXXXXXXX
 * 
 * @param phoneNumber - Phone number to validate
 * @returns Boolean indicating if phone number is valid
 */
function isValidPhoneNumber(phoneNumber: string): boolean {
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, "");

  // Check if it's a 10-digit number (Indian format)
  if (cleaned.length === 10) {
    return /^[6-9]\d{9}$/.test(cleaned);
  }

  // Check if it's a 12-digit number with country code 91 (Indian format)
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return /^91[6-9]\d{9}$/.test(cleaned);
  }

  return false;
}

/**
 * Format phone number to WhatsApp format (+91XXXXXXXXXX)
 * 
 * @param phoneNumber - Phone number in any format
 * @returns Formatted phone number
 */
export function formatPhoneNumberForWhatsApp(phoneNumber: string): string {
  const cleaned = phoneNumber.replace(/\D/g, "");

  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }

  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith("91")) {
    return `+${cleaned}`;
  }

  // Default: assume it's a 10-digit number and add +91
  return `+91${cleaned}`;
}

/**
 * Get WhatsApp webhook handler for receiving messages
 * This would be called by the WhatsApp/Twilio webhook
 * 
 * @param data - Webhook payload from WhatsApp
 * @returns Processed webhook response
 */
export function handleWhatsAppWebhook(data: any): { success: boolean; message?: string } {
  try {
    console.log("🔔 [WhatsApp Webhook] Received message:");
    console.log(JSON.stringify(data, null, 2));

    // TODO: Implement webhook processing
    // - Extract message content
    // - Update follow-up status if message is received
    // - Handle opt-out requests
    // - Log failed deliveries

    return { success: true, message: "Webhook processed" };
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return { success: false, message: "Failed to process webhook" };
  }
}

export default {
  sendWhatsAppMessage,
  sendWhatsAppTemplate,
  sendFollowUpReminder,
  sendAppointmentConfirmation,
  sendSubscriptionRenewalReminder,
  formatPhoneNumberForWhatsApp,
  handleWhatsAppWebhook,
};
