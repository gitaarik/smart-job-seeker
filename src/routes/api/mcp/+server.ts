/**
 * POST /api/mcp — the Model Context Protocol server.
 *
 * One endpoint, JSON-RPC over POST, no session. See `mcp/protocol.ts` for why
 * it is hand-written and stateless, and `mcp/tiers.ts` for what a call is
 * allowed to do once it gets here.
 *
 * This route is in `PUBLIC_API_ROUTES` because it does its own authentication —
 * a bearer token against `mcp_keys`, which is a different table from the device
 * keys and cannot be satisfied by one.
 */

import type { RequestHandler } from './$types';
import { createRateLimitResponse, mcpRateLimiter } from '$lib/server/middleware/rate-limit';
import { callTool } from '$lib/server/mcp/call';
import { verifyMcpKey, type VerifiedMcpKey } from '$lib/server/mcp/keys';
import {
	isNotification,
	isRpcRequest,
	PROTOCOL_VERSION,
	rpcError,
	rpcResult,
	RPC,
	SERVER_INFO,
	type RpcRequest,
	type RpcResponse
} from '$lib/server/mcp/protocol';
import { toolsFor } from '$lib/server/mcp/tools';

/**
 * The bearer token, and only the bearer token.
 *
 * No cookie fallback. A browser sending credentials automatically is how a page
 * on another origin gets to make authenticated calls, and this endpoint's whole
 * job is writing to a profile. A client that has no key does not get in by
 * happening to be logged in.
 */
function bearer(request: Request): string | null {
	const header = request.headers.get('authorization');
	if (!header) return null;
	const [scheme, ...rest] = header.split(' ');
	if (scheme.toLowerCase() !== 'bearer') return null;
	const token = rest.join(' ').trim();
	return token || null;
}

/**
 * 401 with a `WWW-Authenticate` header, as the MCP authorization spec expects.
 *
 * Deliberately says nothing about *why*. Unknown, revoked, expired and
 * bound-to-a-deleted-profile are one answer, because an agent that can tell
 * them apart can enumerate which keys exist.
 */
function unauthorized(): Response {
	return new Response(JSON.stringify({ error: 'invalid_token' }), {
		status: 401,
		headers: {
			'content-type': 'application/json',
			'www-authenticate': 'Bearer realm="smart-job-seeker"'
		}
	});
}

async function handleMessage(
	message: RpcRequest,
	key: VerifiedMcpKey
): Promise<RpcResponse | null> {
	const id = message.id ?? null;

	switch (message.method) {
		case 'initialize':
			return rpcResult(id, {
				protocolVersion: PROTOCOL_VERSION,
				// Tools only. No `resources`, no `prompts`, and no `completions` —
				// declaring a capability this server does not implement is how a client
				// ends up calling a method that 404s mid-conversation.
				capabilities: { tools: { listChanged: false } },
				serverInfo: SERVER_INFO,
				instructions:
					`This server reads and changes one job applicant's profile — the one this ` +
					`key is bound to. Call list_profile_sections first: it returns the profile ` +
					`id every other tool needs.\n\n` +
					`Changes that overwrite something the applicant wrote, and changes that hide ` +
					`an entry, are not applied by you. They are recorded and the applicant ` +
					`approves them in their own app. There is no tool that approves one, and ` +
					`asking again will not help — say it is waiting and carry on.\n\n` +
					`Do not invent history. Rewording what the applicant has said is in scope; ` +
					`adding a role, a date or an employer they have not told you about is not.`
			});

		case 'ping':
			return rpcResult(id, {});

		case 'tools/list':
			return rpcResult(id, { tools: toolsFor(key.scope) });

		case 'tools/call': {
			const params = message.params ?? {};
			const name = params.name;
			if (typeof name !== 'string') {
				return rpcError(id, RPC.INVALID_PARAMS, 'A tool name is required.');
			}

			const args =
				typeof params.arguments === 'object' && params.arguments !== null
					? (params.arguments as Record<string, unknown>)
					: {};

			try {
				return rpcResult(id, await callTool(name, args, key));
			} catch (e) {
				// A thrown error here is ours, not the caller's: every refusal the agent
				// could act on is already returned as an `isError` tool result. So this
				// is logged and answered generically rather than reflected back, which
				// would put stack frames and column names in a third party's transcript.
				console.error(`[mcp] ${name} failed`, e);
				return rpcError(id, RPC.INTERNAL_ERROR, 'That call could not be completed.');
			}
		}

		default:
			// A notification for an unimplemented method is simply dropped — the spec
			// forbids replying to one at all, and `notifications/initialized` arrives
			// on every connection.
			if (isNotification(message)) return null;
			return rpcError(id, RPC.METHOD_NOT_FOUND, `Unknown method "${message.method}".`);
	}
}

export const POST: RequestHandler = async ({ request }) => {
	const token = bearer(request);
	if (!token) return unauthorized();

	const key = await verifyMcpKey(token);
	if (!key) return unauthorized();

	// Keyed on the credential rather than the address: an agent and its user
	// share an IP, and one runaway client must not starve the others on it.
	if (!mcpRateLimiter.tryConsumeKey(`mcp:${key.keyId}`)) {
		return createRateLimitResponse(mcpRateLimiter.retryAfterSeconds());
	}

	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return new Response(JSON.stringify(rpcError(null, RPC.PARSE_ERROR, 'Invalid JSON.')), {
			status: 400,
			headers: { 'content-type': 'application/json' }
		});
	}

	// A batch is an array. Answering one is not: a batch of only notifications
	// gets 202 with no body, which is what tells a client its notification was
	// accepted rather than ignored.
	const messages = Array.isArray(body) ? body : [body];
	if (messages.length === 0) {
		return new Response(JSON.stringify(rpcError(null, RPC.INVALID_REQUEST, 'Empty batch.')), {
			status: 400,
			headers: { 'content-type': 'application/json' }
		});
	}

	const responses: RpcResponse[] = [];
	for (const message of messages) {
		if (!isRpcRequest(message)) {
			responses.push(rpcError(null, RPC.INVALID_REQUEST, 'Not a JSON-RPC 2.0 request.'));
			continue;
		}
		// Sequentially, not in parallel: two writes in one batch against the same
		// row would otherwise each read the current values before the other wrote,
		// and both would record a before-image of the same original.
		const response = await handleMessage(message, key);
		if (response) responses.push(response);
	}

	if (responses.length === 0) {
		return new Response(null, { status: 202 });
	}

	return new Response(JSON.stringify(Array.isArray(body) ? responses : responses[0]), {
		status: 200,
		headers: { 'content-type': 'application/json' }
	});
};

/**
 * GET is where a client would open the server→client SSE stream. There isn't
 * one — see `mcp/protocol.ts`. 405 with `Allow` is the spec's answer for a
 * server that does not offer it, and it is what stops a client waiting on a
 * stream that will never carry anything.
 */
export const GET: RequestHandler = async () =>
	new Response(JSON.stringify({ error: 'This server does not stream. POST JSON-RPC instead.' }), {
		status: 405,
		headers: { 'content-type': 'application/json', allow: 'POST' }
	});
