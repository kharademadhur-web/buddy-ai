/**
 * WhatsApp Service
 * Mock implementation for sending WhatsApp messages
 * Ready for integration with Twilio WhatsApp Business API or Meta Business API
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
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string
): Promise<WhatsAppResponse> {
  try {
    // Validate phone number format
    if (!isValidPhoneNumber(phoneNumber)) {
      return {
        success: false,
        error: "Invalid phone number format",
        timestamp: new Date(),
      };
    }

    // Log the message (mock implementation)
    console.log("🚀 [WhatsApp Mock] Sending message:");
    console.log(`   To: ${phoneNumber}`);
    console.log(`   Message: ${message}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);

    // TODO: Replace with actual Twilio implementation
    // const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    // const response = await client.messages.create({
    //   from: "whatsapp:+1234567890",
    //   to: `whatsapp:${phoneNumber}`,
    //   body: message,
    // });

    // Mock success response
    const messageId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      messageId,
      status: "sent",
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

    console.log("🚀 [WhatsApp Mock] Sending templated message:");
    console.log(`   To: ${phoneNumber}`);
    console.log(`   Template: ${templateName}`);
    console.log(`   Message: ${message}`);
    console.log(`   Timestamp: ${new Date().toISOString()}`);

    // TODO: Replace with actual Twilio template API
    // const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
    // const response = await client.messages.create({
    //   from: "whatsapp:+1234567890",
    //   to: `whatsapp:${phoneNumber}`,
    //   contentSid: TEMPLATE_ID,
    //   contentVariables: JSON.stringify(variables),
    // });

    const messageId = `wh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    return {
      success: true,
      messageId,
      status: "sent",
      timestamp: new Date(),
    };
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
