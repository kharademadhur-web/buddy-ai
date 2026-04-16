import { Router, Request, Response } from "express";
import { z } from "zod";
import { authMiddleware } from "../middleware/auth-jwt.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { sendJsonError } from "../lib/send-json-error";
import { asyncHandler } from "../middleware/error-handler.middleware";
import { MEDICINES_CATALOG } from "../data/medicines-catalog";

const router = Router();

const searchQuerySchema = z.object({
  q: z.string().optional().default(""),
  limit: z.coerce.number().int().min(1).max(80).optional().default(40),
});

type SearchHit = {
  name: string;
  dosage: string;
  frequency: string;
  duration: string;
  source?: "catalog" | "rxnorm" | "google";
};

const DEFAULT_FREQ = "As directed";
const DEFAULT_DUR = "As clinically indicated";

function catalogHits(q: string, limit: number): SearchHit[] {
  const ql = q.trim().toLowerCase();
  let rows = MEDICINES_CATALOG;
  if (ql.length > 0) {
    rows = MEDICINES_CATALOG.filter(
      (m) => m.name.toLowerCase().includes(ql) || m.dosage.toLowerCase().includes(ql)
    );
  }
  return rows.slice(0, limit).map((m) => ({
    name: m.name,
    dosage: m.dosage,
    frequency: m.frequency,
    duration: m.duration,
    source: "catalog" as const,
  }));
}

/** NIH RxNorm — broad public medicine name search (no API key). */
async function rxNormApproximateNames(term: string, maxEntries: number): Promise<string[]> {
  const t = term.trim();
  if (t.length < 2) return [];
  const url = `https://rxnav.nlm.nih.gov/REST/approximateTerm.json?${new URLSearchParams({
    term: t,
    maxEntries: String(Math.min(maxEntries, 50)),
  })}`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return [];
    const j = (await res.json()) as {
      approximateGroup?: { candidate?: Array<{ name?: string }> };
    };
    const raw = j?.approximateGroup?.candidate;
    const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
    const names: string[] = [];
    for (const c of list) {
      const n = c?.name?.trim();
      if (n && n.length > 1) names.push(n);
    }
    return [...new Set(names)];
  } catch {
    return [];
  }
}

/** Optional: Google Programmable Search (set GOOGLE_CUSTOM_SEARCH_API_KEY + GOOGLE_CUSTOM_SEARCH_ENGINE_ID). */
async function googleCustomSearchMedicineTitles(q: string, max: number): Promise<string[]> {
  const key = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY?.trim();
  const cx = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID?.trim();
  if (!key || !cx || q.trim().length < 2) return [];
  try {
    const u = new URL("https://www.googleapis.com/customsearch/v1");
    u.searchParams.set("key", key);
    u.searchParams.set("cx", cx);
    u.searchParams.set("q", `${q.trim()} drug OR medicine`);
    u.searchParams.set("num", String(Math.min(max, 10)));
    const res = await fetch(u.toString(), { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return [];
    const j = (await res.json()) as { items?: Array<{ title?: string }> };
    const titles: string[] = [];
    for (const it of j.items ?? []) {
      const title = (it.title || "").split(/[-|–—]/)[0]?.trim();
      if (title && title.length > 2 && title.length < 200) titles.push(title);
    }
    return [...new Set(titles)];
  } catch {
    return [];
  }
}

function mergeDeduped(
  catalog: SearchHit[],
  extraNames: string[],
  seen: Set<string>,
  limit: number,
  source: "rxnorm" | "google"
): SearchHit[] {
  const out: SearchHit[] = [...catalog];
  for (const name of extraNames) {
    if (out.length >= limit) break;
    const k = name.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push({
      name,
      dosage: "As prescribed",
      frequency: DEFAULT_FREQ,
      duration: DEFAULT_DUR,
      source,
    });
  }
  return out;
}

/**
 * GET /api/medicines/search?q=&limit=
 * Curated catalog + RxNorm (always) + optional Google Custom Search when configured.
 */
router.get(
  "/search",
  authMiddleware,
  requireRole("doctor", "receptionist", "independent", "super-admin"),
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = searchQuerySchema.safeParse(req.query);
    if (!parsed.success) return sendJsonError(res, 400, "Invalid query", "VALIDATION_ERROR");

    const q = parsed.data.q.trim();
    const limit = parsed.data.limit;

    const seen = new Set<string>();
    // Leave room for RxNorm / Google so searches feel "full" (not only local catalog).
    const catalogCap = q.length > 0 ? Math.min(12, limit) : limit;
    let results: SearchHit[] = catalogHits(q, catalogCap);

    for (const r of results) {
      seen.add(r.name.toLowerCase());
    }

    if (q.length >= 1 && results.length < limit) {
      const rxNames = await rxNormApproximateNames(q, 50);
      results = mergeDeduped(results, rxNames, seen, limit, "rxnorm");
    }

    if (q.length >= 2 && results.length < limit) {
      const gNames = await googleCustomSearchMedicineTitles(q, 10);
      results = mergeDeduped(results, gNames, seen, limit, "google");
    }

    results = results.slice(0, limit);

    return res.json({
      success: true,
      query: parsed.data.q,
      count: results.length,
      sources: {
        rxnorm: "https://www.nlm.nih.gov/research/umls/rxnorm/",
        googleCustomSearch: Boolean(
          process.env.GOOGLE_CUSTOM_SEARCH_API_KEY?.trim() &&
            process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID?.trim()
        ),
      },
      results,
    });
  })
);

export default router;
