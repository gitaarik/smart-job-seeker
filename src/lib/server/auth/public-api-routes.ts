/**
 * API routes the session gate in hooks.server.ts lets through, because they
 * authenticate their callers themselves. Everything else under /api/ needs a
 * signed-in, approved user.
 *
 * An entry exempts itself and every path below it, matched by path segment:
 * '/api/mcp' covers /api/mcp/upload but not /api/mcpx. Its own check is then
 * the only thing between it and the internet, so add a route here only when
 * its handler refuses a caller by itself, including when its secret is not
 * configured.
 *
 * The gate did not run at all before 2026-08-27 (oss 67b3064f, first shipped in
 * v0.25.0): an earlier return in the hook ended every request first. Routes
 * that were only ever called without a session therefore worked until then and
 * got a 401 afterwards. The email webhook, the debug API and the Stripe webhook
 * below were added on 2026-09-24 for that reason; the login-code relay had
 * received nothing since.
 *
 * '/api/jobs/import' stood here for two device-key import endpoints, deleted
 * 2026-09-24, and also let /api/jobs/import/suggest skip the approval and
 * pending-deletion checks that follow the gate: an entry covers everything
 * under it.
 */
export const PUBLIC_API_ROUTES = [
	// Better Auth handles its own auth.
	'/api/auth',
	// The MCP server. Authenticates on an Authorization bearer token against
	// `mcp_keys`, a separate table from the device keys in `api_keys`,
	// deliberately, so that neither kind of credential can be presented where
	// the other belongs.
	'/api/mcp',
	// Inbound email from EmailConnect and Mailgun, and preview's re-broadcast of
	// it to dev: each provider's signature when its key is configured, the shared
	// broadcast secret for a relayed copy.
	'/api/email/inbound',
	// A Bearer DEBUG_API_KEY; 503 when none is configured.
	'/api/debug',
	// Stripe's signature, checked by cloud's billing overlay; the OSS stub is a 404.
	'/api/webhooks/stripe'
] as const;

export function isPublicApiRoute(pathname: string): boolean {
	return PUBLIC_API_ROUTES.some((route) => pathname === route || pathname.startsWith(`${route}/`));
}
