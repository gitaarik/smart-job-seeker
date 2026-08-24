/**
 * Tests for demo provisioning — specifically the job-match copy that keeps a
 * clone from re-scoring the whole corpus (the matcher treats a missing
 * job_matches row as work, so a clone without rows costs ~2 LLM calls per
 * corpus job). The SQL is rendered through drizzle's own pg dialect so the
 * assertions pin what would actually be sent, not a hand-built string.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import type { SQL } from 'drizzle-orm';

const {
	mockQueryRawDirect,
	mockBuildProfileExport,
	mockImportExportData,
	mockBuildSettingsExport,
	mockImportSettings
} = vi.hoisted(() => ({
	mockQueryRawDirect: vi.fn(),
	mockBuildProfileExport: vi.fn(),
	mockImportExportData: vi.fn(),
	mockBuildSettingsExport: vi.fn(),
	mockImportSettings: vi.fn()
}));

vi.mock('$lib/server/db', async () => {
	const { sql } = await import('drizzle-orm');
	return {
		dbDirect: {},
		queryRawDirect: mockQueryRawDirect,
		sql
	};
});

vi.mock('$lib/server/auth/better-auth', () => ({ auth: { api: {} } }));
vi.mock('$lib/tools/get-env', () => ({ getEnv: vi.fn(() => 'test-secret') }));
vi.mock('$lib/server/device-shares', () => ({ insertDeviceShare: vi.fn() }));
vi.mock('$lib/server/export', () => ({
	buildProfileExport: mockBuildProfileExport,
	buildSettingsExport: mockBuildSettingsExport,
	importExportData: mockImportExportData,
	importSettings: mockImportSettings
}));

import { cloneProfileInto, copyJobMatches } from '../provision';

function renderSql(query: SQL): { sql: string; params: unknown[] } {
	const rendered = new PgDialect().sqlToQuery(query);
	return { sql: rendered.sql, params: rendered.params };
}

describe('copyJobMatches', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('copies with one INSERT…SELECT re-keyed to the target and returns the row count', async () => {
		mockQueryRawDirect.mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]);

		const copied = await copyJobMatches(5, 9);

		expect(copied).toBe(3);
		expect(mockQueryRawDirect).toHaveBeenCalledTimes(1);
		const { sql, params } = renderSql(mockQueryRawDirect.mock.calls[0][0]);
		expect(sql).toMatch(/INSERT INTO job_matches/);
		expect(sql).toMatch(/FROM job_matches src/);
		expect(sql).toMatch(/RETURNING id/);
		// Placeholder order: target (SELECT's profile_id), source (WHERE),
		// target again (NOT EXISTS) — a swap here would copy the wrong way.
		expect(params).toEqual([9, 5, 9]);
	});

	it('returns 0 when the source has no matches (or all pairs already exist)', async () => {
		mockQueryRawDirect.mockResolvedValueOnce([]);

		await expect(copyJobMatches(5, 9)).resolves.toBe(0);
	});

	it('skips pairs the target already has, so overwrite re-clones stay additive', async () => {
		mockQueryRawDirect.mockResolvedValueOnce([]);

		await copyJobMatches(5, 9);

		const { sql } = renderSql(mockQueryRawDirect.mock.calls[0][0]);
		expect(sql).toMatch(/NOT EXISTS/);
		expect(sql).toMatch(/dst\.profile_id = \$\d+/);
		expect(sql).toMatch(/dst\.job_id = src\.job_id/);
	});

	it('folds duplicate source rows to the freshest per job', async () => {
		mockQueryRawDirect.mockResolvedValueOnce([]);

		await copyJobMatches(5, 9);

		const { sql } = renderSql(mockQueryRawDirect.mock.calls[0][0]);
		expect(sql).toMatch(/SELECT DISTINCT ON \(src\.job_id\)/);
		expect(sql).toMatch(/ORDER BY src\.job_id, src\.date_updated DESC NULLS LAST/);
	});

	it("nulls the source's LLM-log link and any pending re-score request", async () => {
		mockQueryRawDirect.mockResolvedValueOnce([]);

		await copyJobMatches(5, 9);

		const { sql } = renderSql(mockQueryRawDirect.mock.calls[0][0]);
		// ai_chat_scoring slot: between llm_prompt and matched_skills.
		expect(sql).toMatch(/src\.llm_prompt,\s*NULL,\s*src\.matched_skills/);
		// rescore_requested_at slot: last in the select list.
		expect(sql).toMatch(/src\.match_summary,\s*NULL\s*FROM job_matches src/);
	});
});

describe('cloneProfileInto', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('copies the source matches to the imported profile before settings apply the match config', async () => {
		mockBuildProfileExport.mockResolvedValueOnce({ data: { profile: {} } });
		mockImportExportData.mockResolvedValueOnce({ profileId: 42 });
		mockBuildSettingsExport.mockResolvedValueOnce({ tasks: [] });
		mockImportSettings.mockResolvedValueOnce(undefined);
		mockQueryRawDirect.mockResolvedValueOnce([{ id: 1 }]);

		const profileId = await cloneProfileInto(7, 'user-1');

		expect(profileId).toBe(42);
		const { params } = renderSql(mockQueryRawDirect.mock.calls[0][0]);
		expect(params).toEqual([42, 7, 42]);
		// The matcher treats a configured profile with missing rows as work, so
		// the copy must land between the profile import and the settings import.
		expect(mockQueryRawDirect.mock.invocationCallOrder[0]).toBeGreaterThan(
			mockImportExportData.mock.invocationCallOrder[0]
		);
		expect(mockQueryRawDirect.mock.invocationCallOrder[0]).toBeLessThan(
			mockImportSettings.mock.invocationCallOrder[0]
		);
	});
});
