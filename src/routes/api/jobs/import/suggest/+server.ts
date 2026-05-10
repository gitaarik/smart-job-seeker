import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { eq, desc } from "drizzle-orm";
import {
  languages,
  profiles,
  tech_skill_categories,
  tech_skills,
  work_experiences,
} from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import { getSelectedProfileId } from "../../../../(app)/profile/utils";
import { createAndGenerateAiChat } from "$lib/server/ai-chat/utils";
import { suggestImportTasksSchema } from "$lib/server/schemas/ai-prompt-schemas";

/**
 * Build a compact profile summary for the suggest_import_tasks prompt.
 * Reads directly from the profile + related tables — collected_data isn't
 * always populated for manually-created profiles, so depending on it would
 * leave the LLM with `{}` and force it to hallucinate.
 */
async function buildProfileSummary(profileId: number): Promise<string> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.id, profileId),
    columns: {
      title: true,
      headline: true,
      subtitle: true,
      summary: true,
      core_stack: true,
      location: true,
      city: true,
      region: true,
      country_code: true,
      remote_start_year: true,
    },
  });
  if (!profile) return "{}";

  const [skillCategories, recentExperiences, profileLanguages] = await Promise.all([
    db.query.tech_skill_categories.findMany({
      where: eq(tech_skill_categories.profile_id, profileId),
      columns: { name: true, id: true },
      with: {
        tech_skills: {
          columns: { name: true, level: true, years_experience: true },
          orderBy: desc(tech_skills.years_experience),
          limit: 8,
        },
      },
    }),
    db.query.work_experiences.findMany({
      where: eq(work_experiences.profile_id, profileId),
      columns: { position: true, name: true, summary: true, start_date: true, end_date: true },
      orderBy: desc(work_experiences.start_date),
      limit: 3,
    }),
    db.query.languages.findMany({
      where: eq(languages.profile_id, profileId),
      columns: { name: true, proficiency: true },
    }),
  ]);

  const summary = {
    title: profile.title,
    headline: profile.headline,
    subtitle: profile.subtitle,
    summary: profile.summary,
    core_stack: profile.core_stack,
    location: profile.location || [profile.city, profile.region, profile.country_code]
      .filter(Boolean).join(", ") || null,
    remote_start_year: profile.remote_start_year,
    skill_categories: skillCategories.map((c) => ({
      name: c.name,
      skills: c.tech_skills.map((s) => ({
        name: s.name,
        level: s.level,
        years: s.years_experience,
      })),
    })).filter((c) => c.skills.length > 0),
    recent_work: recentExperiences.map((e) => ({
      position: e.position,
      company: e.name,
      summary: e.summary,
      start: e.start_date,
      end: e.end_date,
    })),
    languages: profileLanguages.map((l) => ({
      name: l.name,
      proficiency: l.proficiency,
    })),
  };

  return JSON.stringify(summary, null, 2);
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

  const profileSummary = await buildProfileSummary(profileId);

  const result = await createAndGenerateAiChat(
    profileId,
    "suggest_import_tasks",
    { profile_summary: profileSummary },
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
