import type { PageServerLoad } from './$types';
import { getPlans, CREDIT_COST_EXAMPLES, getExtraUsage } from '$lib/server/billing/plans';
import { registrationOpen } from '$lib/server/auth/registration';

/**
 * One row of the "what things cost" table.
 *
 * Declared here rather than inferred because `CREDIT_COST_EXAMPLES` is one of
 * the constants cloud's billing overlay replaces: the OSS stub is `{}`, so
 * `Object.values` infers `unknown[]` in the tree CI checks while inferring a
 * useful shape in the dev container, which has the overlay bind-mounted. The
 * page type-checked locally and failed CI on exactly that. See the meta-repo
 * CLAUDE.md on why a measurement taken in the dev container is the right answer
 * to the wrong input.
 */
interface CostExample {
	label: string;
	avgCredits: number;
	note: string;
}

/**
 * The public pricing page.
 *
 * Deliberately **not** under `(app)` — the plans were only ever visible from
 * inside the authed billing page, which is the one place a person deciding
 * whether to sign up cannot reach.
 *
 * Everything here comes from `getPlans()` rather than from copy in the
 * template, so the page cannot drift from what billing actually charges. That
 * also means the OSS build renders the single self-hosted plan its stub
 * returns, and the cloud build renders four, with no conditional in the page.
 */
export const load: PageServerLoad = async ({ locals }) => {
	const extraUsage = getExtraUsage();
	return {
		plans: getPlans().map((p) => ({
			id: p.id,
			name: p.name,
			description: p.description,
			priceMonthly: p.priceMonthly,
			// Not the whole limits object: the monthly credit allowance stays
			// server-side, since the page describes plans by what they do.
			limits: {
				profiles: p.limits.profiles,
				resumeVersions: p.limits.resumeVersions,
				maxDocumentProjects: p.limits.maxDocumentProjects,
				maxDocumentBytes: p.limits.maxDocumentBytes,
				extraCredits: p.limits.extraCredits
			},
			usageExample: p.usageExample
		})),
		extraUsageFromEuro: extraUsage?.amountsEuro[0] ?? null,
		// In euros of extra usage, so the page never shows a credit. No extra
		// usage (self-hosted) means nothing to price, and the stub has no rows.
		costExamples: extraUsage
			? Object.values(CREDIT_COST_EXAMPLES as Record<string, CostExample>).map((c) => ({
					label: c.label,
					euros: c.avgCredits / extraUsage.creditsPerEuro
				}))
			: [],
		signedIn: !!locals.user,
		registrationOpen: registrationOpen()
	};
};
