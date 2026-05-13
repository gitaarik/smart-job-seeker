/**
 * POST /api/jobs/import/suggest
 *
 * Asks the LLM to pick 1–3 job platforms tailored to the user's profile
 * and provide a keyword string for each. The scraper handles each platform's
 * search-form configuration at run time (login → navigate to search_page_url
 * → type keywords → submit), so the LLM never sees or constructs URLs.
 *
 * Returns a list of task drafts the client form pre-fills: platform_id,
 * platform name (for display), keywords, note, relevance. The user can edit
 * before clicking save.
 */
import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, isNotNull } from "drizzle-orm";
import { job_platforms } from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { getSelectedProfileId } from "../../../../(app)/profile/utils";
import { createAndGenerateAiChat } from "$lib/server/ai-chat/utils";
import { suggestImportTasksSchema } from "$lib/server/schemas/ai-prompt-schemas";

type SuggestablePlatform = {
  id: number;
  key: string;
  name: string;
  suggestion_priority: number | null;
  suggestion_hint: string | null;
};

async function fetchSuggestablePlatforms(): Promise<SuggestablePlatform[]> {
  // A platform is suggestable when it has both a curation priority AND a
  // search_page_url configured (the scraper needs the latter to drive the
  // form). Ordered by priority then id for determinism.
  return await db
    .select({
      id: job_platforms.id,
      key: job_platforms.key,
      name: job_platforms.name,
      suggestion_priority: job_platforms.suggestion_priority,
      suggestion_hint: job_platforms.suggestion_hint,
    })
    .from(job_platforms)
    .where(
      and(
        isNotNull(job_platforms.suggestion_priority),
        isNotNull(job_platforms.search_page_url),
      ),
    )
    .orderBy(
      asc(job_platforms.suggestion_priority),
      asc(job_platforms.id),
    );
}

function renderPlatformsForPrompt(rows: SuggestablePlatform[]): string {
  const lines: string[] = [];
  for (const p of rows) {
    lines.push(`- platform_id=${p.id}: "${p.name}" (key=${p.key})`);
    if (p.suggestion_hint) {
      lines.push(`  When to pick: ${p.suggestion_hint}`);
    }
  }
  return lines.join("\n");
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

  const platforms = await fetchSuggestablePlatforms();
  if (platforms.length === 0) {
    return json(
      { success: false, message: "No suggestable platforms configured" },
      { status: 503 },
    );
  }

  const platformsList = renderPlatformsForPrompt(platforms);
  const validPlatformIds = new Set(platforms.map((p) => p.id));

  const result = await createAndGenerateAiChat(
    profileId,
    "suggest_import_tasks",
    { platforms_list: platformsList },
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
    keywords: string | null;
    note: string;
    relevance: "high" | "medium" | "low";
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
      keywords: task.keywords,
      note: task.note,
      relevance: task.relevance,
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
