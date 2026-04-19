import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { tech_skill_categories, tech_skills } from "$lib/server/db/schema";
import { SKILL_LEVELS } from "$lib/data/field-labels";
import { getSelectedProfileId } from "../../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const categories = await db.query.tech_skill_categories.findMany({
    where: eq(tech_skill_categories.profile_id, layoutData.selectedProfile.id),
    orderBy: asc(tech_skill_categories.sort),
    with: {
      tech_skills: {
        orderBy: asc(tech_skills.sort),
      },
    },
  });

  const levelOptions = SKILL_LEVELS;

  return { categories, profileId: layoutData.selectedProfile.id, levelOptions };
};

export const actions: Actions = {
  createCategory: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const name = formData.get("name") as string;

    if (!name || name.trim().length === 0) return fail(400, { error: "Category name is required" });

    const lastItem = await db.query.tech_skill_categories.findFirst({
      where: eq(tech_skill_categories.profile_id, profileId),
      orderBy: desc(tech_skill_categories.sort),
    });

    await db.insert(tech_skill_categories).values({
      name: name.trim(),
      profile_id: profileId,
      sort: (lastItem?.sort ?? -1) + 1,
      status: "published",
      date_created: new Date(),
    });

    return { success: true };
  },

  updateCategory: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const name = formData.get("name") as string;

    if (isNaN(id)) return fail(400, { error: "Invalid category ID" });
    if (!name || name.trim().length === 0) return fail(400, { error: "Category name is required" });

    const existing = await db.query.tech_skill_categories.findFirst({
      where: and(eq(tech_skill_categories.id, id), eq(tech_skill_categories.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Category not found" });

    await db.update(tech_skill_categories).set({
      name: name.trim(),
      date_updated: new Date(),
    }).where(eq(tech_skill_categories.id, id));

    return { success: true };
  },

  deleteCategory: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid category ID" });

    const existing = await db.query.tech_skill_categories.findFirst({
      where: and(eq(tech_skill_categories.id, id), eq(tech_skill_categories.profile_id, profileId)),
    });
    if (!existing) return fail(404, { error: "Category not found" });

    await db.delete(tech_skill_categories).where(eq(tech_skill_categories.id, id));

    return { success: true };
  },

  createSkill: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const categoryId = parseInt(formData.get("categoryId") as string);
    const name = formData.get("name") as string;
    const level = formData.get("level") as string;
    const years_experience = formData.get("years_experience") as string;
    const tagsJson = formData.get("tags") as string;

    if (isNaN(categoryId)) return fail(400, { error: "Invalid category ID" });
    if (!name || name.trim().length === 0) return fail(400, { error: "Skill name is required" });

    const category = await db.query.tech_skill_categories.findFirst({
      where: and(eq(tech_skill_categories.id, categoryId), eq(tech_skill_categories.profile_id, profileId)),
    });
    if (!category) return fail(404, { error: "Category not found" });

    const lastItem = await db.query.tech_skills.findFirst({
      where: eq(tech_skills.category_id, categoryId),
      orderBy: desc(tech_skills.sort),
    });

    let tags: string[] | null = null;
    try { tags = tagsJson ? JSON.parse(tagsJson) : null; } catch { /* ignore */ }
    if (tags && tags.length === 0) tags = null;

    await db.insert(tech_skills).values({
      name: name.trim(),
      level: level || null,
      years_experience: years_experience ? parseInt(years_experience) : null,
      ...(tags ? { tags } : {}),
      category_id: categoryId,
      sort: (lastItem?.sort ?? -1) + 1,
      status: "published",
      date_created: new Date(),
    });

    return { success: true };
  },

  updateSkill: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const name = formData.get("name") as string;
    const level = formData.get("level") as string;
    const years_experience = formData.get("years_experience") as string;
    const tagsJson = formData.get("tags") as string;

    if (isNaN(id)) return fail(400, { error: "Invalid skill ID" });
    if (!name || name.trim().length === 0) return fail(400, { error: "Skill name is required" });

    const existing = await db.query.tech_skills.findFirst({
      where: eq(tech_skills.id, id),
      with: { tech_skill_category: true },
    });
    if (!existing || existing.tech_skill_category.profile_id !== profileId) {
      return fail(404, { error: "Skill not found" });
    }

    let tags: string[] | null = null;
    try { tags = tagsJson ? JSON.parse(tagsJson) : null; } catch { /* ignore */ }
    if (tags && tags.length === 0) tags = null;

    await db.update(tech_skills).set({
      name: name.trim(),
      level: level || null,
      years_experience: years_experience ? parseInt(years_experience) : null,
      tags: tags ?? null,
      date_updated: new Date(),
    }).where(eq(tech_skills.id, id));

    return { success: true };
  },

  reorderSkills: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const categoryId = parseInt(formData.get("categoryId") as string);
    const orderJson = formData.get("order") as string;

    if (isNaN(categoryId)) return fail(400, { error: "Invalid category ID" });

    let order: number[];
    try { order = JSON.parse(orderJson); } catch { return fail(400, { error: "Invalid order data" }); }

    const category = await db.query.tech_skill_categories.findFirst({
      where: and(eq(tech_skill_categories.id, categoryId), eq(tech_skill_categories.profile_id, profileId)),
    });
    if (!category) return fail(404, { error: "Category not found" });

    await Promise.all(
      order.map((skillId, index) =>
        db.update(tech_skills).set({ sort: index, date_updated: new Date() })
          .where(and(eq(tech_skills.id, skillId), eq(tech_skills.category_id, categoryId)))
      ),
    );

    return { success: true };
  },

  reorderCategories: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const orderJson = formData.get("order") as string;

    let order: number[];
    try { order = JSON.parse(orderJson); } catch { return fail(400, { error: "Invalid order data" }); }

    await Promise.all(
      order.map((categoryId, index) =>
        db.update(tech_skill_categories).set({ sort: index, date_updated: new Date() })
          .where(and(eq(tech_skill_categories.id, categoryId), eq(tech_skill_categories.profile_id, profileId)))
      ),
    );

    return { success: true };
  },

  deleteSkill: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    if (isNaN(id)) return fail(400, { error: "Invalid skill ID" });

    const existing = await db.query.tech_skills.findFirst({
      where: eq(tech_skills.id, id),
      with: { tech_skill_category: true },
    });
    if (!existing || existing.tech_skill_category.profile_id !== profileId) {
      return fail(404, { error: "Skill not found" });
    }

    await db.delete(tech_skills).where(eq(tech_skills.id, id));

    return { success: true };
  },
};
