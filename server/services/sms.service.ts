export type SmsResult = { success: boolean; messageId?: string; skipped?: boolean; error?: string };

function normalizeIndianPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export async function sendSms(phone: string, message: string): Promise<SmsResult> {
  const provider = (process.env.SMS_PROVIDER || "mock").toLowerCase();
  const to = normalizeIndianPhone(phone);

  if (!to || to.length < 10) return { success: false, error: "Invalid phone number" };

  if (provider === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID?.trim();
    const token = process.env.TWILIO_AUTH_TOKEN?.trim();
    const from = process.env.TWILIO_SMS_FROM?.trim();
    if (!sid || !token || !from) return { success: false, error: "Twilio SMS env vars are missing" };

    const auth = Buffer.from(`${sid}:${token}`).toString("base64");
    const params = new URLSearchParams();
    params.set("To", to.startsWith("+") ? to : `+${to}`);
    params.set("From", from);
    params.set("Body", message.slice(0, 700));

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });
    const data = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
    if (!res.ok) return { success: false, error: data.message || `Twilio ${res.status}` };
    return { success: true, messageId: data.sid };
  }

  if (provider === "msg91") {
    const key = process.env.MSG91_AUTH_KEY?.trim();
    const templateId = process.env.MSG91_TEMPLATE_ID?.trim();
    if (!key || !templateId) return { success: false, error: "MSG91 env vars are missing" };

    const res = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: { authkey: key, "Content-Type": "application/json" },
      body: JSON.stringify({
        template_id: templateId,
        short_url: "1",
        recipients: [{ mobiles: to, message }],
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { request_id?: string; message?: string };
    if (!res.ok) return { success: false, error: data.message || `MSG91 ${res.status}` };
    return { success: true, messageId: data.request_id };
  }

  console.log(`[sms] (mock) to=${to}: ${message}`);
  return { success: true, skipped: true };
}
