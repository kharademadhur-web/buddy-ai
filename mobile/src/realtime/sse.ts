import { getApiBaseUrl } from "../api/client";
import { getAccessToken, getUser } from "../auth/storage";

/**
 * Minimal SSE client for React Native using fetch() streaming.
 * Works in modern runtimes; if your environment lacks streaming,
 * we can swap to a polling fallback.
 */
export async function subscribeClinicEvents(params: {
  onEvent: (eventName: string, data: any) => void;
  onError?: (err: unknown) => void;
  signal?: AbortSignal;
}) {
  const user = await getUser();
  const token = await getAccessToken();
  if (!user?.clinic_id) throw new Error("Missing clinic_id");
  if (!token) throw new Error("Missing access token");

  const base = getApiBaseUrl().replace(/\/+$/, "");
  const url = `${base}/api/realtime/clinic/${encodeURIComponent(user.clinic_id)}/events`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "text/event-stream",
      Authorization: `Bearer ${token}`,
    },
    signal: params.signal,
  });

  if (!res.ok || !res.body) {
    throw new Error(`SSE failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  const emit = (raw: string) => {
    // Parse one SSE message block
    const lines = raw.split("\n");
    let eventName = "message";
    let dataStr = "";
    for (const line of lines) {
      if (line.startsWith("event:")) eventName = line.slice("event:".length).trim();
      if (line.startsWith("data:")) dataStr += line.slice("data:".length).trim();
    }
    try {
      const data = dataStr ? JSON.parse(dataStr) : null;
      params.onEvent(eventName, data);
    } catch {
      params.onEvent(eventName, dataStr);
    }
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) !== -1) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (chunk.trim()) emit(chunk);
      }
    }
  } catch (e) {
    params.onError?.(e);
    throw e;
  } finally {
    try {
      reader.releaseLock();
    } catch {}
  }
}

