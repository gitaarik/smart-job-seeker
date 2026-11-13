/**
 * POST /api/mcp — tool calls against the user's MCP allowance.
 *
 * What counts is a `tools/call` that worked: the handshake, the tool list and
 * the agent's own mistakes are free, or an agent retrying a bad argument burns
 * the allowance. Over the allowance is a tool result the agent reads, never an
 * RPC error a client might swallow. See planning/MCP-FREE-ALLOWANCE.md in
 * sjs-ops.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const callTool = vi.fn();
const checkMcpAllowance = vi.fn();
const recordMcpCall = vi.fn();

vi.mock('$lib/server/mcp/keys', () => ({
	verifyMcpKey: async () => ({
		keyId: 7,
		userId: 'user-1',
		profileId: 12,
		scope: 'propose',
		readScope: 'record',
		name: 'Claude Desktop'
	}),
	recordMcpClient: vi.fn()
}));

vi.mock('$lib/server/mcp/call', () => ({ callTool: (...a: unknown[]) => callTool(...a) }));

vi.mock('$lib/server/billing/require-mcp-allowance', () => ({
	checkMcpAllowance: (...a: unknown[]) => checkMcpAllowance(...a),
	recordMcpCall: (...a: unknown[]) => recordMcpCall(...a)
}));

vi.mock('$lib/server/mcp/tools', () => ({
	instructionsFor: () => 'instructions',
	toolsFor: async () => []
}));

vi.mock('$lib/server/middleware/rate-limit', () => ({
	mcpRateLimiter: { tryConsumeKey: () => true, retryAfterSeconds: () => 1 },
	createRateLimitResponse: vi.fn()
}));

const { POST } = await import('../+server');

async function post(body: unknown) {
	const request = new Request('https://dev.example.com/api/mcp', {
		method: 'POST',
		headers: { authorization: 'Bearer sjsmcp_abc', 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
	const res = await POST({ request, url: new URL(request.url) } as unknown as Parameters<
		typeof POST
	>[0]);
	return res.json();
}

function call(name = 'get_profile') {
	return post({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: {} } });
}

const okResult = { content: [{ type: 'text', text: 'done' }] };

beforeEach(() => {
	callTool.mockReset().mockResolvedValue(okResult);
	checkMcpAllowance.mockReset().mockResolvedValue({ allowed: true, note: null });
	recordMcpCall.mockReset().mockResolvedValue(undefined);
	vi.spyOn(console, 'log').mockImplementation(() => {});
	vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('counting', () => {
	it('counts a call that worked against the user, not the key', async () => {
		const body = await call();

		expect(body.result).toEqual(okResult);
		expect(recordMcpCall).toHaveBeenCalledWith('user-1');
	});

	it('does not count a call that came back isError', async () => {
		callTool.mockResolvedValue({ content: [{ type: 'text', text: 'bad id' }], isError: true });

		await call();

		expect(recordMcpCall).not.toHaveBeenCalled();
	});

	it('does not count a call that threw', async () => {
		callTool.mockRejectedValue(new Error('boom'));

		const body = await call();

		expect(body.error).toBeDefined();
		expect(recordMcpCall).not.toHaveBeenCalled();
	});

	it('does not count the handshake, the tool list or a ping', async () => {
		await post({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} });
		await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
		await post({ jsonrpc: '2.0', id: 3, method: 'ping' });

		expect(checkMcpAllowance).not.toHaveBeenCalled();
		expect(recordMcpCall).not.toHaveBeenCalled();
	});

	it('still answers when the counter fails to write', async () => {
		recordMcpCall.mockRejectedValue(new Error('db down'));

		const body = await call();

		expect(body.result).toEqual(okResult);
	});
});

describe('the allowance', () => {
	it('checks with the request origin, for the billing link', async () => {
		await call();

		expect(checkMcpAllowance).toHaveBeenCalledWith('user-1', 'https://dev.example.com');
	});

	it('answers a refusal as an isError tool result, without running or counting the call', async () => {
		checkMcpAllowance.mockResolvedValue({ allowed: false, message: 'Out of actions.' });

		const body = await call();

		expect(body.error).toBeUndefined();
		expect(body.result).toEqual({
			content: [{ type: 'text', text: 'Out of actions.' }],
			isError: true
		});
		expect(callTool).not.toHaveBeenCalled();
		expect(recordMcpCall).not.toHaveBeenCalled();
	});

	it('appends the note to a call that worked', async () => {
		checkMcpAllowance.mockResolvedValue({ allowed: true, note: '50 left.' });

		const body = await call();

		expect(body.result.content).toEqual([
			{ type: 'text', text: 'done' },
			{ type: 'text', text: '50 left.' }
		]);
	});

	it('leaves the note off a call that failed', async () => {
		checkMcpAllowance.mockResolvedValue({ allowed: true, note: '50 left.' });
		const failed = { content: [{ type: 'text', text: 'bad id' }], isError: true };
		callTool.mockResolvedValue(failed);

		const body = await call();

		expect(body.result).toEqual(failed);
	});
});
