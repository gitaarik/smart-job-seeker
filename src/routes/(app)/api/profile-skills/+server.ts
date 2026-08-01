/**
 * Quick-add endpoint behind the "add this skill to my profile" flow on a job's
 * unmatched skill pills. Kept separate from the skills page's form actions
 * because it is called from a job page, where none of that page's data is
 * loaded — GET returns just enough (the categories) to populate the popover.
 */

import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { dbDirect as db } from "$lib/server/db";
import { asc, desc, eq } from "drizzle-orm";
import {
  profile_versions,
  tech_skill_categories,
  tech_skills,
} from "$lib/server/db/schema";
import { requireAuth } from "$lib/server/utils/api-helpers";
import {
  parseBody,
  techSkillQuickAddSchema,
  techSkillUpdateSchema,
} from "$lib/server/validation/api-schemas";
import {
  setProfileOnly,
  setVersions,
  SHOW_ON_ALL,
  tagsForShowOn,
} from "$lib/profile-visibility";
import { SKILL_LEVELS } from "$lib/data/field-labels";
import { getSelectedProfileId, touchProfile } from "../../profile/utils";

/** Category used when a profile has none yet. */
const FALLBACK_CATEGORY_NAME = "Other";

/** Tag columns store null rather than an empty array when nothing applies. */
function nullIfEmpty(tags: string[]): string[] | null {
  return tags.length > 0 ? tags : null;
}

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

  let tags = setProfileOnly(null, body.profile_only);
  if (body.versions?.length) {
    const known = await db.query.profile_versions.findMany({
      where: eq(profile_versions.profile_id, profileId),
      columns: { slug: true },
    });
    const slugs = new Set(known.map((v) => v.slug).filter(Boolean));
    const unknown = body.versions.find((v) => !slugs.has(v));
    if (unknown) {
      return json({ error: `Unknown version "${unknown}"` }, { status: 404 });
    }
    tags = setVersions(tags, body.versions);
  }

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

  const body = parseBody(techSkillUpdateSchema, await request.json());

  const skill = await db.query.tech_skills.findFirst({
    where: eq(tech_skills.id, body.id),
    with: { tech_skill_category: { columns: { profile_id: true } } },
  });
  if (!skill || skill.tech_skill_category.profile_id !== profileId) {
    return json({ error: "Skill not found" }, { status: 404 });
  }

  const current = Array.isArray(skill.tags) ? (skill.tags as string[]) : [];
  const updates: Partial<typeof tech_skills.$inferInsert> = {};

  // Naming a version that doesn't exist would persist a tag no document ever
  // activates — silently, and looking for all the world like it had worked.
  const named = [
    ...(body.show_on && body.show_on !== SHOW_ON_ALL ? [body.show_on] : []),
    ...(body.versions ?? []),
  ];
  if (named.length > 0) {
    const known = await db.query.profile_versions.findMany({
      where: eq(profile_versions.profile_id, profileId),
      columns: { slug: true },
    });
    const slugs = new Set(known.map((v) => v.slug).filter(Boolean));
    const unknown = named.find((v) => !slugs.has(v));
    if (unknown) {
      return json({ error: `Unknown version "${unknown}"` }, { status: 404 });
    }
  }

  if (body.show_on != null) {
    // The lift shorthand, which settles visibility on its own.
    updates.tags = nullIfEmpty(tagsForShowOn(current, body.show_on));
  } else if (body.profile_only !== undefined || body.versions !== undefined) {
    let tags = current;
    if (body.profile_only === false) {
      // Shown everywhere, so the whitelist goes with the exclusions — leaving
      // it would quietly mean "only on those versions" instead.
      tags = tagsForShowOn(tags, SHOW_ON_ALL);
    } else {
      if (body.profile_only) tags = setProfileOnly(tags, true);
      if (body.versions !== undefined) tags = setVersions(tags, body.versions);
    }
    updates.tags = nullIfEmpty(tags);
  }

  if (body.level !== undefined) {
    const level = body.level?.toLowerCase() || null;
    if (level && !SKILL_LEVELS.some((l) => l.value === level)) {
      return json({ error: "Unknown skill level" }, { status: 400 });
    }
    updates.level = level;
  }

  if (body.category_id !== undefined || body.category_name) {
    const categoryId = await resolveCategory(profileId, body);
    if (categoryId === null) {
      return json({ error: "Category not found" }, { status: 404 });
    }
    updates.category_id = categoryId;
  }

  if (Object.keys(updates).length === 0) {
    return json({ success: true, tags: current });
  }

  await db
    .update(tech_skills)
    .set({ ...updates, date_updated: new Date() })
    .where(eq(tech_skills.id, body.id));

  await touchProfile(profileId);

  return json({
    success: true,
    // Not `??`: clearing the tags writes null, and treating that as "unchanged"
    // would report a successful lift as having done nothing.
    tags: "tags" in updates ? updates.tags : current,
    category_id: "category_id" in updates
      ? updates.category_id
      : skill.category_id,
  });
};

/**
 * The category an edit should land in, creating one from a typed name the same
 * way the quick-add does. Null means the picked id isn't this profile's.
 */
async function resolveCategory(
  profileId: number,
  body: { category_id?: number | null; category_name?: string | null },
): Promise<number | null> {
  const categories = await db.query.tech_skill_categories.findMany({
    where: eq(tech_skill_categories.profile_id, profileId),
    columns: { id: true, name: true, sort: true },
    orderBy: asc(tech_skill_categories.sort),
  });

  const name = body.category_name?.trim();
  if (name) {
    const existing = categories.find(
      (c) => c.name?.trim().toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing.id;
    const [created] = await db
      .insert(tech_skill_categories)
      .values({
        name,
        profile_id: profileId,
        sort: categories.reduce((max, c) => Math.max(max, c.sort ?? 0), -1) + 1,
        status: "published",
        date_created: new Date(),
      })
      .returning({ id: tech_skill_categories.id });
    return created.id;
  }

  const picked = body.category_id;
  if (!picked) return null;
  return categories.some((c) => c.id === picked) ? picked : null;
}
