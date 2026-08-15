/**
 * The MCP wire protocol, hand-written.
 *
 * ## Why not the SDK
 *
 * `@modelcontextprotocol/sdk`'s HTTP transport wants Node's `req`/`res`, and a
 * SvelteKit endpoint has a `Request` and returns a `Response` — reaching the
 * raw objects means going around the adapter, which is the sort of thing that
 * works until a deploy target changes. What is left once you subtract the
 * transport is JSON-RPC 2.0 with four methods, which is this file.
 *
 * The dependency also lands in a public repository with a CI that does not run
 * `vite build`, so a dependency that breaks the bundle is not caught before a
 * release image is built. That is a lesson this project has already paid for
 * once, with a pinned kysely.
 *
 * ## Stateless on purpose
 *
 * No `Mcp-Session-Id`, no server-initiated requests, no SSE. Every POST is
 * self-contained and authenticated by its own header, so any app node can serve
 * any call. The alternative is a session map in one process's memory, which is
 * exactly what the port-9333 tunnel registry is and exactly why this app cannot
 * currently run two application nodes behind a load balancer. Adding a second
 * instance of that problem to buy an inline confirmation dialog is a bad trade;
 * see the note in `call.ts`.
 *
 * The consequence, stated plainly: this server cannot elicit, sample, or send
 * notifications. It answers what it is asked and nothing else.
 */

/**
 * The revision this server implements.
 *
 * Echoed back at initialize rather than negotiated: what is implemented here —
 * tools, and nothing else — has been stable across revisions, and claiming to
 * negotiate a version whose features are not implemented either way would be a
 * claim rather than a capability.
 */
export const PROTOCOL_VERSION = '2025-06-18';

export const SERVER_INFO = {
	name: 'smart-job-seeker',
	title: 'Smart Job Seeker profile',
	version: '1.0.0'
} as const;

/** JSON-RPC error codes. The last is ours; the rest are the spec's. */
export const RPC = {
	PARSE_ERROR: -32700,
	INVALID_REQUEST: -32600,
	METHOD_NOT_FOUND: -32601,
	INVALID_PARAMS: -32602,
	INTERNAL_ERROR: -32603
} as const;

export type RpcId = string | number | null;

export interface RpcRequest {
	jsonrpc: '2.0';
	id?: RpcId;
	method: string;
	params?: Record<string, unknown>;
}

export interface RpcResponse {
	jsonrpc: '2.0';
	id: RpcId;
	result?: unknown;
	error?: { code: number; message: string; data?: unknown };
}

export function rpcResult(id: RpcId, result: unknown): RpcResponse {
	return { jsonrpc: '2.0', id, result };
}

export function rpcError(id: RpcId, code: number, message: string): RpcResponse {
	return { jsonrpc: '2.0', id, error: { code, message } };
}

/**
 * A message with no `id` is a notification: the spec forbids replying to one.
 *
 * `notifications/initialized` is the one that matters — every client sends it,
 * and answering it with a result is a protocol violation that some clients
 * treat as fatal.
 */
export function isNotification(message: RpcRequest): boolean {
	return message.id === undefined;
}

export function isRpcRequest(value: unknown): value is RpcRequest {
	if (typeof value !== 'object' || value === null) return false;
	const message = value as Record<string, unknown>;
	return message.jsonrpc === '2.0' && typeof message.method === 'string';
}
