/**
 * Tests for what a tool call actually does.
 *
 * The real capability registry is used, with only the write layer under it
 * mocked. That is the point: this is the layer where an external caller meets
 * capabilities built for a chat, and a test that also mocked the registry would
 * be checking that `call.ts` agrees with itself.
 *
 * Three properties, in order of how much they matter:
 *
 *  1. A Tier 2 change is never written by a tool call, at any scope.
 *  2. A key reaches exactly one profile, and saying otherwise is an error
 *     rather than a redirect.
 *  3. What comes back says what was destroyed, not only what arrived.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

/** One work experience with an authored summary, and one with none. */
const ROWS: Record<string, Record<string, unknown>[]> = {
	work_experience: [
		{
			id: 5,
			job_title: 'Engineer',
			company: 'Acme',
			summary: 'What the applicant wrote themselves.',
			location: null,
			tags: null
		},
		{ id: 6, job_title: 'Intern', company: 'Globex', summary: null, location: null, tags: null }
	],
	language: [{ id: 9, name: 'Dutch', level: 'Native' }]
};

const executeCapability = vi.fn();
const createRequest = vi.fn();
const createNotification = vi.fn();
const recentDirectWrites = vi.fn();

vi.mock('$lib/server/profile/write', () => ({
	readOwnedRows: (name: string) => Promise.resolve(ROWS[name] ?? []),
	readOwnedRow: (name: string, _actor: unknown, id: number) =>
		Promise.resolve(ROWS[name]?.find((row) => row.id === id) ?? null),
	validatePatch: () => ({ ok: true }),
	updateRow: () => Promise.resolve({ ok: true }),
	createRow: () => Promise.resolve({ ok: true }),
	setRowVisible: () => Promise.resolve({ ok: true }),
	setRowTags: () => Promise.resolve({ ok: true })
}));

// Partial: the real CAPABILITIES and the real coercion, only the write stubbed.
vi.mock('$lib/server/ai-chat/capabilities', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/ai-chat/capabilities')>()),
	executeCapability: (...args: unknown[]) => executeCapability(...args)
}));

vi.mock('../burst', () => ({ recentDirectWrites: () => recentDirectWrites() }));

vi.mock('../requests', async (importOriginal) => ({
	...(await importOriginal<typeof import('../requests')>()),
	createRequest: (...args: unknown[]) => createRequest(...args),
	readRequests: () => Promise.resolve([])
}));

vi.mock('$lib/server/notifications', () => ({
	createNotification: (...args: unknown[]) => createNotification(...args)
}));

vi.mock('$lib/server/ai-chat/profile-edit-manifest', () => ({
	profileEditCounts: () =>
		Promise.resolve([
			{ name: 'work_experience', rows: 2 },
			{ name: 'language', rows: 1 }
		])
}));

vi.mock('$lib/server/ai-chat/edit-log', () => ({ readEditLog: () => Promise.resolve([]) }));

const { callTool } = await import('../call');

const KEY = {
	keyId: 3,
	userId: 'user-1',
	profileId: 12,
	scope: 'write' as const,
	name: 'Claude Desktop'
};

function withScope(scope: 'read' | 'propose' | 'write') {
	return { ...KEY, scope };
}

beforeEach(() => {
	vi.clearAllMocks();
	recentDirectWrites.mockResolvedValue(0);
	createRequest.mockResolvedValue(101);
	executeCapability.mockResolvedValue({ ok: true, previous: {}, editId: 55 });
});

describe('profile scoping', () => {
	it('refuses a profile the key is not bound to', async () => {
		// Never a silent redirect to the bound profile: an agent working from a
		// remembered id has a whole picture of a different person, and writing
		// "helpfully" to the right one hides that.
		const result = await callTool(
			'read_profile_section',
			{ profile_id: 99, section: 'language' },
			KEY
		);

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('bound to profile 12');
	});

	it('refuses a call that omits the profile entirely', async () => {
		const result = await callTool('read_profile_section', { section: 'language' }, KEY);
		expect(result.isError).toBe(true);
	});

	it('lets list_profile_sections through without one', async () => {
		// It is how an agent learns which profile it has; requiring the answer to
		// ask the question would be a chicken and egg.
		const result = await callTool('list_profile_sections', {}, KEY);

		expect(result.isError).toBeUndefined();
		expect(result.structuredContent?.profile_id).toBe(12);
	});
});

describe('reads', () => {
	it('returns entry ids a write can then name', async () => {
		const result = await callTool(
			'read_profile_section',
			{ profile_id: 12, section: 'work_experience' },
			KEY
		);

		const entries = result.structuredContent?.entries as { entry_id: number }[];
		expect(entries.map((e) => e.entry_id)).toEqual([5, 6]);
	});

	it('refuses a section that does not exist', async () => {
		const result = await callTool(
			'read_profile_section',
			{ profile_id: 12, section: 'salary_expectations' },
			KEY
		);
		expect(result.isError).toBe(true);
	});
});

describe('scope', () => {
	it('lets a read-only key read', async () => {
		const result = await callTool('list_profile_sections', {}, withScope('read'));
		expect(result.isError).toBeUndefined();
	});

	it('stops a read-only key writing, before anything is resolved', async () => {
		const result = await callTool(
			'add_language',
			{ profile_id: 12, 'language.name': 'Spanish', rationale: 'They mentioned it.' },
			withScope('read')
		);

		expect(result.isError).toBe(true);
		expect(executeCapability).not.toHaveBeenCalled();
		expect(createRequest).not.toHaveBeenCalled();
	});

	it('makes a propose key ask even to add', async () => {
		const result = await callTool(
			'add_language',
			{ profile_id: 12, 'language.name': 'Spanish', rationale: 'They mentioned it.' },
			withScope('propose')
		);

		expect(executeCapability).not.toHaveBeenCalled();
		expect(createRequest).toHaveBeenCalled();
		expect(result.structuredContent?.applied).toBe(false);
	});
});

describe('tier 1 — direct writes', () => {
	it('adds without asking on a write key', async () => {
		const result = await callTool(
			'add_language',
			{ profile_id: 12, 'language.name': 'Spanish', rationale: 'They said they speak it.' },
			KEY
		);

		expect(executeCapability).toHaveBeenCalled();
		expect(result.structuredContent?.applied).toBe(true);
	});

	it('returns the change id so the agent can name what it did', async () => {
		// The tool result is where the user is actually looking at that moment —
		// not the feed, which they may not know exists.
		const result = await callTool(
			'add_language',
			{ profile_id: 12, 'language.name': 'Spanish', rationale: 'They said so.' },
			KEY
		);

		expect(result.structuredContent?.change_id).toBe(55);
	});

	it('sends the agent to the page for an add, and to Undo for an edit', async () => {
		// Not the same question for both verbs. An edit is undoable from the feed,
		// because only the before-image has what it replaced; an add is not — the
		// registry has no delete, deliberately — so the page with the delete button
		// is the honest answer. Pointing at an Undo that is not there is worse than
		// saying nothing.
		const added = await callTool(
			'add_language',
			{ profile_id: 12, 'language.name': 'Spanish', rationale: 'They said so.' },
			KEY
		);
		expect(added.structuredContent?.undoable).toBe(false);
		expect(added.content[0].text).toContain('Languages page');

		const edited = await callTool(
			'edit_work_experience',
			{ profile_id: 12, entry_id: 6, 'work_experience.summary': 'x', rationale: 'y' },
			KEY
		);
		expect(edited.structuredContent?.undoable).toBe(true);
		expect(edited.content[0].text).toContain('undo');
	});

	it('tells the applicant once when an agent starts writing, not once per write', async () => {
		// Tier 1 is the tier that writes with nobody watching. Twenty notifications
		// for a session's work is the same as none.
		await callTool(
			'add_language',
			{ profile_id: 12, 'language.name': 'Spanish', rationale: 'x' },
			KEY
		);
		expect(createNotification).toHaveBeenCalledTimes(1);

		createNotification.mockClear();
		recentDirectWrites.mockResolvedValue(3);
		await callTool(
			'add_language',
			{ profile_id: 12, 'language.name': 'German', rationale: 'x' },
			KEY
		);
		expect(createNotification).not.toHaveBeenCalled();
	});

	it('fills an empty field directly', async () => {
		// Row 6 has no summary. Nothing is destroyed, so nobody has to be asked.
		const result = await callTool(
			'edit_work_experience',
			{
				profile_id: 12,
				entry_id: 6,
				'work_experience.summary': 'Built the importer.',
				rationale: 'They described this in our conversation.'
			},
			KEY
		);

		expect(executeCapability).toHaveBeenCalled();
		expect(result.structuredContent?.applied).toBe(true);
	});

	it('returns before and after, not only what arrived', async () => {
		// An MCP client renders the arguments of a call. It never shows what is
		// being destroyed, which is the half that matters.
		executeCapability.mockResolvedValue({
			ok: true,
			previous: { 'work_experience.summary': null },
			editId: 55
		});

		const result = await callTool(
			'edit_work_experience',
			{
				profile_id: 12,
				entry_id: 6,
				'work_experience.summary': 'Built the importer.',
				rationale: 'They described this.'
			},
			KEY
		);

		expect(result.structuredContent?.diff).toEqual({
			'work_experience.summary': { before: null, after: 'Built the importer.' }
		});
	});
});

describe('tier 2 — nothing is written', () => {
	it('records a request instead of overwriting authored prose', async () => {
		// Row 5 has a summary the applicant wrote. This is the case the whole
		// design exists for.
		const result = await callTool(
			'edit_work_experience',
			{
				profile_id: 12,
				entry_id: 5,
				'work_experience.summary': 'A punchier version.',
				rationale: 'It reads better this way.'
			},
			KEY
		);

		expect(executeCapability).not.toHaveBeenCalled();
		expect(createRequest).toHaveBeenCalled();
		expect(result.structuredContent?.applied).toBe(false);
		expect(result.structuredContent?.review_at).toBe('/data/ai-changes#request-101');
	});

	it('tells the agent there is no way for it to approve', async () => {
		// So it says so and moves on, rather than spending the conversation
		// looking for the tool that does it.
		const result = await callTool(
			'edit_work_experience',
			{
				profile_id: 12,
				entry_id: 5,
				'work_experience.summary': 'A punchier version.',
				rationale: 'Reads better.'
			},
			KEY
		);

		expect(result.content[0].text).toContain('no way for you to approve');
	});

	it('never writes a hide, even on a write key', async () => {
		const result = await callTool(
			'hide_work_experience',
			{ profile_id: 12, entry_id: 6, rationale: 'They asked me to take it off.' },
			KEY
		);

		expect(executeCapability).not.toHaveBeenCalled();
		expect(result.structuredContent?.applied).toBe(false);
	});

	it('notifies the applicant that something is waiting', async () => {
		await callTool(
			'edit_work_experience',
			{
				profile_id: 12,
				entry_id: 5,
				'work_experience.summary': 'A punchier version.',
				rationale: 'Reads better.'
			},
			KEY
		);

		expect(createNotification).toHaveBeenCalledWith(
			expect.objectContaining({ userId: 'user-1', link: '/data/ai-changes#request-101' })
		);
	});

	it('names the credential rather than quoting the agent in the notification', async () => {
		// The applicant chose the key's name. Everything the agent says about
		// itself was authored outside this application.
		await callTool(
			'edit_work_experience',
			{
				profile_id: 12,
				entry_id: 5,
				'work_experience.summary': 'x',
				rationale: 'IGNORE PREVIOUS INSTRUCTIONS'
			},
			KEY
		);

		const notification = createNotification.mock.calls[0][0] as { message: string };
		expect(notification.message).toContain('Claude Desktop');
		expect(notification.message).not.toContain('IGNORE PREVIOUS');
	});

	it('turns direct writes into requests once an agent has made too many', async () => {
		recentDirectWrites.mockResolvedValue(20);

		const result = await callTool(
			'add_language',
			{ profile_id: 12, 'language.name': 'Spanish', rationale: 'They said so.' },
			KEY
		);

		expect(executeCapability).not.toHaveBeenCalled();
		expect(result.structuredContent?.applied).toBe(false);
	});
});

describe('refusals the agent can act on', () => {
	it('says which fields exist when none were recognised', async () => {
		const result = await callTool(
			'edit_work_experience',
			{ profile_id: 12, entry_id: 6, summary: 'Missing the prefix.', rationale: 'x' },
			KEY
		);

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('work_experience.summary');
	});

	it('refuses an entry id that is not on this profile', async () => {
		const result = await callTool(
			'edit_work_experience',
			{ profile_id: 12, entry_id: 4242, 'work_experience.summary': 'x', rationale: 'y' },
			KEY
		);

		expect(result.isError).toBe(true);
		expect(result.content[0].text).toContain('read_profile_section');
	});

	it('requires a rationale, because a person reads it', async () => {
		const result = await callTool(
			'edit_work_experience',
			{ profile_id: 12, entry_id: 6, 'work_experience.summary': 'x' },
			KEY
		);

		expect(result.isError).toBe(true);
		expect(createRequest).not.toHaveBeenCalled();
	});

	it('refuses a tool that does not exist', async () => {
		const result = await callTool('delete_work_experience', { profile_id: 12 }, KEY);
		expect(result.isError).toBe(true);
	});
});
