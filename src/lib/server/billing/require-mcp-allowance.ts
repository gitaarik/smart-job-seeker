/**
 * MCP allowance stub — OSS version (never refuses).
 * The cloud version overlays this with the per-plan allowance. Self-hosted
 * stays unlimited but still counts, per calendar month.
 * See planning/MCP-FREE-ALLOWANCE.md in sjs-ops.
 */

import { countMcpCall } from '$lib/server/mcp/usage';

/**
 * Whether a tool call may run. A refusal carries the text the agent should
 * read and pass on; an allowed call may carry a one-line note for the user,
 * appended to its result.
 */
export type McpAllowance =
	{ allowed: true; note: string | null } | { allowed: false; message: string };

/**
 * Check the user's allowance before a tool call.
 * @param origin the request's origin, for the billing link in a message
 */
export async function checkMcpAllowance(_userId: string, _origin: string): Promise<McpAllowance> {
	return { allowed: true, note: null };
}

/** Count a tool call that did not come back `isError`. */
export async function recordMcpCall(userId: string): Promise<void> {
	await countMcpCall(userId, new Date().toISOString().slice(0, 7));
}
