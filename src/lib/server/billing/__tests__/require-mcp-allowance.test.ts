/**
 * The oss MCP allowance stub: self-hosted is unlimited, but still counts, per
 * calendar month.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

const countMcpCall = vi.fn();
vi.mock('$lib/server/mcp/usage', () => ({
	countMcpCall: (...a: unknown[]) => countMcpCall(...a)
}));

import { checkMcpAllowance, recordMcpCall } from '../require-mcp-allowance';

afterEach(() => {
	vi.useRealTimers();
	countMcpCall.mockReset();
});

describe('oss MCP allowance stub', () => {
	it('never refuses and never adds a note', async () => {
		expect(await checkMcpAllowance('user-1', 'http://localhost')).toEqual({
			allowed: true,
			note: null
		});
	});

	it('counts a call against the calendar month', async () => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date('2026-11-13T12:00:00Z'));

		await recordMcpCall('user-1');

		expect(countMcpCall).toHaveBeenCalledWith('user-1', '2026-11');
	});
});
