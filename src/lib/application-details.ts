/**
 * The details an application picks up along the way — the things said in
 * passing that matter later.
 *
 * An interview mentions two mandatory office days that were not in the ad. A
 * recruiter names a band before any offer exists. Someone promises to send a
 * take-home on Monday. Each is buried in one entry among many, and the standing
 * summary — 3-6 sentences about where things stand — cannot carry them without
 * becoming a list instead of a position.
 *
 * ## A projection, never an accumulation
 *
 * Details are regenerated from the whole entry set, exactly like the summary
 * (see `applications.context_summary`). That is what makes them survive their
 * own subject matter: a negotiation CONTRADICTS ITSELF BY DESIGN — the band was
 * 90-100k, then the offer said 95, then 97 after pushback — and a list that
 * accumulated would hold three salary rows with no way to say which is live.
 * Regenerating means the model sees the whole history and writes the current
 * state, and a deleted or corrected entry takes its details with it.
 *
 * ## Why a category, and why one of them is "other"
 *
 * The category exists for consumers that cannot read the value: the card groups
 * by it, and comparing applications needs like for like. Anything a reader
 * could work out from the text itself does not need storing.
 *
 * `other` is the deliberate escape hatch. A closed vocabulary is what makes
 * comparison possible, and it is also what would silently drop the unusual
 * detail that turns out to matter — the one nobody anticipated is exactly the
 * one worth surfacing. So `other` renders like any other detail and is never
 * compared across applications. Closed set for what gets compared, open bucket
 * for what gets shown.
 */

export const detailCategories = [
  {
    value: "requirement",
    label: "Requirements",
    hint: "A condition to satisfy: references, right to work, a certification, "
      + "notice period, a mandatory way of working",
  },
  {
    value: "compensation",
    label: "Compensation talk",
    hint: "Money and benefits discussed short of a formal offer — bands, "
      + "expectations, what is negotiable",
  },
  {
    value: "logistics",
    label: "Process",
    hint: "How this runs from here: the next step, who runs it, when, what to "
      + "prepare",
  },
  {
    value: "commitment",
    label: "Promised",
    hint: "What either side said they would do, and by when",
  },
  {
    value: "role_detail",
    label: "About the role",
    hint: "Facts about the job or team that were not in the ad: stack, team "
      + "size, reporting line, travel, on-call",
  },
  {
    value: "other",
    label: "Also worth knowing",
    hint: "Anything else worth remembering that none of the above fits",
  },
] as const;

export type DetailCategory = (typeof detailCategories)[number]["value"];

export const detailCategoryValues: string[] = detailCategories.map((c) =>
  c.value
);

export function getDetailCategoryLabel(category: string | null): string {
  return detailCategories.find((c) => c.value === category)?.label ??
    "Also worth knowing";
}

export interface ApplicationDetail {
  category: DetailCategory;
  /** A short noun phrase naming the thing: "Office days", "Notice period". */
  label: string;
  /** The fact itself: "Tuesdays and Thursdays, in Amsterdam". */
  value: string;
  /** The entry it came from, when the model named one that exists. */
  record_id: number | null;
}

/**
 * Caps. These bound a block that is rendered on a page AND sent in a prompt, so
 * they are correctness rather than tidiness: an unbounded list would push the
 * page past skimmable and the prompt past its budget on the same edit.
 */
const MAX_DETAILS = 12;
const MAX_LABEL_CHARS = 60;
const MAX_VALUE_CHARS = 300;

const asText = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const trimmed = v.trim().replace(/\s+/g, " ");
  if (!trimmed) return null;
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() + "…" : trimmed;
};

/**
 * Our side of the model boundary.
 *
 * Coercion lives here rather than in the wire schema because a `.transform()`
 * throws "Transforms cannot be represented in JSON Schema" the moment LangChain
 * converts it for structured output — the same lesson as record-derivation and
 * offer terms.
 *
 * `knownRecordIds` is what keeps provenance honest. A cited entry that is not
 * in the set the model was shown is a hallucinated citation, and a detail
 * linking to the wrong entry is worse than one linking to none: it invites
 * someone to verify a claim against text that does not contain it.
 */
export function coerceDetails(
  raw: unknown,
  knownRecordIds: number[] = [],
): ApplicationDetail[] {
  if (!Array.isArray(raw)) return [];

  const known = new Set(knownRecordIds);
  const seen = new Set<string>();
  const details: ApplicationDetail[] = [];

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;

    const label = asText(e.label, MAX_LABEL_CHARS);
    const value = asText(e.value, MAX_VALUE_CHARS);
    // Both halves are load-bearing: a label with no value says a topic came up
    // and refuses to say what was said, which reads as data loss rather than
    // as an absence.
    if (!label || !value) continue;

    const rawCategory = typeof e.category === "string"
      ? e.category.trim().toLowerCase()
      : null;
    // An invented category would render under the fallback heading anyway, so
    // it is normalised to `other` rather than dropping a real detail over it.
    const category = (rawCategory && detailCategoryValues.includes(rawCategory)
      ? rawCategory
      : "other") as DetailCategory;

    const rawId = typeof e.record_id === "number"
      ? e.record_id
      : typeof e.record_id === "string"
      ? Number(e.record_id)
      : NaN;
    const record_id = Number.isInteger(rawId) && known.has(rawId) ? rawId : null;

    // Same detail, two entries — a requirement repeated in an email and again
    // in the offer. One row, and the earliest citation stands.
    const key = `${category}:${label.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    details.push({ category, label, value, record_id });
    if (details.length >= MAX_DETAILS) break;
  }

  return details;
}

/**
 * As stored: `category` is a plain string, because the column is jsonb and rows
 * written by an older vocabulary outlive the constant that produced them.
 */
export interface StoredDetail {
  category: string;
  label: string;
  value: string;
  record_id: number | null;
}

/**
 * Grouped for rendering, in the vocabulary's own order, empty groups omitted.
 *
 * A category this build does not recognise falls into `other` rather than being
 * filtered out. Renaming a category or reading a row written by an older one
 * would otherwise make details disappear from the page while still sitting in
 * the database — the silent kind of loss, where nothing looks wrong.
 */
export function groupDetails(
  details: StoredDetail[],
): Array<{ category: DetailCategory; label: string; items: StoredDetail[] }> {
  const known = new Set(detailCategoryValues);
  const bucketOf = (d: StoredDetail) =>
    known.has(d.category) ? d.category : "other";

  return detailCategories
    .map((c) => ({
      category: c.value as DetailCategory,
      label: c.label,
      items: details.filter((d) => bucketOf(d) === c.value),
    }))
    .filter((g) => g.items.length > 0);
}
