const STARTUP_FETCH_MS = 15_000;

/**
 * Lightweight Supabase reachability + credential checks at startup (Azure / production).
 * Fails fast with a thrown Error if Supabase is unreachable (no silent failures).
 */
export async function verifySupabaseOnStartup(): Promise<void> {
  const base = (
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    ""
  ).replace(/\/$/, "");
  const serviceKey = process.env.SUPABASE_SERVICE_KEY?.trim();

  if (!base || !serviceKey) {
    throw new Error("SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_KEY are required for startup check");
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), STARTUP_FETCH_MS);

  try {
    const authHealth = await fetch(`${base}/auth/v1/health`, {
      method: "GET",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      signal: ctrl.signal,
    });
    if (!authHealth.ok) {
      throw new Error(`Supabase Auth health failed: HTTP ${authHealth.status}`);
    }

    const rest = await fetch(`${base}/rest/v1/`, {
      method: "GET",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Accept: "application/json",
      },
      signal: ctrl.signal,
    });

    const okRest =
      rest.status === 200 ||
      rest.status === 404 ||
      rest.status === 406; /* PostgREST Accept negotiation on some configs */
    if (!okRest) {
      throw new Error(
        `Supabase REST check failed: HTTP ${rest.status} (verify SUPABASE_SERVICE_KEY and project URL)`
      );
    }

    console.log("[supabase] Startup check passed (Auth + REST reachable with service role)");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("abort") || msg === "The operation was aborted.") {
      throw new Error(
        `Supabase startup check timed out after ${STARTUP_FETCH_MS}ms (network or URL misconfigured)`
      );
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
