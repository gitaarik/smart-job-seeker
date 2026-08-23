import * as Sentry from '@sentry/sveltekit';
import { env } from '$env/dynamic/public';
import { isFrameworkClientError } from '$lib/monitoring/sentry-filters';

/**
 * Read through `$env/dynamic/public`, NOT `import.meta.env`.
 *
 * SvelteKit does not point Vite's `envPrefix` at `PUBLIC_`, so
 * `import.meta.env` carries only Vite's own keys — on this app it is exactly
 * `BASE_URL`, `DEV`, `MODE`, `PROD`, `SSR`, `VITE_USER_NODE_ENV`. Reading
 * `import.meta.env.PUBLIC_SENTRY_DSN` therefore yielded `undefined` no matter
 * how the variable was supplied, `Sentry.init` never ran, and `handleError`
 * was `undefined`. Every browser-side error since this file was written went
 * nowhere: 450 events in GlitchTip, all of them `platform: node`, not one
 * from a browser in any environment.
 *
 * It failed silently in the shape that hides longest — the container env had
 * the DSN, the SDK was installed, the CSP allowed the host, and the server
 * half of the same integration was reporting normally.
 *
 * The dynamic form reads the value SvelteKit serializes into the page from the
 * server's own environment, so one image picks up whichever DSN its
 * environment sets, and nothing has to be known at build time.
 */
const dsn = env.PUBLIC_SENTRY_DSN;

if (dsn) {
	const host = window.location.hostname;
	const environment = host.includes('preview.')
		? 'preview'
		: host.includes('dev.')
			? 'development'
			: host.includes('www.')
				? 'production'
				: 'development';

	Sentry.init({
		dsn,
		environment,
		tracesSampleRate: 0,
		beforeSend(event) {
			const value = event.exception?.values?.[0]?.value;
			return isFrameworkClientError(value) ? null : event;
		}
	});
}

export const handleError = dsn ? Sentry.handleErrorWithSentry() : undefined;
