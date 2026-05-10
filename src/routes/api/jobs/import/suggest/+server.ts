import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, eq, isNotNull } from "drizzle-orm";
import {
  job_platform_search_presets,
  job_platforms,
} from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { getSelectedProfileId } from "../../../../(app)/profile/utils";
import { createAndGenerateAiChat } from "$lib/server/ai-chat/utils";
import { suggestImportTasksSchema } from "$lib/server/schemas/ai-prompt-schemas";

type PresetRow = {
  id: number;
  platform_id: number;
  platform_key: string;
  platform_name: string;
  platform_priority: number | null;
  label: string;
  url_template: string;
  applicable_hint: string | null;
  preset_priority: number | null;
};

async function fetchSuggestablePresets(): Promise<PresetRow[]> {
  // Suggestable preset = its platform has a suggestion_priority AND the
  // preset itself has a suggestion_priority. Ordered by platform priority
  // then preset priority then id for determinism.
  return await db
    .select({
      id: job_platform_search_presets.id,
      platform_id: job_platforms.id,
      platform_key: job_platforms.key,
      platform_name: job_platforms.name,
      platform_priority: job_platforms.suggestion_priority,
      label: job_platform_search_presets.label,
      url_template: job_platform_search_presets.url_template,
      applicable_hint: job_platform_search_presets.applicable_hint,
      preset_priority: job_platform_search_presets.suggestion_priority,
    })
    .from(job_platform_search_presets)
    .innerJoin(
      job_platforms,
      eq(job_platform_search_presets.platform_id, job_platforms.id),
    )
    .where(and(
      isNotNull(job_platforms.suggestion_priority),
      isNotNull(job_platform_search_presets.suggestion_priority),
    ))
    .orderBy(
      asc(job_platforms.suggestion_priority),
      asc(job_platform_search_presets.suggestion_priority),
      asc(job_platform_search_presets.id),
    );
}

function renderPresetsForPrompt(rows: PresetRow[]): string {
  // Group by platform so the LLM sees the platforms structured and chooses
  // a preset within the most-applicable platform.
  const byPlatform = new Map<string, PresetRow[]>();
  for (const row of rows) {
    const list = byPlatform.get(row.platform_key) ?? [];
    list.push(row);
    byPlatform.set(row.platform_key, list);
  }
  const lines: string[] = [];
  for (const [key, presets] of byPlatform) {
    lines.push(`### ${presets[0].platform_name} (${key})`);
    for (const p of presets) {
      const placeholders = [
        p.url_template.includes("{KEYWORDS}") ? "{KEYWORDS}" : null,
        p.url_template.includes("{LOCATION}") ? "{LOCATION}" : null,
      ].filter(Boolean).join(" ");
      const placeholderInfo = placeholders.length > 0
        ? ` — placeholders: ${placeholders}`
        : " — literal URL, no placeholders";
      lines.push(`- preset_id=${p.id}: "${p.label}"${placeholderInfo}`);
      lines.push(`  Template: ${p.url_template}`);
      if (p.applicable_hint) {
        lines.push(`  When to pick: ${p.applicable_hint}`);
      }
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

function fillTemplate(
  template: string,
  keywords: string | null,
  location: string | null,
): string {
  // Substitute {KEYWORDS} / {LOCATION} with URL-encoded values. If the
  // value is null/empty and the placeholder is in a query-string segment,
  // remove the whole `?param=` or `&param=` chunk so we don't send an
  // empty param the platform might 400 on.
  let url = template;
  const replacements: Array<[string, string | null]> = [
    ["{KEYWORDS}", keywords],
    ["{LOCATION}", location],
  ];
  for (const [placeholder, raw] of replacements) {
    if (!url.includes(placeholder)) continue;
    if (raw && raw.trim().length > 0) {
      url = url.replaceAll(placeholder, encodeURIComponent(raw.trim()));
    } else {
      // Strip "&param=PLACEHOLDER" or "?param=PLACEHOLDER" so empty values
      // don't survive in the URL. Falls back to removing just the
      // placeholder if no leading "?param=" / "&param=" exists.
      const stripPattern = new RegExp(
        `([?&])[a-zA-Z_]+=${placeholder.replace(/[{}]/g, "\\$&")}`,
        "g",
      );
      url = url.replace(stripPattern, (match, sep) => sep === "?" ? "?" : "");
      url = url.replaceAll(placeholder, "");
      url = url.replace(/\?&/, "?").replace(/\?$/, "").replace(/&$/, "");
    }
  }
  return url;
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

  const presets = await fetchSuggestablePresets();
  if (presets.length === 0) {
    return json(
      { success: false, message: "No suggestable presets configured" },
      { status: 503 },
    );
  }

  const presetsList = renderPresetsForPrompt(presets);
  const validPresetIds = new Set(presets.map((p) => p.id));

  const result = await createAndGenerateAiChat(
    profileId,
    "suggest_import_tasks",
    { presets_list: presetsList },
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

  // Resolve each preset_id back to a real preset, substitute placeholders,
  // build the response shape the client expects. Silently drop any
  // suggestion that references an unknown preset_id (defensive — the LLM
  // shouldn't, but the validator only checks schema shape, not ID validity).
  const tasks: Array<{
    preset_id: number;
    platform: string;
    platform_name: string;
    preset_label: string;
    url: string;
    keywords: string | null;
    location: string | null;
    note: string;
    relevance: "high" | "medium" | "low";
  }> = [];
  for (const task of validated.data.tasks) {
    if (!validPresetIds.has(task.preset_id)) continue;
    const preset = presets.find((p) => p.id === task.preset_id)!;
    tasks.push({
      preset_id: preset.id,
      platform: preset.platform_key,
      platform_name: preset.platform_name,
      preset_label: preset.label,
      url: fillTemplate(preset.url_template, task.keywords, task.location),
      keywords: task.keywords,
      location: task.location,
      note: task.note,
      relevance: task.relevance,
    });
  }

  if (tasks.length === 0) {
    return json(
      { success: false, message: "AI returned no usable suggestions" },
      { status: 502 },
    );
  }

  return json({ success: true, tasks });
};
