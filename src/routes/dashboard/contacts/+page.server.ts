import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";
import { listContacts } from "$lib/server/contacts";

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();

  if (!layoutData.user) {
    redirect(302, "/login");
  }

  const contacts = await listContacts(layoutData.user.id);

  return { contacts };
};
