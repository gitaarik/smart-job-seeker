import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard/profile");
  }

  const categories = await db.tech_skill_categories.findMany({
    where: { profile: layoutData.selectedProfile.id },
    orderBy: { sort: "asc" },
    include: {
      tech_skills: {
        orderBy: { sort: "asc" },
      },
    },
  });

  return { categories, profileId: layoutData.selectedProfile.id };
};

export const actions: Actions = {
  createCategory: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const name = formData.get("name") as string;

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Category name is required" });
    }

    // Get the highest sort value
    const lastItem = await db.tech_skill_categories.findFirst({
      where: { profile: profileId },
      orderBy: { sort: "desc" },
    });

    await db.tech_skill_categories.create({
      data: {
        name: name.trim(),
        profile: profileId,
        sort: (lastItem?.sort ?? -1) + 1,
        status: "published",
        date_created: new Date(),
      },
    });

    return { success: true };
  },

  updateCategory: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const name = formData.get("name") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid category ID" });
    }

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Category name is required" });
    }

    // Verify ownership
    const existing = await db.tech_skill_categories.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Category not found" });
    }

    await db.tech_skill_categories.update({
      where: { id },
      data: {
        name: name.trim(),
        date_updated: new Date(),
      },
    });

    return { success: true };
  },

  deleteCategory: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);

    if (isNaN(id)) {
      return fail(400, { error: "Invalid category ID" });
    }

    // Verify ownership
    const existing = await db.tech_skill_categories.findFirst({
      where: { id, profile: profileId },
    });

    if (!existing) {
      return fail(404, { error: "Category not found" });
    }

    // Delete will cascade to skills
    await db.tech_skill_categories.delete({
      where: { id },
    });

    return { success: true };
  },

  createSkill: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const categoryId = parseInt(formData.get("categoryId") as string);
    const name = formData.get("name") as string;
    const level = formData.get("level") as string;
    const years_experience = formData.get("years_experience") as string;

    if (isNaN(categoryId)) {
      return fail(400, { error: "Invalid category ID" });
    }

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Skill name is required" });
    }

    // Verify category ownership
    const category = await db.tech_skill_categories.findFirst({
      where: { id: categoryId, profile: profileId },
    });

    if (!category) {
      return fail(404, { error: "Category not found" });
    }

    // Get the highest sort value
    const lastItem = await db.tech_skills.findFirst({
      where: { category: categoryId },
      orderBy: { sort: "desc" },
    });

    await db.tech_skills.create({
      data: {
        name: name.trim(),
        level: level || null,
        years_experience: years_experience ? parseInt(years_experience) : null,
        category: categoryId,
        sort: (lastItem?.sort ?? -1) + 1,
        status: "published",
        date_created: new Date(),
      },
    });

    return { success: true };
  },

  updateSkill: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);
    const name = formData.get("name") as string;
    const level = formData.get("level") as string;
    const years_experience = formData.get("years_experience") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid skill ID" });
    }

    if (!name || name.trim().length === 0) {
      return fail(400, { error: "Skill name is required" });
    }

    // Verify ownership through category
    const existing = await db.tech_skills.findFirst({
      where: { id },
      include: { tech_skill_categories: true },
    });

    if (
      !existing ||
      existing.tech_skill_categories.profile !== profileId
    ) {
      return fail(404, { error: "Skill not found" });
    }

    await db.tech_skills.update({
      where: { id },
      data: {
        name: name.trim(),
        level: level || null,
        years_experience: years_experience ? parseInt(years_experience) : null,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },

  deleteSkill: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const id = parseInt(formData.get("id") as string);

    if (isNaN(id)) {
      return fail(400, { error: "Invalid skill ID" });
    }

    // Verify ownership through category
    const existing = await db.tech_skills.findFirst({
      where: { id },
      include: { tech_skill_categories: true },
    });

    if (
      !existing ||
      existing.tech_skill_categories.profile !== profileId
    ) {
      return fail(404, { error: "Skill not found" });
    }

    await db.tech_skills.delete({
      where: { id },
    });

    return { success: true };
  },
};
