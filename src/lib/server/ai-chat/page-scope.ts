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
	/**
	 * One more fact about this page, when the route id alone cannot know it.
	 *
	 * Still a fact and not guidance — the rule above holds. It exists because a
	 * route's hint is a constant, and a constant that describes the user's
	 * situation is only right until the situation changes: /jobs/[id] asserted
	 * "a job posting they have not applied to yet" on every job, including the
	 * ones they had applied to, whose application was listed by two other blocks
	 * in the same prompt. A hint that contradicts the evidence beside it is worse
	 * than no hint, so anything conditional is resolved per turn and lands here.
	 */
	note?: string;
}

export function formatPageScope(scope: PageScope | undefined): string {
	if (!scope) return '';

	return [
		'## Where the user is',
		'',
		`They are on ${scope.page}.`,
		'',
		scope.subject
			? `A question that names no subject is about ${scope.subject}.`
			: 'This page is not about any one application or job, so a question ' +
				'that names no subject is about their search as a whole rather than ' +
				'about a single item in it. Do not pick one and answer as if they ' +
				'meant that.',
		...(scope.note ? ['', scope.note] : [])
	].join('\n');
}
