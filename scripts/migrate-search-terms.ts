#!/usr/bin/env node
/**
 * One-off migration: backfill `search_tasks.search_term` from existing
 * `search_url`s, so old tasks survive the move from URL-template flow to
 * the dynamic form-fill flow (which requires search_term).
 *
 * Strategy per task:
 *   1. If task has a preset_id, look at the preset's url_template, find
 *      which query-param holds `{KEYWORDS}`, extract that param's value
 *      from the actual search_url, URL-decode, write to search_term.
 *   2. Otherwise, fall back to common param names (`keywords`, `q`,
 *      `query`, `search`, `kw`) on the URL's query string. First match
 *      wins.
 *   3. Tasks where neither resolves are logged and left alone.
 *
 * Idempotent: tasks that already have a non-empty `search_term` are
 * skipped.
 *
 * Usage (from cloud/):
 *   npm run migrate-search-terms
 */

import { eq, isNull } from "drizzle-orm";
import { dbDirect as db } from "$lib/server/db";
import {
  job_platform_search_presets,
  search_tasks,
} from "$lib/server/db/schema";

const FALLBACK_PARAM_NAMES = ["keywords", "q", "query", "search", "kw"];

function extractFromTemplate(
  urlTemplate: string,
  actualUrl: string,
): string | null {
  let template: URL;
  let actual: URL;
  try {
    template = new URL(urlTemplate);
    actual = new URL(actualUrl);
  } catch {
    return null;
  }
  // Walk the template's query params looking for the {KEYWORDS} placeholder.
  for (const [key, value] of template.searchParams.entries()) {
    if (value === "{KEYWORDS}") {
      const actualValue = actual.searchParams.get(key);
      if (actualValue && actualValue.trim()) return actualValue.trim();
    }
  }
  // Path-segment {KEYWORDS} (some templates put it in the URL path).
  if (urlTemplate.includes("{KEYWORDS}")) {
    const path = urlTemplate.replace("{KEYWORDS}", "(.+?)");
    const re = new RegExp(path.replace(/[.+?^${}()|[\]\\]/g, (m) =>
      m === "(.+?)" ? m : "\\" + m
    ));
    const match = actualUrl.match(re);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]);
      } catch {
        return match[1];
      }
    }
  }
  return null;
}

function extractFromCommonParams(actualUrl: string): string | null {
  let actual: URL;
  try {
    actual = new URL(actualUrl);
  } catch {
    return null;
  }
  for (const name of FALLBACK_PARAM_NAMES) {
    const v = actual.searchParams.get(name);
    if (v && v.trim()) return v.trim();
  }
  return null;
}

async function main() {
  const tasks = await db.query.search_tasks.findMany({
    where: isNull(search_tasks.search_term),
    columns: {
      id: true,
      search_url: true,
      preset_id: true,
      platform_id: true,
    },
  });
  const candidates = tasks.filter((t) => t.search_url);
  console.log(
    `Found ${tasks.length} task(s) with null search_term; ${candidates.length} have a search_url to parse.`,
  );

  // Preload all referenced presets in one shot.
  const presetIds = Array.from(
    new Set(
      candidates.map((t) => t.preset_id).filter((x): x is number => x !== null),
    ),
  );
  const presets = presetIds.length > 0
    ? await db.query.job_platform_search_presets.findMany({
      columns: { id: true, url_template: true },
    })
    : [];
  const presetById = new Map(presets.map((p) => [p.id, p]));

  let filled = 0;
  let viaTemplate = 0;
  let viaFallback = 0;
  let skipped = 0;

  for (const task of candidates) {
    if (!task.search_url) continue;

    let extracted: string | null = null;
    if (task.preset_id) {
      const preset = presetById.get(task.preset_id);
      if (preset?.url_template) {
        extracted = extractFromTemplate(preset.url_template, task.search_url);
        if (extracted) viaTemplate++;
      }
    }
    if (!extracted) {
      extracted = extractFromCommonParams(task.search_url);
      if (extracted) viaFallback++;
    }

    if (!extracted) {
      skipped++;
      console.warn(
        `  task ${task.id}: could not extract — search_url=${
          task.search_url.slice(0, 80)
        }`,
      );
      continue;
    }

    await db
      .update(search_tasks)
      .set({ search_term: extracted, date_updated: new Date() })
      .where(eq(search_tasks.id, task.id));
    filled++;
    console.log(`  task ${task.id}: search_term = ${JSON.stringify(extracted)}`);
  }

  console.log(
    `\nDone. Filled ${filled} (${viaTemplate} via preset template, ${viaFallback} via fallback params). Skipped ${skipped}.`,
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("migrate-search-terms failed:", err);
  process.exit(1);
});
