/**
 * Shared helpers for the hand-entered job paths: creating a manual job from
 * /applications/new and editing one from /jobs/[id]. Both read the same form
 * field names and have to land identically-shaped rows in `jobs`, so the
 * coercion and platform lookup live here rather than being written twice.
 */

import { dbDirect as db } from "$lib/server/db";
import { ilike, or } from "drizzle-orm";
import { job_platforms } from "$lib/server/db/schema";

/**
 * Best-effort lookup of a job_platforms row whose URL matches the host of the
 * given job URL, mirroring the domain-candidate matching in
 * /api/platforms/detect. Returns null when the URL is empty/invalid or no
 * platform matches — manual jobs are allowed to have no platform.
 */
export async function detectPlatformId(
  sourceUrl: string | null,
): Promise<number | null> {
  if (!sourceUrl) return null;
  let domain: string;
  try {
    const parsed = new URL(
      sourceUrl.startsWith("http") ? sourceUrl : `https://${sourceUrl}`,
    );
    domain = parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const labels = domain.split(".");
  const candidates: string[] = [];
  for (let i = 0; i < Math.max(labels.length - 1, 1); i++) {
    candidates.push(labels.slice(i).join("."));
  }
  const platform = await db.query.job_platforms.findFirst({
    where: or(...candidates.map((d) => ilike(job_platforms.url, `%${d}%`))),
    columns: { id: true },
  });
  return platform?.id ?? null;
}

export function parseIntOrNull(
  value: FormDataEntryValue | null,
): number | null {
  const n = parseInt(String(value ?? "").trim(), 10);
  return Number.isNaN(n) ? null : n;
}

export function strOrNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

/**
 * Read a repeated form field (checkbox group) as a canonical string array.
 * Returns null rather than [] so it lines up with the nullable columns and the
 * `?? parsed?.x` fallbacks.
 */
export function strArrayOrNull(
  values: FormDataEntryValue[],
): string[] | null {
  const list = values.map((v) => String(v).trim()).filter(Boolean);
  return list.length > 0 ? list : null;
}

/**
 * Coerce a `<input type="date">` value for the `date_posted` column, which is a
 * Drizzle `date()` in string mode. The input already posts YYYY-MM-DD, but a
 * hand-rolled POST need not, so don't take the format on trust.
 */
export function datePostedOrNull(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
