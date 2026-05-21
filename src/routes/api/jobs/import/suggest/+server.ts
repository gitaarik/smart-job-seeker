/**
 * POST /api/jobs/import/suggest
 *
 * Asks the LLM to rank every suggestable job platform for the user's
 * profile and pre-fill a per-platform task draft (keywords + filters drawn
 * from the user's match preferences). The scraper drives each platform's
 * search form at run time, silently drops filters the form doesn't expose,
 * and records misses to `job_platforms.unsupported_filters` so future
 * suggestions can soft-deprioritize platforms that don't honor the user's
 * preferred filters.
 *
 * Returns task drafts the client form can save: platform_id, platform name
 * (for display), keywords, note, relevance, filters. The user can edit any
 * field before saving.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import { job_platforms, match_config } from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { getSelectedProfileId } from "../../../../(app)/profile/utils";
import { createAndGenerateAiChat } from "$lib/server/ai-chat/utils";
import { suggestImportTasksSchema } from "$lib/server/schemas/ai-prompt-schemas";
import {
  SEARCH_FILTER_DEFINITIONS,
  type SearchFilterName,
  type SearchFilterValue,
} from "$lib/job-platforms/search-filters";

type SuggestablePlatform = {
  id: number;
  key: string;
  name: string;
  url: string;
  search_page_url: string | null;
  unsupported_filters: Record<string, string[]>;
};

type PreferenceConfig = {
  job_types: string[];
  experience_levels: string[];
  work_location: string[];
  locations: string[];
  remote_only: boolean | null;
};

async function fetchSuggestablePlatforms(): Promise<SuggestablePlatform[]> {
  // A platform is suggestable when it has a search_page_url configured —
  // the scraper needs it to drive the form. Ordered by id for determinism.
  return await db
    .select({
      id: job_platforms.id,
      key: job_platforms.key,
      name: job_platforms.name,
      url: job_platforms.url,
      search_page_url: job_platforms.search_page_url,
      unsupported_filters: job_platforms.unsupported_filters,
    })
    .from(job_platforms)
    .where(
      and(
        isNotNull(job_platforms.search_page_url),
        eq(job_platforms.status, "published"),
      ),
    )
    .orderBy(asc(job_platforms.id));
}

async function fetchPreferences(profileId: number): Promise<PreferenceConfig | null> {
  const row = await db.query.match_config.findFirst({
    where: eq(match_config.profile_id, profileId),
    columns: {
      job_types: true,
      experience_levels: true,
      work_location: true,
      locations: true,
      remote_only: true,
    },
  });
  if (!row) return null;
  return {
    job_types: (row.job_types as string[] | null) ?? [],
    experience_levels: (row.experience_levels as string[] | null) ?? [],
    work_location: (row.work_location as string[] | null) ?? [],
    locations: (row.locations as string[] | null) ?? [],
    remote_only: row.remote_only ?? null,
  };
}

function renderPreferencesForPrompt(p: PreferenceConfig | null): string {
  if (!p) return "(no preferences set yet)";
  const lines: string[] = [];
  if (p.job_types.length > 0) lines.push(`- job_types: ${p.job_types.join(", ")}`);
  if (p.experience_levels.length > 0) {
    lines.push(`- experience_levels: ${p.experience_levels.join(", ")}`);
  }
  if (p.work_location.length > 0) {
    lines.push(`- work_location: ${p.work_location.join(", ")}`);
  }
  if (p.locations.length > 0) lines.push(`- locations: ${p.locations.join(", ")}`);
  if (p.remote_only !== null) lines.push(`- remote_only: ${p.remote_only}`);
  if (lines.length === 0) return "(no preferences set yet)";
  return lines.join("\n");
}

function renderPlatformsForPrompt(rows: SuggestablePlatform[]): string {
  const lines: string[] = [];
  for (const p of rows) {
    lines.push(`- platform_id=${p.id}: "${p.name}" (key=${p.key})`);
    const unsupportedLines = renderUnsupportedFilters(p.unsupported_filters);
    if (unsupportedLines.length > 0) {
      lines.push("  Known-unsupported filters (deprioritize when these overlap the user's preferences):");
      for (const ul of unsupportedLines) lines.push(`    ${ul}`);
    }
  }
  return lines.join("\n");
}

function renderUnsupportedFilters(unsupported: Record<string, string[]>): string[] {
  const out: string[] = [];
  for (const [name, keys] of Object.entries(unsupported)) {
    if (!(name in SEARCH_FILTER_DEFINITIONS)) continue;
    const def = SEARCH_FILTER_DEFINITIONS[name as SearchFilterName];
    const validKeys = keys.filter((k) => k in def.values);
    if (validKeys.length === 0) continue;
    out.push(`${name}: [${validKeys.join(", ")}]`);
  }
  return out;
}

function renderFilterTaxonomy(): string {
  const lines: string[] = [];
  for (
    const [name, def] of Object.entries(SEARCH_FILTER_DEFINITIONS) as Array<
      [SearchFilterName, typeof SEARCH_FILTER_DEFINITIONS[SearchFilterName]]
    >
  ) {
    const valueKeys = Object.keys(def.values).filter((k) =>
      k !== Object.keys(def.values)[0]
    );
    lines.push(`- ${name}: [${valueKeys.join(", ")}]`);
  }
  return lines.join("\n");
}

/**
 * Validate the LLM's filters output against the canonical taxonomy. Drops
 * unknown filter names and unknown value_keys defensively, but does NOT
 * gate on per-platform support — the scraper handles missing filters at
 * runtime and feeds unsupported_filters back to future suggestions.
 */
function validateFilters(
  raw: Record<string, string[]> | undefined,
): Record<string, SearchFilterValue> {
  if (!raw) return {};
  const out: Record<string, SearchFilterValue> = {};
  for (const [name, values] of Object.entries(raw)) {
    if (!(name in SEARCH_FILTER_DEFINITIONS)) continue;
    const def = SEARCH_FILTER_DEFINITIONS[name as SearchFilterName];
    const kept = values.filter((v) => v in def.values);
    if (kept.length === 0) continue;
    out[name] = kept;
  }
  return out;
}

export const POST: RequestHandler = async ({ cookies, locals }) => {
  const user = requireAuth(locals);

  const profileId = await getSelectedProfileId(cookies, user.id);
  if (!profileId) {
    return json(
      { success: false, message: "No active profile selected" },
      { status: 400 },
    );
  }

  const [platforms, preferences] = await Promise.all([
    fetchSuggestablePlatforms(),
    fetchPreferences(profileId),
  ]);
  if (platforms.length === 0) {
    return json(
      { success: false, message: "No suggestable platforms configured" },
      { status: 503 },
    );
  }

  const platformsList = renderPlatformsForPrompt(platforms);
  const preferencesList = renderPreferencesForPrompt(preferences);
  const filterTaxonomy = renderFilterTaxonomy();
  const validPlatformIds = new Set(platforms.map((p) => p.id));

  const result = await createAndGenerateAiChat(
    profileId,
    "suggest_import_tasks",
    {
      platforms_list: platformsList,
      preferences: preferencesList,
      filter_taxonomy: filterTaxonomy,
    },
    undefined,
    {
      profileDataFields: [
        "title",
        "headline",
        "subtitle",
        "summary",
        "core_stack",
        "location",
        "city",
        "region",
        "country_code",
        "remote_start_year",
        "tech_skill_categories",
        "languages",
        "work_experiences",
      ],
    },
  );

  if (!result.success || !result.aiChat?.response) {
    return json(
      { success: false, message: result.message || "Failed to generate suggestions" },
      { status: 422 },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.aiChat.response);
  } catch {
    return json(
      { success: false, message: "AI returned non-JSON response" },
      { status: 502 },
    );
  }

  const validated = suggestImportTasksSchema.safeParse(parsed);
  if (!validated.success) {
    return json(
      { success: false, message: "AI response failed validation" },
      { status: 502 },
    );
  }

  // Drop any suggestion referencing an unknown platform_id. Defensive: the
  // schema only validates shape, not membership, and the LLM occasionally
  // hallucinates IDs.
  const tasks: Array<{
    platform_id: number;
    platform: string;
    platform_name: string;
    platform_url: string;
    keywords: string | null;
    note: string;
    relevance: "high" | "medium" | "low";
    filters: Record<string, SearchFilterValue>;
  }> = [];
  const droppedIds: number[] = [];
  for (const task of validated.data.tasks) {
    if (!validPlatformIds.has(task.platform_id)) {
      droppedIds.push(task.platform_id);
      continue;
    }
    const platform = platforms.find((p) => p.id === task.platform_id)!;
    tasks.push({
      platform_id: platform.id,
      platform: platform.key,
      platform_name: platform.name,
      // Prefer the scraper's actual entry URL; fall back to the platform
      // home if no search-page URL is configured.
      platform_url: platform.search_page_url ?? platform.url,
      keywords: task.keywords,
      note: task.note,
      relevance: task.relevance,
      filters: validateFilters(task.filters),
    });
  }
  if (droppedIds.length > 0) {
    console.warn(
      `[suggest_import_tasks] Dropped ${droppedIds.length} task(s) ` +
        `referencing invalid platform_ids: [${droppedIds.join(", ")}]. ` +
        `Valid IDs offered: [${[...validPlatformIds].join(", ")}].`,
    );
  }

  if (tasks.length === 0) {
    return json(
      { success: false, message: "AI returned no usable suggestions" },
      { status: 502 },
    );
  }

  return json({ success: true, tasks });
};
