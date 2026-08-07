/**
 * Sentry/GlitchTip initialization for server-side (SvelteKit + Worker)
 *
 * Reads SENTRY_DSN from environment. If not set, Sentry is disabled.
 * Environment name is derived from SJS_APP_URL_HOST.
 */

import * as Sentry from '@sentry/sveltekit';
import { isFrameworkClientError } from '$lib/monitoring/sentry-filters';

function getEnvironmentName(): string {
	const host = process.env.SJS_APP_URL_HOST || '';
	if (host.includes('preview.')) return 'preview';
	if (host.includes('dev.')) return 'development';
	if (host.includes('www.') || host.includes('smartjobseeker.com')) return 'production';
	return 'development';
}

let initialized = false;

export function initSentry(component: 'sveltekit' | 'worker') {
	const dsn = process.env.SENTRY_DSN;
	if (!dsn || initialized) return;

	Sentry.init({
		dsn,
		environment: getEnvironmentName(),
		serverName: component,
		tracesSampleRate: 0,
		beforeSend(event) {
			const value = event.exception?.values?.[0]?.value;
			return isFrameworkClientError(value) ? null : event;
		}
	});

	initialized = true;
}

export { Sentry };
