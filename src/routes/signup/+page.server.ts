import type { PageServerLoad } from "./$types";
import { redirect } from "@sveltejs/kit";

export const load: PageServerLoad = async (event) => {
  if (event.locals.user) {
    const isApproved = (event.locals.user as { is_approved?: boolean })
      .is_approved;
    redirect(302, isApproved ? "/" : "/signup/pending");
  }
  return {};
};
