/**
 * The four text followups (answers, letters, STAR stories, prep sheets) record
 * every turn as a version row. A message the applicant typed is kept as that
 * row's `user_request`. A step the editor runs from a button, "Write a version
 * from this advice" (`apply_advice`), must not be: its wording would land in
 * the applicant's "Your feedback" bubble, editable and resendable as if they
 * had typed it. The four modules each repeat the recording code, so the same
 * cases run over all of them.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FollowupMode, FollowupResult } from '../entity-followup';

const mockRecordVersion = vi.fn();
// What the model "answered", fed to the module's own updateEntity.
let reply: string | null = null;

vi.mock('$lib/server/db', () => {
	const chain = { set: () => chain, where: async () => undefined };
	return {
		db: {
			// No entity row, so the prompt context is skipped: these cases are about
			// what gets recorded once the model has answered.
			query: new Proxy({}, { get: () => ({ findFirst: async () => undefined }) }),
			update: () => chain
		}
	};
});
vi.mock('drizzle-orm', () => ({
	and: () => ({}),
	desc: () => ({}),
	eq: () => ({}),
	isNotNull: () => ({})
}));
vi.mock('$lib/server/db/schema', () => ({
	application_questions: {},
	question_versions: {},
	application_letters: {},
	letter_versions: {},
	project_stories: {},
	cheat_sheets: {}
}));
vi.mock('../entity-versions', () => ({
	ensureBaselineVersion: vi.fn(),
	recordVersion: (...a: unknown[]) => mockRecordVersion(...a),
	QUESTION_VERSIONS: {},
	LETTER_VERSIONS: {},
	STORY_VERSIONS: {},
	CHEATSHEET_VERSIONS: {}
}));
vi.mock('../conversation-messages', () => ({ buildConversationMessages: async () => [] }));
vi.mock('../application-question', () => ({ QUESTION_PROFILE_FIELDS: [] }));
vi.mock('../profile-fields', () => ({ LETTER_PROFILE_FIELDS: [] }));
vi.mock('../profile-story', () => ({ buildStoryContext: () => '', STORY_PROFILE_FIELDS: [] }));
vi.mock('../profile-cheatsheet', () => ({
	buildSheetContext: () => '',
	CHEATSHEET_PROFILE_FIELDS: []
}));
vi.mock('$lib/server/profile/project-stories', () => ({ pinnedProjectForStory: () => null }));
vi.mock('../create-followup', () => ({ createFollowupAiChat: vi.fn() }));
// Hand the reply straight to the module's updateEntity, as the real
// createEntityFollowup does once the model has answered. Errors are left to
// propagate here; the real one's handling of them is tested at the bottom.
vi.mock('../entity-followup', async (importOriginal) => ({
	...(await importOriginal<typeof import('../entity-followup')>()),
	createEntityFollowup: async (opts: {
		entityId: number;
		updateEntity: (id: number, aiChatId: number, response: string | null) => Promise<void>;
	}): Promise<FollowupResult> => {
		await opts.updateEntity(opts.entityId, 7, reply);
		return { success: true, message: 'ok' };
	}
}));

import { createApplicationQuestionFollowup } from '../application-question-followup';
import { createApplicationLetterFollowup } from '../application-letter-followup';
import { createProfileStoryFollowup } from '../profile-story-followup';
import { createProfileCheatSheetFollowup } from '../profile-cheatsheet-followup';
import { applicantMessage, EmptyStepError } from '../entity-followup';
import { createFollowupAiChat } from '../create-followup';

type Followup = (
	id: number,
	request: string,
	includeOriginalContext?: boolean,
	updateContent?: boolean,
	mode?: FollowupMode
) => Promise<FollowupResult>;

const FOLLOWUPS: [string, Followup][] = [
	['question', createApplicationQuestionFollowup],
	['letter', createApplicationLetterFollowup],
	['story', createProfileStoryFollowup],
	['cheat sheet', createProfileCheatSheetFollowup]
];

const STEP = 'Now write the answer, applying your suggestions above.';

/** The row the one recordVersion call wrote. */
function recorded(): Record<string, unknown> {
	expect(mockRecordVersion).toHaveBeenCalledTimes(1);
	return mockRecordVersion.mock.calls[0][1];
}

beforeEach(() => {
	mockRecordVersion.mockReset();
	reply = null;
});

describe.each(FOLLOWUPS)('%s followup', (_kind, followup) => {
	it("keeps a typed message as the applicant's", async () => {
		reply = JSON.stringify({ text: 'Draft two.', feedback: 'Shortened it.' });
		await followup(1, 'Make it shorter.', true, true);

		expect(recorded()).toMatchObject({ source: 'ai_revision', userRequest: 'Make it shorter.' });
	});

	it('records the version the step wrote, without its wording as a message', async () => {
		reply = JSON.stringify({ text: 'Draft one.', feedback: 'Led with the migration.' });
		await followup(1, STEP, true, true, 'apply_advice');

		const row = recorded();
		expect(row.source).toBe('ai_revision');
		expect(row.userRequest).toBeUndefined();
	});

	it('records more advice from the step, still without a message', async () => {
		reply = JSON.stringify({ text: null, feedback: 'Which role should it name?' });
		await followup(1, STEP, true, true, 'apply_advice');

		const row = recorded();
		expect(row).toMatchObject({ source: 'ai_advice', aiFeedback: 'Which role should it name?' });
		expect(row.userRequest).toBeUndefined();
	});

	it('records no empty turn when the step came back with nothing', async () => {
		await expect(followup(1, STEP, true, true, 'apply_advice')).rejects.toBeInstanceOf(
			EmptyStepError
		);
		expect(mockRecordVersion).not.toHaveBeenCalled();
	});

	it('still keeps a typed message whose reply came back with nothing', async () => {
		await followup(1, 'Make it shorter.', true, true);

		expect(recorded()).toMatchObject({ source: 'ai_advice', userRequest: 'Make it shorter.' });
	});
});

describe('applicantMessage', () => {
	it('keeps what the applicant typed', () => {
		expect(applicantMessage('Make it shorter.')).toBe('Make it shorter.');
		expect(applicantMessage('Make it shorter.', 'feedback')).toBe('Make it shorter.');
	});

	it("drops the editor's own wording", () => {
		expect(applicantMessage('Please review my answer.', 'review')).toBeUndefined();
		expect(applicantMessage(STEP, 'apply_advice')).toBeUndefined();
	});
});

describe('createEntityFollowup', () => {
	async function runWith(updateError: Error): Promise<FollowupResult> {
		const actual = await vi.importActual<typeof import('../entity-followup')>('../entity-followup');
		vi.mocked(createFollowupAiChat).mockResolvedValue({
			success: true,
			message: 'ok',
			aiChat: { id: 7, response: null } as NonNullable<FollowupResult['aiChat']>
		});
		return actual.createEntityFollowup({
			entityId: 1,
			entityLabel: 'application question',
			entityKind: 'application_question',
			followupRequest: STEP,
			fetchEntity: async (id) => ({ id, ai_chat_id: 3 }),
			updateEntity: async () => {
				throw updateError;
			}
		});
	}

	it("passes an empty step's message through as it is", async () => {
		const result = await runWith(new EmptyStepError());

		expect(result.success).toBe(false);
		expect(result.message).toBe(new EmptyStepError().message);
	});

	it('still labels any other failure as a failed update', async () => {
		const result = await runWith(new Error('connection reset'));

		expect(result.message).toBe('Error updating application question record: connection reset');
	});
});
