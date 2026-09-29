/**
 * Tests for where the changes feed sends each change.
 *
 * Every request and every entry names what it was about, and the name links to
 * where that thing is. What these pin down is the part a reader would get
 * wrong: a target's id does not always name a row. A reorder's is the profile,
 * and so is an add's until it happens; once logged, the add names the row it
 * made. Reading the id as a row regardless would send a pending add to
 * whichever of their rows happens to share its number with their profile.
 *
 * The collaborators are mocked at the module boundary. `row-page.test.ts`
 * covers where a row opens; the section registry is the real one, because it
 * decides which capabilities are profile ones.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = {
	pending: [] as Record<string, unknown>[],
	entries: [] as Record<string, unknown>[],
	/** Each row `rowPagePath` was asked about, as `section id`. */
	rowReads: [] as string[],
	rowPages: new Map<string, string>()
};

vi.mock('../../../profile/utils', () => ({ getSelectedProfileId: vi.fn() }));
vi.mock('$lib/server/ai-chat/capabilities', () => ({
	CAPABILITIES: {},
	describeProposalChanges: () => []
}));
vi.mock('$lib/server/ai-chat/edit-log', () => ({
	readEditLog: () => Promise.resolve(state.entries),
	describeLoggedChange: () => [],
	revertEdit: vi.fn()
}));
vi.mock('$lib/server/mcp/requests', () => ({
	readRequests: () => Promise.resolve(state.pending),
	requestIdsByEdit: () => Promise.resolve(new Map()),
	approveRequest: vi.fn(),
	rejectRequest: vi.fn()
}));
// The application targeting as `entities.ts` declares it, without the resolver
// and everything that one imports.
vi.mock('$lib/server/mcp/entities', () => {
	const application = {
		page: (target: { id: number }) => ({
			name: 'application',
			path: `/applications/${target.id}`
		}),
		collection: { name: 'Applications', path: '/applications' }
	};
	return {
		targetingFor: (capability: string) =>
			['update_application_status', 'add_activity_record'].includes(capability) ? application : null
	};
});
vi.mock('$lib/server/ai-chat/directive-capability', () => ({
	DIRECTIVES_PAGE: { name: 'Directives', path: '/data/directives' }
}));
vi.mock('$lib/server/profile/row-page', () => ({
	rowPagePath: (name: string, _actor: unknown, id: number) => {
		state.rowReads.push(`${name} ${id}`);
		return Promise.resolve(state.rowPages.get(`${name} ${id}`) ?? null);
	}
}));

const { load } = await import('../+page.server');

type Target = { id: number; label: string; path?: string };

let nextId = 1;

function request(capability: string, target: Target) {
	return {
		id: nextId++,
		capability,
		title: capability,
		source: 'mcp',
		target,
		fields: {},
		previous: {},
		rationale: '',
		status: 'pending',
		createdAt: new Date(),
		decidedAt: null,
		editId: null
	};
}

function entry(capability: string, target: Target) {
	return {
		id: nextId++,
		capability,
		title: capability,
		source: 'mcp',
		direct: false,
		target,
		fields: {},
		previous: {},
		createdAt: new Date(),
		revertedAt: null,
		revertible: true,
		supersededBy: null
	};
}

/** The feed's links, requests and history apart, in the order it shows them. */
async function links(): Promise<{ pending: (string | null)[]; entries: (string | null)[] }> {
	const data = (await load({
		parent: async () => ({ selectedProfile: { id: 12 } }),
		locals: { user: { id: 'user-1' } }
	} as unknown as Parameters<typeof load>[0])) as {
		pending: { link: string | null }[];
		entries: { link: string | null }[];
	};
	return {
		pending: data.pending.map((request) => request.link),
		entries: data.entries.map((entry) => entry.link)
	};
}

beforeEach(() => {
	state.pending = [];
	state.entries = [];
	state.rowReads = [];
	state.rowPages.clear();
});

describe('where the changes feed links', () => {
	it("sends a pending edit to the row's own page", async () => {
		state.rowPages.set('work_experience_project 300', '/profile/work-experience/8/projects/300');
		state.pending = [request('edit_work_experience_project', { id: 300, label: 'SJS — Engineer' })];

		expect((await links()).pending).toEqual(['/profile/work-experience/8/projects/300']);
	});

	it('sends the same change to the same page once it is applied', async () => {
		state.rowPages.set('work_experience_project 300', '/profile/work-experience/8/projects/300');
		state.entries = [entry('edit_work_experience_project', { id: 300, label: 'SJS — Engineer' })];

		expect((await links()).entries).toEqual(['/profile/work-experience/8/projects/300']);
	});

	it("reads a pending add's target as the profile it would add to, not as a row", async () => {
		state.pending = [
			request('add_work_experience_project', { id: 12, label: 'their role projects' })
		];

		expect((await links()).pending).toEqual(['/profile/work-experience']);
		expect(state.rowReads).toEqual([]);
	});

	it('sends an applied add to the row it made', async () => {
		state.rowPages.set('work_experience_project 333', '/profile/work-experience/8/projects/333');
		state.entries = [entry('add_work_experience_project', { id: 333, label: 'LLM evaluation' })];

		expect((await links()).entries).toEqual(['/profile/work-experience/8/projects/333']);
	});

	it('sends a reorder to the list, asked for or applied', async () => {
		state.pending = [
			request('reorder_work_experience_project', { id: 12, label: 'Role projects' })
		];
		state.entries = [entry('reorder_skill', { id: 12, label: 'Skills' })];

		expect(await links()).toEqual({
			pending: ['/profile/work-experience'],
			entries: ['/profile/skills']
		});
		expect(state.rowReads).toEqual([]);
	});

	it('falls back to the list for a row with no page of its own, or one that is gone', async () => {
		state.entries = [
			entry('edit_skill', { id: 3003515, label: 'Golden datasets' }),
			entry('delete_work_experience_technology', { id: 4710, label: 'Semantic modeling' })
		];

		expect((await links()).entries).toEqual(['/profile/skills', '/profile/work-experience']);
	});

	it('sends an application change to the application, and a logged record to the list', async () => {
		state.pending = [
			request('update_application_status', { id: 74, label: 'Backend Engineer at NRC' }),
			request('add_activity_record', { id: 74, label: 'Backend Engineer at NRC' })
		];
		state.entries = [
			entry('update_application_status', { id: 74, label: 'Backend Engineer at NRC' }),
			// The record the add made, whose id is not an application's.
			entry('add_activity_record', { id: 158, label: 'Terms still open' })
		];

		expect(await links()).toEqual({
			pending: ['/applications/74', '/applications/74'],
			entries: ['/applications/74', '/applications']
		});
	});

	it('keeps the path a text was logged with', async () => {
		state.entries = [
			entry('add_letter_version', {
				id: 5,
				label: 'Cover letter',
				path: '/applications/74/texts/5'
			})
		];

		expect((await links()).entries).toEqual(['/applications/74/texts/5']);
		expect(state.rowReads).toEqual([]);
	});

	it('sends a directives change to its page', async () => {
		state.entries = [entry('edit_directives', { id: 12, label: 'your directives' })];

		expect((await links()).entries).toEqual(['/data/directives']);
	});
});
