import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

/**
 * Gone in the Activity unification — status log + records, merged into the Activity stream.
 * A permanent redirect rather than a 404: this tab was linked from the
 * Overview page, from the assistant, and from anyone's bookmarks.
 * See planning/APPLICATION-ACTIVITY.md.
 */
export const load: PageLoad = ({ params }) => {
  redirect(308, `/applications/${params.id}/activity`);
};
