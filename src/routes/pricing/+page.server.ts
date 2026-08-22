import type { PageServerLoad } from './$types';
import { getPlans, CREDIT_COST_EXAMPLES, getCreditPacks } from '$lib/server/billing/plans';
import { registrationOpen } from '$lib/server/auth/registration';

/**
 * One row of the "what a credit buys" table.
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
	return {
		plans: getPlans().map((p) => ({
			id: p.id,
			name: p.name,
			description: p.description,
			priceMonthly: p.priceMonthly,
			limits: p.limits,
			usageExample: p.usageExample
		})),
		creditPacks: getCreditPacks().map((c) => ({
			name: c.name,
			description: c.description,
			priceCents: c.priceCents,
			credits: c.credits
		})),
		costExamples: Object.values(CREDIT_COST_EXAMPLES as Record<string, CostExample>),
		signedIn: !!locals.user,
		registrationOpen: registrationOpen()
	};
};
