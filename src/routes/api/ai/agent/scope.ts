/**
 * Which profile an assistant request is acting as.
 *
 * A conversation belongs to a (user, profile) pair, not to a user. Every turn
 * is answered from that profile's material and stamped with its id, so the
 * profile is part of what the thread *is* — listing one profile's threads under
 * another's history offers the user a thread they cannot resume without
 * silently changing its subject.
 *
 * The POST endpoint takes the profile from its validated body, where it has
 * always been. The GET endpoints have no body, so they take it from the query
 * string: deliberately explicit rather than read from the `selected_profile_id`
 * cookie the layout sets, because the cookie is a browser-session convenience
 * and these routes should stay callable by something that isn't a browser.
 */

import { error } from "@sveltejs/kit";
import { requireProfileAccess } from "$lib/server/utils/api-helpers";

/**
 * Read and authorize `?profile_id=`. Throws 400 when absent or unparseable and
 * 403 when it isn't the caller's, so no handler has to decide what a missing
 * profile means — there is no sane default for "as whom", and guessing one
 * (first profile, cookie, most recent) is how a thread ends up answered from
 * the wrong person's history.
 */
export async function requireConversationProfile(
  url: URL,
  userId: string,
): Promise<number> {
  const raw = url.searchParams.get("profile_id");
  const profileId = Number(raw);
  if (!raw || !Number.isInteger(profileId) || profileId <= 0) {
    error(400, "A profile_id is required");
  }
  await requireProfileAccess(profileId, userId);
  return profileId;
}
