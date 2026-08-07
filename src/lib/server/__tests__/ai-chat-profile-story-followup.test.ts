/**
 * Unit tests for profile-story-followup — the STAR project-story followup
 * wrapper. Mirrors ai-chat-application-question-followup.test.ts: covers the
 * plumbing (ownership hints, ref update, option pass-through, error paths). The
 * STAR parse→columns commit is exercised by star.test.ts + the generate path.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUpdateWhere = vi.fn().mockResolvedValue({});
const mockUpdateSet = vi.fn().mockReturnValue({ where: mockUpdateWhere });
const mockUpdateFn = vi.fn().mockReturnValue({ set: mockUpdateSet });

vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			project_stories: { findFirst: vi.fn() },
			story_versions: { findMany: vi.fn().mockResolvedValue([]) }
		},
		update: (...args: any[]) => mockUpdateFn(...args)
	}
}));

vi.mock('$lib/server/ai-chat/create-followup', () => ({
	createFollowupAiChat: vi.fn()
}));

// Shared version engine is covered by entity-versions.test.ts; stub the pieces
// the updateEntity callback touches so they're no-ops here.
vi.mock('$lib/server/ai-chat/entity-versions', () => ({
	STORY_VERSIONS: { fkName: 'story' },
	recordVersion: vi.fn().mockResolvedValue(undefined),
	ensureBaselineVersion: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('drizzle-orm', () => ({
	eq: vi.fn((_col: any, val: any) => val),
	and: vi.fn((...args: any[]) => args),
	asc: vi.fn(),
	desc: vi.fn()
}));

vi.mock('$lib/server/db/schema', () => ({
	project_stories: {
		id: 'project_stories.id',
		ai_chat_id: 'project_stories.ai_chat_id'
	},
	story_versions: {
		story: 'story_versions.story',
		id: 'story_versions.id',
		content: 'story_versions.content',
		user_request: 'story_versions.user_request',
		ai_feedback: 'story_versions.ai_feedback'
	}
}));

import { db } from '$lib/server/db';
import { createFollowupAiChat } from '$lib/server/ai-chat/create-followup';
import { createProfileStoryFollowup } from '../ai-chat/profile-story-followup';

describe('createProfileStoryFollowup', () => {
	const mockStory = { id: 200, ai_chat_id: 5 };
	const mockCreatedAiChat = {
		id: 6,
		profile_id: 456,
		system_prompt: 'Refine the story',
		user_prompt: 'Make the action punchier',
		full_prompt: 'System: Refine...\nUser: punchier',
		response: 'Refined story',
		date_created: new Date(),
		date_updated: new Date()
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockUpdateWhere.mockResolvedValue({});
		(db.query.story_versions.findMany as any).mockResolvedValue([]);
	});

	describe('validation', () => {
		it('errors if the story is not found', async () => {
			(db.query.project_stories.findFirst as any).mockResolvedValueOnce(null);
			const result = await createProfileStoryFollowup(999, 'Sharpen it');
			expect(result.success).toBe(false);
			expect(result.message).toContain('Project story with ID 999 not found');
		});

		it('errors if the story has no ai_chats yet', async () => {
			(db.query.project_stories.findFirst as any).mockResolvedValueOnce({
				id: 200,
				ai_chat_id: null
			});
			const result = await createProfileStoryFollowup(200, 'Sharpen it');
			expect(result.success).toBe(false);
			expect(result.message).toContain('does not have an ai_chats yet');
			expect(result.message).toContain('Generate the initial story first');
		});

		it('treats ai_chat_id = 0 as no thread', async () => {
			(db.query.project_stories.findFirst as any).mockResolvedValueOnce({
				id: 200,
				ai_chat_id: 0
			});
			const result = await createProfileStoryFollowup(200, 'Sharpen it');
			expect(result.success).toBe(false);
			expect(result.message).toContain('does not have an ai_chats yet');
		});
	});

	describe('successful followup', () => {
		it("creates the followup and updates the story's chat pointer", async () => {
			(db.query.project_stories.findFirst as any).mockResolvedValueOnce(mockStory);
			(createFollowupAiChat as any).mockResolvedValueOnce({
				success: true,
				message: 'created',
				aiChat: mockCreatedAiChat
			});

			const result = await createProfileStoryFollowup(200, 'Sharpen the action');

			expect(result.success).toBe(true);
			expect(result.aiChat?.id).toBe(6);
			expect(createFollowupAiChat).toHaveBeenCalledWith(
				5,
				'Sharpen the action',
				expect.objectContaining({ profileDataFields: expect.any(Array) })
			);
			expect(mockUpdateSet).toHaveBeenCalledWith(
				expect.objectContaining({
					ai_chat_id: 6,
					ai_chat_response: 'Refined story'
				})
			);
		});

		it('passes includeOriginalContext through', async () => {
			(db.query.project_stories.findFirst as any).mockResolvedValueOnce(mockStory);
			(createFollowupAiChat as any).mockResolvedValueOnce({
				success: true,
				message: 'created',
				aiChat: mockCreatedAiChat
			});

			await createProfileStoryFollowup(200, 'Shorter', true);

			expect(createFollowupAiChat).toHaveBeenCalledWith(
				5,
				'Shorter',
				expect.objectContaining({ includeOriginalContext: true })
			);
		});
	});

	describe('error handling', () => {
		it('surfaces a createFollowupAiChat failure and skips the update', async () => {
			(db.query.project_stories.findFirst as any).mockResolvedValueOnce(mockStory);
			(createFollowupAiChat as any).mockResolvedValueOnce({
				success: false,
				message: 'Parent ai_chats not found'
			});

			const result = await createProfileStoryFollowup(200, 'Refine');
			expect(result.success).toBe(false);
			expect(result.message).toBe('Parent ai_chats not found');
			expect(mockUpdateFn).not.toHaveBeenCalled();
		});

		it('handles a database error while fetching the story', async () => {
			(db.query.project_stories.findFirst as any).mockRejectedValueOnce(
				new Error('Database connection lost')
			);
			const result = await createProfileStoryFollowup(200, 'Refine');
			expect(result.success).toBe(false);
			expect(result.message).toContain('Error creating project story follow-up');
			expect(result.message).toContain('Database connection lost');
		});
	});

	describe('edge cases', () => {
		it('still calls through on an empty request (validation lives downstream)', async () => {
			(db.query.project_stories.findFirst as any).mockResolvedValueOnce(mockStory);
			(createFollowupAiChat as any).mockResolvedValueOnce({
				success: true,
				message: 'created',
				aiChat: mockCreatedAiChat
			});

			await createProfileStoryFollowup(200, '');
			expect(createFollowupAiChat).toHaveBeenCalledWith(
				5,
				'',
				expect.objectContaining({ profileDataFields: expect.any(Array) })
			);
		});
	});
});
