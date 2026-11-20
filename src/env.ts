import { defineEnvVars } from '@sveltejs/kit/env';

/**
 * Environment variables read through `$app/env/public` and `$app/env/private`.
 *
 * Server config is read with `getEnv` (`#lib/tools/get-env.ts`) and is not
 * listed here; only what SvelteKit has to hand to the browser is.
 */
export const variables = defineEnvVars({
	PUBLIC_SENTRY_DSN: {
		public: true,
		description:
			'Browser-side Sentry DSN. Dynamic (the default), so one image reports to whichever DSN its environment sets. Unset turns browser reporting off.',
		schema: (input) => input
	}
});
