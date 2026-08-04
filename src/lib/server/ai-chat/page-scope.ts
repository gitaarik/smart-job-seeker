/**
 * What page the user is on, said out loud.
 *
 * Until this existed the model inferred its situation from which context blocks
 * happened to be present — an application block meant "they are looking at an
 * application". That works until two pages request the same sources, and it is
 * invisible when it goes wrong. `application-pipeline.ts` had already grown a
 * hand-rolled version of this: it derives two entirely different framings from
 * `rows.some(r => r.isCurrent)`, because being on a list rather than on one
 * application changes what a question means, and nothing was telling it so.
 *
 * This block states the fact; it deliberately does NOT tell the model how to
 * behave. Behavioural guidance belongs with the block it governs — the pipeline
 * block already explains what comparing across applications means there — and
 * two places wording the same rule is how they drift apart.
 */

export interface PageScope {
  /** The page, named the way the user would say it. Lowercase, no full stop. */
  page: string;
  /**
   * What a question that names no subject is about here. Null on pages that
   * are about no single thing, which is itself worth saying: it is the
   * difference between "they must mean this one" and "they could mean any".
   */
  subject: string | null;
}

export function formatPageScope(scope: PageScope | undefined): string {
  if (!scope) return "";

  return [
    "## Where the user is",
    "",
    `They are on ${scope.page}.`,
    "",
    scope.subject
      ? `A question that names no subject is about ${scope.subject}.`
      : "This page is not about any one application or job, so a question " +
        "that names no subject is about their search as a whole rather than " +
        "about a single item in it. Do not pick one and answer as if they " +
        "meant that.",
  ].join("\n");
}
