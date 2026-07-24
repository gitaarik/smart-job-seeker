import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { and, asc, desc, eq } from "drizzle-orm";
import { profile_document_projects } from "$lib/server/db/schema";
import { getSelectedProfileId, touchProfile } from "../../utils";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();
  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }
  const profileId = layoutData.selectedProfile.id;

  const documents = await db.query.profile_document_projects.findMany({
    where: eq(profile_document_projects.profile_id, profileId),
    orderBy: [
      asc(profile_document_projects.sort),
      desc(profile_document_projects.date_created),
    ],
    columns: {
      id: true,
      kind: true,
      title: true,
      original_filename: true,
      status: true,
      summary: true,
      keywords: true,
      skipped: true,
      file_count: true,
      total_chars: true,
      total_bytes: true,
      work_experience_id: true,
      work_experience_project_id: true,
      date_created: true,
    },
  });

  return { documents, profileId };
};

export const actions: Actions = {
  delete: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) return fail(401, { error: "Not authenticated" });
    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) return fail(400, { error: "No profile selected" });

    const formData = await request.formData();
    const id = Number(formData.get("id"));
    if (!Number.isInteger(id)) {
      return fail(400, { error: "Invalid document id" });
    }

    // Scope the delete to the selected profile so a user can only remove their
    // own documents; cascades to profile_document_files.
    await db.delete(profile_document_projects).where(
      and(
        eq(profile_document_projects.id, id),
        eq(profile_document_projects.profile_id, profileId),
      ),
    );
    await touchProfile(profileId);
    return { success: true };
  },
};
