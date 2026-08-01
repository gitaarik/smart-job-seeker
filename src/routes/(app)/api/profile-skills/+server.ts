/**
 * Quick-add endpoint behind the "add this skill to my profile" flow on a job's
 * unmatched skill pills. Kept separate from the skills page's form actions
 * because it is called from a job page, where none of that page's data is
 * loaded — GET returns just enough (the categories) to populate the popover.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, desc, eq } from "drizzle-orm";
import {
  profile_versions,
  tech_skill_categories,
  tech_skills,
} from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import {
  parseBody,
  techSkillQuickAddSchema,
  techSkillShowOnSchema,
} from "$lib/server/validation/api-schemas";
import {
  setProfileOnly,
  SHOW_ON_ALL,
  tagsForShowOn,
} from "$lib/profile-visibility";
import { SKILL_LEVELS } from "$lib/data/field-labels";
import { getSelectedProfileId, touchProfile } from "../../profile/utils";

/** Category used when a profile has none yet. */
const FALLBACK_CATEGORY_NAME = "Other";

export const GET: RequestHandler = async ({ locals, cookies }) => {
  const user = requireAuth(locals);

  const profileId = await getSelectedProfileId(cookies, user.id);
  if (!profileId) return json({ categories: [], skills: [] });

  const categories = await db.query.tech_skill_categories.findMany({
    where: eq(tech_skill_categories.profile_id, profileId),
    columns: { id: true, name: true },
    orderBy: asc(tech_skill_categories.sort),
    with: { tech_skills: { columns: { name: true } } },
  });

  return json({
    categories: categories.map((c) => ({ id: c.id, name: c.name })),
    // Names already on the profile, so the caller can mark a job skill as
    // known without waiting for a re-match to update `matched_skills`.
    skills: categories.flatMap((c) =>
      c.tech_skills.map((s) => s.name).filter(Boolean)
    ),
  });
};

export const POST: RequestHandler = async ({ request, locals, cookies }) => {
  const user = requireAuth(locals);

  const profileId = await getSelectedProfileId(cookies, user.id);
  if (!profileId) {
    return json({ error: "No profile selected" }, { status: 400 });
  }

  const body = parseBody(techSkillQuickAddSchema, await request.json());

  const level = body.level?.toLowerCase() || null;
  if (level && !SKILL_LEVELS.some((l) => l.value === level)) {
    return json({ error: "Unknown skill level" }, { status: 400 });
  }

  const categories = await db.query.tech_skill_categories.findMany({
    where: eq(tech_skill_categories.profile_id, profileId),
    columns: { id: true, name: true, sort: true },
    orderBy: asc(tech_skill_categories.sort),
    with: { tech_skills: { columns: { id: true, name: true } } },
  });

  // Adding the same skill from two different jobs is an easy mistake to make —
  // report it rather than growing a pile of duplicates.
  const existing = categories
    .flatMap((c) => c.tech_skills)
    .find((s) => s.name?.trim().toLowerCase() === body.name.toLowerCase());
  if (existing) {
    return json({ duplicate: true, id: existing.id, name: existing.name });
  }

  // A typed category name wins over a picked id, and reuses a category of that
  // name if one exists — otherwise saying "Databases" on two different jobs
  // would leave the profile with two of them.
  const newCategoryName = body.category_name?.trim();
  let categoryId: number | undefined;
  if (newCategoryName) {
    categoryId = categories.find(
      (c) => c.name?.trim().toLowerCase() === newCategoryName.toLowerCase(),
    )?.id;
  } else {
    categoryId = body.category_id ?? categories[0]?.id;
    if (categoryId && !categories.some((c) => c.id === categoryId)) {
      return json({ error: "Category not found" }, { status: 404 });
    }
  }

  if (!categoryId) {
    const [created] = await db
      .insert(tech_skill_categories)
      .values({
        // Unnamed only when the profile had no categories at all to pick from.
        name: newCategoryName || FALLBACK_CATEGORY_NAME,
        profile_id: profileId,
        sort: categories.reduce((max, c) => Math.max(max, c.sort ?? 0), -1) + 1,
        status: "published",
        date_created: new Date(),
      })
      .returning({ id: tech_skill_categories.id });
    categoryId = created.id;
  }

  const lastItem = await db.query.tech_skills.findFirst({
    where: eq(tech_skills.category_id, categoryId),
    orderBy: desc(tech_skills.sort),
    columns: { sort: true },
  });

  const tags = setProfileOnly(null, body.profile_only);

  const [skill] = await db
    .insert(tech_skills)
    .values({
      name: body.name,
      level,
      years_experience: body.years_experience ?? null,
      tags: tags.length > 0 ? tags : null,
      category_id: categoryId,
      sort: (lastItem?.sort ?? -1) + 1,
      status: "published",
      date_created: new Date(),
    })
    .returning({ id: tech_skills.id });

  await touchProfile(profileId);

  return json({
    success: true,
    id: skill.id,
    name: body.name,
    category_id: categoryId,
    profile_only: body.profile_only,
  });
};

export const PATCH: RequestHandler = async ({ request, locals, cookies }) => {
  const user = requireAuth(locals);

  const profileId = await getSelectedProfileId(cookies, user.id);
  if (!profileId) {
    return json({ error: "No profile selected" }, { status: 400 });
  }

  const body = parseBody(techSkillShowOnSchema, await request.json());

  const skill = await db.query.tech_skills.findFirst({
    where: eq(tech_skills.id, body.id),
    with: { tech_skill_category: { columns: { profile_id: true } } },
  });
  if (!skill || skill.tech_skill_category.profile_id !== profileId) {
    return json({ error: "Skill not found" }, { status: 404 });
  }

  const current = Array.isArray(skill.tags) ? (skill.tags as string[]) : [];

  // Verify the version exists before tagging with it — an unknown slug would
  // otherwise persist as a tag that no document ever activates.
  if (body.show_on !== SHOW_ON_ALL) {
    const version = await db.query.profile_versions.findFirst({
      where: and(
        eq(profile_versions.profile_id, profileId),
        eq(profile_versions.slug, body.show_on),
      ),
      columns: { slug: true },
    });
    if (!version?.slug) {
      return json({ error: "Version not found" }, { status: 404 });
    }
  }

  const tags = tagsForShowOn(current, body.show_on);

  await db
    .update(tech_skills)
    .set({
      tags: tags.length > 0 ? tags : null,
      date_updated: new Date(),
    })
    .where(eq(tech_skills.id, body.id));

  await touchProfile(profileId);

  return json({ success: true, tags });
};
