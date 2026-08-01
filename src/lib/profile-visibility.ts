/**
 * Document visibility for tagged profile items (skills in particular).
 *
 * A profile item sits on two independent axes:
 *   - *known*  — it always counts toward job matching. The matcher reads
 *     `tech_skills` directly (see server/job/match-utils.ts) and never looks at
 *     tags, so nothing here affects scoring.
 *   - *shown*  — whether it prints on a rendered resume/CV.
 *
 * "Profile-only" is the off state of the second axis: the skill stays in the
 * profile so jobs keep matching on it, but no document prints it. That is the
 * common case for a skill you'd defend in an interview but wouldn't headline.
 *
 * It is stored in the existing version-tag array as the pair of base-template
 * exclusions `!resume` + `!cv`, so it needs no schema change and composes with
 * per-version tags: adding a positive version slug alongside them re-admits the
 * item on that one version (see ProfileDisplay/profile-filter.ts).
 */

/** Tags naming a base template rather than a user-defined version. */
export const BASE_TEMPLATE_TAGS = ["resume", "cv"];

/** The version/template slug of a tag, ignoring a leading "!" negation marker. */
export function tagSlug(tag: string): string {
  return tag.trim().replace(/^!/, "").trim().toLowerCase();
}

/** Whether a tag is an exclusion (`!slug`) rather than an include. */
export function isNegated(tag: string): boolean {
  return tag.trim().startsWith("!");
}

function asTagList(tags: string[] | null | undefined): string[] {
  return Array.isArray(tags) ? tags.filter((t) => typeof t === "string") : [];
}

/**
 * Whether the item is excluded from every base template — i.e. kept for
 * matching but off all documents (barring a per-version re-admit).
 */
export function isProfileOnly(tags: string[] | null | undefined): boolean {
  const negated = new Set(asTagList(tags).filter(isNegated).map(tagSlug));
  return BASE_TEMPLATE_TAGS.every((t) => negated.has(t));
}

/**
 * Toggle profile-only, leaving per-version tags untouched.
 *
 * Turning it on drops contradictory positive base tags; turning it off only
 * lifts the base-template exclusions, so a `["!resume","!cv","senior"]` skill
 * degrades to "shown, but only on the senior version" rather than losing that
 * restriction. Returns a plain array — callers normalise empty to null.
 */
export function setProfileOnly(
  tags: string[] | null | undefined,
  profileOnly: boolean,
): string[] {
  const list = asTagList(tags);
  const isBase = (t: string) => BASE_TEMPLATE_TAGS.includes(tagSlug(t));

  if (!profileOnly) {
    return list.filter((t) => !(isNegated(t) && isBase(t)));
  }
  return [
    ...BASE_TEMPLATE_TAGS.map((t) => `!${t}`),
    ...list.filter((t) => !isBase(t)),
  ];
}

/** Where a held-back item is being lifted to: every document, or one version. */
export const SHOW_ON_ALL = "all";

/**
 * Tags for "put this item on `target`" — either `SHOW_ON_ALL` or a version slug.
 *
 * Shared by the API route that performs the lift and by the code that predicts
 * whether a lift would actually work, so the two can't drift: a caller offering
 * the action and a caller doing it compute the same array.
 *
 * "Everywhere" has to drop the version whitelist too — lifting only the
 * exclusion pair would leave a re-admit tag behind and silently downgrade the
 * request to "on that one version". Explicit `!version` excludes survive: those
 * say "never here" regardless.
 */
export function tagsForShowOn(
  tags: string[] | null | undefined,
  target: string,
): string[] {
  const list = asTagList(tags);

  if (target === SHOW_ON_ALL) {
    return setProfileOnly(list, false).filter(isNegated);
  }
  const slug = target.trim().toLowerCase();
  return list.some((t) => tagSlug(t) === slug) ? list : [...list, target];
}
