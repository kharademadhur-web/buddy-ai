/**
 * Staff / system email — Resend HTTP API when RESEND_API_KEY is set; otherwise logs only.
 */

export type SendEmailResult = { ok: boolean; id?: string; skipped?: boolean; error?: string };

export async function sendStaffEmail(params: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<SendEmailResult> {
  const { to, subject, text, html } = params;
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "SmartClinic <onboarding@resend.dev>";

  if (!key) {
    console.log(`[email] (no RESEND_API_KEY) to=${to} subject=${subject}\n${text.slice(0, 500)}${text.length > 500 ? "…" : ""}`);
    return { ok: true, skipped: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        text,
        html: html || `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>`,
      }),
    });
    const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      return { ok: false, error: data.message || `Resend ${res.status}` };
    }
    return { ok: true, id: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendStaffEmailToMany(
  recipients: string[],
  params: Omit<Parameters<typeof sendStaffEmail>[0], "to">
): Promise<SendEmailResult[]> {
  const unique = [...new Set(recipients.map((e) => e.trim()).filter(Boolean))];
  const results: SendEmailResult[] = [];
  for (const to of unique) {
    results.push(await sendStaffEmail({ ...params, to }));
  }
  return results;
}
