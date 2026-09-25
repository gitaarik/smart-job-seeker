/**
 * POST /api/mcp — the handshake, and what it leaves behind.
 *
 * `initialize` is the one message in which a client says what it is, and
 * Connected Apps shows that next to the key. The rest of a session is tool
 * calls that say nothing about the client, so they must not touch the record
 * `initialize` wrote, and a request that did not verify must not write one.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const verifyMcpKey = vi.fn();
const recordMcpClient = vi.fn();

vi.mock('$lib/server/mcp/keys', () => ({
	verifyMcpKey: (...a: unknown[]) => verifyMcpKey(...a),
	recordMcpClient: (...a: unknown[]) => recordMcpClient(...a)
}));

vi.mock('$lib/server/mcp/call', () => ({ callTool: vi.fn() }));

vi.mock('$lib/server/mcp/tools', () => ({
	instructionsFor: () => 'instructions',
	toolsFor: async () => []
}));

vi.mock('$lib/server/middleware/rate-limit', () => ({
	mcpRateLimiter: { tryConsumeKey: () => true, retryAfterSeconds: () => 1 },
	createRateLimitResponse: vi.fn()
}));

const { POST } = await import('../+server');

function post(body: unknown) {
	const request = new Request('http://localhost/api/mcp', {
		method: 'POST',
		headers: { authorization: 'Bearer sjsmcp_abc', 'content-type': 'application/json' },
		body: JSON.stringify(body)
	});
	return POST({ request } as unknown as Parameters<typeof POST>[0]);
}

const clientInfo = { name: 'Claude Code', version: '2.1.282' };

beforeEach(() => {
	verifyMcpKey.mockReset();
	recordMcpClient.mockReset();
	verifyMcpKey.mockResolvedValue({
		keyId: 7,
		userId: 'user-1',
		profileId: 12,
		scope: 'propose',
		readScope: 'record',
		name: 'Claude Desktop'
	});
});

describe('initialize', () => {
	it('records what the client says it is against the key it used', async () => {
		const res = await post({
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo }
		});

		expect(res.status).toBe(200);
		expect(recordMcpClient).toHaveBeenCalledWith(7, clientInfo);
	});

	it('leaves the record alone on every other call', async () => {
		await post({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
		await post({ jsonrpc: '2.0', id: 3, method: 'ping' });
		await post({ jsonrpc: '2.0', method: 'notifications/initialized' });

		expect(recordMcpClient).not.toHaveBeenCalled();
	});

	it('records nothing for a key that did not verify', async () => {
		verifyMcpKey.mockResolvedValue(null);

		const res = await post({
			jsonrpc: '2.0',
			id: 1,
			method: 'initialize',
			params: { clientInfo }
		});

		expect(res.status).toBe(401);
		expect(recordMcpClient).not.toHaveBeenCalled();
	});
});
