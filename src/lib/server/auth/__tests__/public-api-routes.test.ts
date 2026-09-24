import { existsSync } from 'fs';
import { describe, expect, it } from 'vitest';
import { PUBLIC_API_ROUTES, isPublicApiRoute } from '../public-api-routes';

describe('isPublicApiRoute', () => {
	it.each([
		'/api/email/inbound',
		'/api/debug/queue',
		'/api/debug/run/42/screenshots/step-1.png',
		'/api/webhooks/stripe',
		'/api/mcp',
		'/api/mcp/upload',
		'/api/auth/sign-in/email',
		'/api/verify-turnstile'
	])('lets %s through to its own check', (pathname) => {
		expect(isPublicApiRoute(pathname)).toBe(true);
	});

	it.each([
		'/api/contacts',
		'/api/email',
		'/api/email/inbound-extra',
		'/api/mcpx',
		'/api/debugger',
		'/api/webhooks/other',
		'/api/jobs/import/suggest',
		'/api/authorize'
	])('gates %s, which only shares a prefix with a public route', (pathname) => {
		expect(isPublicApiRoute(pathname)).toBe(false);
	});

	// A stale entry is how '/api/jobs/import' kept exempting a route nobody
	// meant to exempt after its own endpoints were deleted.
	it('lists only routes that exist', () => {
		const routeDirs = PUBLIC_API_ROUTES.filter((route) => route !== '/api/auth');
		for (const route of routeDirs) {
			expect(existsSync(`src/routes${route}`), route).toBe(true);
		}
	});
});
