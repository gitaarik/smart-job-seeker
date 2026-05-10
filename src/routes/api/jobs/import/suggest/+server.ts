import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, isNotNull } from "drizzle-orm";
import { job_platforms } from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { getSelectedProfileId } from "../../../../(app)/profile/utils";
import { createAndGenerateAiChat } from "$lib/server/ai-chat/utils";
import { suggestImportTasksSchema } from "$lib/server/schemas/ai-prompt-schemas";

/**
 * Build the markdown bullet-list of suggestable platforms that gets injected
 * into the suggest_import_tasks prompt as ${platforms_list}. Each entry has a
 * key the LLM uses verbatim, a URL template with {KEYWORDS} / {LOCATION}
 * placeholders, and an optional "when to pick" hint.
 */
async function buildPlatformsList(): Promise<string> {
  const rows = await db.query.job_platforms.findMany({
    where: and(
      isNotNull(job_platforms.suggestion_priority),
      isNotNull(job_platforms.search_url_template),
    ),
    orderBy: asc(job_platforms.suggestion_priority),
    columns: {
      key: true,
      search_url_template: true,
      suggestion_hint: true,
    },
  });
  if (rows.length === 0) {
    // Defensive fallback if the suggestion metadata is wiped or never seeded —
    // gives the LLM at least one option so the feature degrades gracefully.
    return "- linkedin → https://www.linkedin.com/jobs/search/?keywords={KEYWORDS}&location={LOCATION}\n  When to pick: universal default";
  }
  return rows.map((p) => {
    const hint = p.suggestion_hint ? `\n  When to pick: ${p.suggestion_hint}` : "";
    return `- ${p.key} → ${p.search_url_template}${hint}`;
  }).join("\n");
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

  const platformsList = await buildPlatformsList();

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

  return json({ success: true, tasks: validated.data.tasks });
};
