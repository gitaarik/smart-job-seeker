import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { getSelectedProfileId } from "../../profile/utils";

export const load: PageServerLoad = async ({ parent, url }) => {
  const layoutData = await parent();

  if (!layoutData.selectedProfile) {
    redirect(302, "/dashboard");
  }

  const type = url.searchParams.get("type") || "all";

  // Get all applications for this profile
  const applications = await db.query.applications.findMany({
    where: { profile_id: layoutData.selectedProfile.id },
    with: {
      jobs: true,
      application_letters: {
        orderBy: { date_created: "desc" },
      },
      application_questions: {
        orderBy: { sort: "asc" },
      },
    },
    orderBy: { date_updated: "desc" },
  });

  // Flatten letters and questions with application context
  const letters = applications.flatMap((app) =>
    app.application_letters.map((letter) => ({
      ...letter,
      application: app,
      itemType: "letter" as const,
    })),
  );

  const questions = applications.flatMap((app) =>
    app.application_questions.map((question) => ({
      ...question,
      application: app,
      itemType: "question" as const,
    })),
  );

  // Filter by type
  let items: typeof letters | typeof questions | (typeof letters[0] | typeof questions[0])[] = [];
  if (type === "letters") {
    items = letters;
  } else if (type === "questions") {
    items = questions;
  } else {
    items = [...letters, ...questions].sort((a, b) => {
      const dateA = a.date_updated || a.date_created || new Date(0);
      const dateB = b.date_updated || b.date_created || new Date(0);
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }

  return {
    items,
    currentType: type,
    profileId: layoutData.selectedProfile.id,
  };
};

export const actions: Actions = {
  updateLetter: async ({ request, locals, cookies }) => {
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
    const content = formData.get("content") as string;
    const status = formData.get("status") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid letter ID" });
    }

    // Verify ownership through application
    const letter = await db.query.application_letters.findFirst({
      where: { id },
      with: {
        applications: true,
      },
    });

    if (!letter || letter.applications.profile_id !== profileId) {
      return fail(404, { error: "Letter not found" });
    }

    await db.application_letters.update({
      where: { id },
      data: {
        content: content || null,
        status: status || "draft",
        date_updated: new Date(),
      },
    });

    return { success: true };
  },

  updateQuestion: async ({ request, locals, cookies }) => {
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
    const answer = formData.get("answer") as string;

    if (isNaN(id)) {
      return fail(400, { error: "Invalid question ID" });
    }

    // Verify ownership through application
    const question = await db.query.application_questions.findFirst({
      where: { id },
      with: {
        applications: true,
      },
    });

    if (!question || question.applications.profile_id !== profileId) {
      return fail(404, { error: "Question not found" });
    }

    await db.application_questions.update({
      where: { id },
      data: {
        answer: answer || null,
        date_updated: new Date(),
      },
    });

    return { success: true };
  },

  deleteLetter: async ({ request, locals, cookies }) => {
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
      return fail(400, { error: "Invalid letter ID" });
    }

    const letter = await db.query.application_letters.findFirst({
      where: { id },
      with: {
        applications: true,
      },
    });

    if (!letter || letter.applications.profile_id !== profileId) {
      return fail(404, { error: "Letter not found" });
    }

    await db.application_letters.delete({
      where: { id },
    });

    return { success: true };
  },

  deleteQuestion: async ({ request, locals, cookies }) => {
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
      return fail(400, { error: "Invalid question ID" });
    }

    const question = await db.query.application_questions.findFirst({
      where: { id },
      with: {
        applications: true,
      },
    });

    if (!question || question.applications.profile_id !== profileId) {
      return fail(404, { error: "Question not found" });
    }

    await db.application_questions.delete({
      where: { id },
    });

    return { success: true };
  },
};
