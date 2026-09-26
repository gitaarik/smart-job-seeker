/**
 * Unit tests for AI chat utilities
 * Tests prompt interpolation of stored chats
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getInterpolatedPrompts } from '../ai-chat/utils';

// Mock the Drizzle db module
vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			ai_chats: {
				findFirst: vi.fn()
			},
			collected_data: {
				findFirst: vi.fn()
			}
		}
	}
}));

import { db } from '$lib/server/db';
import { findFirst } from './db-mocks';

describe('getInterpolatedPrompts', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('should return null if ai_chats not found', async () => {
		findFirst(db.query.ai_chats).mockResolvedValueOnce(null);

		const result = await getInterpolatedPrompts(999);

		expect(result).toBeNull();
		expect(db.query.ai_chats.findFirst).toHaveBeenCalled();
	});

	it('should interpolate prompts with schema and data from collected_data', async () => {
		const mockAiChat = {
			system_prompt: 'System: ${schema} - ${data}',
			user_prompt: 'User: ${schema} - ${data}',
			profile_id: 1
		};

		const mockCollectedData = {
			schema: '{"type": "object"}',
			data: '{"name": "John"}'
		};

		findFirst(db.query.ai_chats).mockResolvedValueOnce(mockAiChat);
		findFirst(db.query.collected_data).mockResolvedValueOnce(mockCollectedData);
		const result = await getInterpolatedPrompts(1);

		expect(result).toEqual({
			systemPrompt: 'System: {"type": "object"} - {"name": "John"}',
			userPrompt: 'User: {"type": "object"} - {"name": "John"}',
			promptKey: null,
			promptFingerprint: null
		});
	});

	it('should use empty objects as defaults when collected_data not found', async () => {
		const mockAiChat = {
			system_prompt: 'Schema: ${schema}\nData: ${data}',
			user_prompt: 'Show me ${schema} and ${data}',
			profile_id: 1
		};

		findFirst(db.query.ai_chats).mockResolvedValueOnce(mockAiChat);
		findFirst(db.query.collected_data).mockResolvedValueOnce(null);
		const result = await getInterpolatedPrompts(1);

		expect(result).toEqual({
			systemPrompt: 'Schema: {}\nData: {}',
			userPrompt: 'Show me {} and {}',
			promptKey: null,
			promptFingerprint: null
		});
	});

	it('should handle null schema and data with empty object defaults', async () => {
		const mockAiChat = {
			system_prompt: '${schema} ${data}',
			user_prompt: '${schema} ${data}',
			profile_id: 1
		};

		const mockCollectedData = {
			schema: null,
			data: null
		};

		findFirst(db.query.ai_chats).mockResolvedValueOnce(mockAiChat);
		findFirst(db.query.collected_data).mockResolvedValueOnce(mockCollectedData);
		const result = await getInterpolatedPrompts(1);

		expect(result).toEqual({
			systemPrompt: '{} {}',
			userPrompt: '{} {}',
			promptKey: null,
			promptFingerprint: null
		});
	});

	it('should call collected_data.findFirst with correct profile ID', async () => {
		const profileId = 42;

		findFirst(db.query.ai_chats).mockResolvedValueOnce({
			system_prompt: '${schema}',
			user_prompt: '${data}',
			profile_id: profileId
		});

		findFirst(db.query.collected_data).mockResolvedValueOnce({
			schema: '{}',
			data: '{}'
		});

		await getInterpolatedPrompts(1);

		expect(db.query.collected_data.findFirst).toHaveBeenCalled();
	});

	it('should correctly replace multiple occurrences of both schema and data', async () => {
		const mockAiChat = {
			system_prompt:
				'Use ${schema} to understand the structure of ${data}. The ${schema} is important for ${data}.',
			user_prompt: 'I have ${data} which matches ${schema}',
			profile_id: 1
		};

		const mockCollectedData = {
			schema: 'SCHEMA_VALUE',
			data: 'DATA_VALUE'
		};

		findFirst(db.query.ai_chats).mockResolvedValueOnce(mockAiChat);
		findFirst(db.query.collected_data).mockResolvedValueOnce(mockCollectedData);
		const result = await getInterpolatedPrompts(1);

		expect(result?.systemPrompt).toBe(
			'Use SCHEMA_VALUE to understand the structure of DATA_VALUE. The SCHEMA_VALUE is important for DATA_VALUE.'
		);
		expect(result?.userPrompt).toBe('I have DATA_VALUE which matches SCHEMA_VALUE');
	});

	describe('held-back skills', () => {
		// One skill the applicant keeps off their documents, one they don't.
		const stored = JSON.stringify({
			tech_skill_categories: [
				{
					name: 'Languages',
					tech_skills: [{ name: 'Rust' }, { name: 'COBOL', profile_only: true }]
				}
			]
		});
		const render = async (prompt_key: string | null) => {
			findFirst(db.query.ai_chats).mockResolvedValueOnce({
				system_prompt: '${data}',
				user_prompt: 'go',
				profile_id: 1,
				prompt_key
			});
			findFirst(db.query.collected_data).mockResolvedValueOnce({ schema: '{}', data: stored });
			return getInterpolatedPrompts(1);
		};

		it('keeps them out of a writing prompt', async () => {
			const result = await render('write_cover_letter');
			expect(result?.systemPrompt).toContain('Rust');
			expect(result?.systemPrompt).not.toContain('COBOL');
			expect(result?.promptKey).toBe('write_cover_letter');
		});

		it('keeps them in a prompt that analyses the applicant, as the original call did', async () => {
			const result = await render('score_job_match');
			expect(result?.systemPrompt).toContain('COBOL');
			expect(result?.systemPrompt).not.toContain('profile_only');
		});

		it('keeps them out when the row predates prompt_key and cannot say', async () => {
			const result = await render(null);
			expect(result?.systemPrompt).not.toContain('COBOL');
			expect(result?.promptKey).toBeNull();
		});
	});
});
