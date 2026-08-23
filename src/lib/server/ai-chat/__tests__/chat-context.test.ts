import { beforeEach, describe, expect, it, vi } from 'vitest';

// Ownership lookups and the ranking-terms lookup both go through db.query;
// each test sets what the next findFirst calls resolve to.
let applicationRow: unknown = null;
let jobRow: unknown = null;

vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			applications: { findFirst: () => Promise.resolve(applicationRow) },
			jobs: { findFirst: () => Promise.resolve(jobRow) }
		}
	}
}));

// The registry has its own tests. What matters here is which capabilities a
// route hands it and who it says is asking — the resolve/authorize behaviour
// behind them is capabilities.test.ts's business.
const mockResolveCapabilities = vi.fn().mockResolvedValue([]);
// Only the resolution is stubbed. `fitMatchedCapabilities` stays real, because
// what this file tests is which capabilities a page ends up with — and since
// message matching, that is granted-plus-matched-that-fit rather than a lookup.
vi.mock('../capabilities', async (importOriginal) => ({
	...(await importOriginal<typeof import('../capabilities')>()),
	resolveCapabilities: (...a: unknown[]) => mockResolveCapabilities(...a)
}));

// A profile section row resolves through the write layer's owned read, which is
// the same check the capability re-runs. Its behaviour is write.test.ts's
// business; what matters here is that a row that isn't theirs yields no entity.
let sectionRow: unknown = null;
let sectionRows: Record<string, unknown[]> = {};
vi.mock('$lib/server/profile/write', () => ({
	readOwnedRow: () => Promise.resolve(sectionRow),
	// The section matcher's read, keyed by resource. Empty by default: these
	// tests are about what the ROUTE grants, so a message that also matched a
	// section would be a second variable in every one of them. The matching
	// itself has its own file.
	readOwnedRows: (name: string) => Promise.resolve(sectionRows[name] ?? [])
}));

import {
	CHAT_BUDGET_CHARS,
	normalizeRouteId,
	resolveChatContext,
	scopeForRoute,
	tieredCapabilities
} from '../chat-context';

beforeEach(() => {
	applicationRow = null;
	jobRow = null;
	sectionRow = null;
	sectionRows = {};
	mockResolveCapabilities.mockReset();
	mockResolveCapabilities.mockResolvedValue([]);
});

describe('normalizeRouteId', () => {
	it('strips SvelteKit group segments', () => {
		expect(normalizeRouteId('/(app)/applications/[id]/texts')).toBe('/applications/[id]/texts');
		expect(normalizeRouteId('/(app)/profile/(data)/skills')).toBe('/profile/skills');
	});

	it('treats a missing route as the empty route', () => {
		expect(normalizeRouteId(null)).toBe('');
		expect(normalizeRouteId(undefined)).toBe('');
	});
});

describe('scopeForRoute', () => {
	it('scopes an application page to that application', () => {
		const scope = scopeForRoute('/(app)/applications/[id]');
		expect(scope.entity).toBe('application');
		expect(scope.sources).toContain('application_activity');
	});

	it('inherits the parent scope on a nested tab', () => {
		// The whole point of prefix matching: /texts, /documents, /timeline and
		// friends must not each need their own row.
		for (const tab of ['texts', 'documents', 'timeline', 'salary']) {
			const scope = scopeForRoute(`/(app)/applications/[id]/${tab}`);
			expect(scope.entity).toBe('application');
			expect(scope.sources).toContain('application_activity');
		}
	});

	it('scopes a job page to the job, without application-only sources', () => {
		const scope = scopeForRoute('/(app)/jobs/[id]');
		expect(scope.entity).toBe('job');
		expect(scope.sources).toContain('job');
		expect(scope.sources).not.toContain('application_activity');
	});

	it('does not confuse a sibling route with a prefix match', () => {
		// "/applications/interview" must not match "/applications/[id]".
		expect(scopeForRoute('/(app)/applications/interview').entity).toBeNull();
	});

	/**
	 * These pages fell through to profile-only, so the assistant could see the
	 * applicant's projects but not a single one of the applications the page was
	 * listing — and "compare these two", asked while looking at exactly those
	 * two, had nothing to answer from.
	 */
	describe('pages that are ABOUT the pipeline', () => {
		it('gives the applications list the pipeline, with no single entity', () => {
			const scope = scopeForRoute('/(app)/applications');
			expect(scope.entity).toBeNull();
			expect(scope.sources).toContain('application_pipeline');
			// No application is in front of the user, so nothing scoped to one.
			expect(scope.sources).not.toContain('application_activity');
			expect(scope.sources).not.toContain('job');
		});

		it('extends to the sibling views, which are also across applications', () => {
			for (const tab of ['active', 'salary', 'texts', 'new']) {
				const scope = scopeForRoute(`/(app)/applications/${tab}`);
				expect(scope.sources).toContain('application_pipeline');
				expect(scope.entity).toBeNull();
			}
		});

		// Longest-prefix, so the more specific rows still win.
		it('does not swallow the routes that declare their own scope', () => {
			expect(scopeForRoute('/(app)/applications/[id]').entity).toBe('application');
			expect(scopeForRoute('/(app)/applications/interview').sources).not.toContain(
				'application_pipeline'
			);
		});

		// Nothing competes with it for room here, unlike on a detail page where
		// the application's own history takes a third of the budget.
		it("raises the pipeline's ceiling where the pipeline is the content", () => {
			const list = scopeForRoute('/(app)/applications');
			const detail = scopeForRoute('/(app)/applications/[id]');
			expect(list.sourceOptions?.application_pipeline?.budgetChars).toBeGreaterThan(
				detail.sourceOptions?.application_pipeline?.budgetChars ?? 12000
			);
		});
	});

	// /home used to be here. It has its own row now — a dashboard asking "how is
	// my search going" needs the pipeline — which is the point of the table: a
	// page graduates out of the fallback the moment anyone knows what it is for.
	it('falls back to profile-only for unmapped and unknown routes', () => {
		for (const route of ['/(app)/settings', '/(app)/nothing/here', null]) {
			const scope = scopeForRoute(route);
			expect(scope.entity).toBeNull();
			expect(scope.sources).toEqual(['profile', 'projects', 'stories']);
			// Profile-only in what it can SEE, but never silent about where it is.
			expect(scope.hint).toBeDefined();
		}
	});
});

describe('resolveChatContext', () => {
	const base = {
		profileId: 7,
		isStaff: false,
		message: 'How should I answer this?'
	};

	it('assembles the full application scope for an owned application', async () => {
		applicationRow = {
			id: 42,
			job: { title: 'Staff Engineer', skills_required: ['Go'] }
		};

		const { context: ctx } = await resolveChatContext({
			...base,
			routeId: '/(app)/applications/[id]',
			params: { id: '42' }
		});

		expect(ctx.entity).toEqual({ type: 'application', id: 42 });
		expect(ctx.sources).toContain('application_activity');
		expect(ctx.budgetChars).toBe(CHAT_BUDGET_CHARS);
	});

	it('ranks on the message plus the role title and its skills', async () => {
		applicationRow = {
			id: 42,
			job: { title: 'Staff Engineer', skills_required: ['Go'] }
		};

		const { context: ctx } = await resolveChatContext({
			...base,
			routeId: '/(app)/applications/[id]',
			params: { id: '42' }
		});

		// The message leads — what they just asked is what they want evidence
		// about — with the role folded in so a vague question still ranks.
		expect(ctx.query?.text).toContain('How should I answer this?');
		expect(ctx.query?.text).toContain('Staff Engineer');
		expect(ctx.query?.skills).toEqual(['Go']);
	});

	it('drops entity sources when the application belongs to someone else', async () => {
		// findFirst is filtered on profile_id, so a foreign application returns
		// nothing — the chat degrades to profile-only rather than failing.
		applicationRow = null;

		const { context: ctx } = await resolveChatContext({
			...base,
			routeId: '/(app)/applications/[id]',
			params: { id: '9999' }
		});

		expect(ctx.entity).toBeUndefined();
		expect(ctx.sources).not.toContain('job');
		expect(ctx.sources).not.toContain('application_activity');
		expect(ctx.sources).not.toContain('application_activity');
		expect(ctx.sources).toContain('profile');
	});

	it("drops entity sources when the route param isn't a usable id", async () => {
		const { context: ctx } = await resolveChatContext({
			...base,
			routeId: '/(app)/applications/[id]',
			params: { id: 'not-a-number' }
		});

		expect(ctx.entity).toBeUndefined();
		expect(ctx.sources).not.toContain('application_activity');
	});

	it('resolves a job page without requiring an application', async () => {
		jobRow = { id: 5, title: 'Backend Engineer', skills_required: ['Rust'] };

		const { context: ctx } = await resolveChatContext({
			...base,
			routeId: '/(app)/jobs/[id]',
			params: { id: '5' }
		});

		expect(ctx.entity).toEqual({ type: 'job', id: 5 });
		expect(ctx.query?.skills).toEqual(['Rust']);
	});
});

describe('resolveChatContext — orientation blocks', () => {
	const base = {
		profileId: 7,
		isStaff: false,
		message: 'How is it going?'
	};

	// These two are the guarantee that a route cannot silently blind the
	// assistant, so they are appended centrally rather than listed per scope.
	// The test is over EVERY route in the table on purpose: a per-scope list is
	// exactly the thing that gets forgotten, which is the bug they exist to kill.
	const ROUTES = [
		['/(app)/applications', {}],
		['/(app)/applications/[id]', { id: '42' }],
		['/(app)/applications/active', {}],
		['/(app)/applications/interview', {}],
		['/(app)/jobs/[id]', { id: '9' }],
		['/(app)/profile', {}],
		['/(app)/some/page/nobody/scoped', {}]
	] as const;

	// The scope block existed to stop the model inferring where it was. A route
	// nobody listed used to get an empty one, which is the same silence in a
	// different place — and /home and /jobs, both real pages, were exactly that.
	it('tells even an unlisted route that it has not been told', async () => {
		const { context: ctx } = await resolveChatContext({
			...base,
			routeId: '/(app)/somewhere/nobody/scoped',
			params: {}
		});

		expect(ctx.scopeHint).toBeDefined();
		expect(ctx.scopeHint?.page).toContain('has not been described to you');
		expect(ctx.scopeHint?.subject).toBeNull();
	});

	it('declares the jobs list rather than letting it fall through', async () => {
		// It had no entry at all, so "no job search in the chat" was an accident
		// of the default rather than a decision anyone could read.
		const scope = scopeForRoute('/(app)/jobs');

		expect(scope.hint?.page).toContain('filter controls');
		expect(scope.sources).not.toContain('job');
		// The list is not the detail page: /jobs/[id] still gets its job.
		expect(scopeForRoute('/(app)/jobs/[id]').sources).toContain('job');
	});

	it('gives the dashboard the pipeline, which is what it is for', async () => {
		const scope = scopeForRoute('/(app)/home');

		expect(scope.sources).toContain('application_pipeline');
		expect(scope.hint?.page).toContain('dashboard');
	});

	it('gives every route the manifest and the scope block', async () => {
		for (const [routeId, params] of ROUTES) {
			applicationRow = { id: 42, job: { title: 'Staff Engineer' } };
			jobRow = { id: 9, title: 'Staff Engineer' };

			const { context: ctx } = await resolveChatContext({
				...base,
				routeId,
				params: params as Record<string, string>
			});

			expect(ctx.sources, routeId).toContain('activity_manifest');
			expect(ctx.sources, routeId).toContain('page_scope');
			// The one that matters most on the routes granting nothing: those are
			// where "you can't do that" is the whole answer without it.
			expect(ctx.sources, routeId).toContain('abilities');
		}
	});

	it('tells the model a bare question means THIS application on a detail page', async () => {
		applicationRow = { id: 42, job: { title: 'Staff Engineer' } };

		const { context: ctx } = await resolveChatContext({
			...base,
			routeId: '/(app)/applications/[id]',
			params: { id: '42' }
		});

		expect(ctx.scopeHint?.subject).toBe('that application');
	});

	it('tells it a bare question means no single one on the list', async () => {
		const { context: ctx } = await resolveChatContext({
			...base,
			routeId: '/(app)/applications',
			params: {}
		});

		expect(ctx.scopeHint?.subject).toBeNull();
		expect(ctx.scopeHint?.page).toContain('list');
	});

	// Same scope object, different pages. If the hint lived on the scope these
	// two would claim to be the same place.
	it('distinguishes pages that share a scope', async () => {
		const profile = await resolveChatContext({
			...base,
			routeId: '/(app)/profile',
			params: {}
		});
		const interview = await resolveChatContext({
			...base,
			routeId: '/(app)/applications/interview',
			params: {}
		});

		expect(profile.context.scopeHint?.page).not.toBe(interview.context.scopeHint?.page);
	});

	// The route's hint is a constant; whether they have applied is not. It used
	// to be baked into the page description, so a job with an application against
	// it got "a job posting they have not applied to yet" in the same prompt as a
	// pipeline row and a manifest entry for that application.
	it('says they have not applied when no application is behind the job', async () => {
		jobRow = { id: 9, title: 'Staff Engineer' };
		applicationRow = null;

		const { context: ctx } = await resolveChatContext({
			...base,
			routeId: '/(app)/jobs/[id]',
			params: { id: '9' }
		});

		expect(ctx.scopeHint?.page).not.toMatch(/applied/i);
		expect(ctx.scopeHint?.note).toMatch(/have not applied/i);
	});

	it('names the application when there is one, and says where its history lives', async () => {
		jobRow = { id: 9, title: 'Staff Engineer' };
		applicationRow = { id: 42 };

		const { context: ctx } = await resolveChatContext({
			...base,
			routeId: '/(app)/jobs/[id]',
			params: { id: '9' }
		});

		expect(ctx.scopeHint?.note).toContain('application 42');
		// The job page does not carry the activity, so the note has to say where
		// it is rather than leaving the model to answer from nothing.
		expect(ctx.sources).not.toContain('application_activity');
		expect(ctx.scopeHint?.note).toMatch(/own page/i);
	});

	it('leaves the note off a page that is not about a job', async () => {
		applicationRow = { id: 42, job: { title: 'Staff Engineer' } };

		const { context: ctx } = await resolveChatContext({
			...base,
			routeId: '/(app)/applications/[id]',
			params: { id: '42' }
		});

		expect(ctx.scopeHint?.note).toBeUndefined();
	});

	// A hint saying "they are on one application's page" while the application
	// block is missing would point the model at something it cannot see.
	it('drops the hint when the entity failed to resolve', async () => {
		applicationRow = null;

		const { context: ctx } = await resolveChatContext({
			...base,
			routeId: '/(app)/applications/[id]',
			params: { id: '42' }
		});

		expect(ctx.scopeHint).toBeUndefined();
		// But the manifest still ships: what exists does not depend on what
		// resolved.
		expect(ctx.sources).toContain('activity_manifest');
	});
});

describe('resolveChatContext — capabilities', () => {
	const base = {
		profileId: 7,
		isStaff: false,
		message: 'Set the salary to 50-150 per hour'
	};

	it('offers the job edits on a job page', async () => {
		jobRow = { id: 5, title: 'Backend Engineer' };

		await resolveChatContext({
			...base,
			routeId: '/(app)/jobs/[id]',
			params: { id: '5' }
		});

		expect(mockResolveCapabilities).toHaveBeenCalledWith(
			['edit_job_details', 'edit_job_description', 'edit_job_skills'],
			{ type: 'job', id: 5 },
			{ profileId: 7, isStaff: false },
			// The turn's recent messages, for a section whose list is too long to
			// print in full — see TARGET_LIST_CAP.
			expect.objectContaining({ message: expect.any(String) })
		);
	});

	it("offers the attached job's edits from an application page", async () => {
		// The point of keying the registry by capability rather than by page: an
		// application page reaches the job through application.job_id.
		applicationRow = { id: 42, job: { title: 'Staff Engineer' } };

		await resolveChatContext({
			...base,
			routeId: '/(app)/applications/[id]',
			params: { id: '42' }
		});

		const [declared] = mockResolveCapabilities.mock.calls[0];
		expect(declared).toContain('edit_application_details');
		expect(declared).toContain('edit_job_details');
		expect(declared).toContain('edit_job_description');
		expect(declared).toContain('edit_job_skills');
	});

	it('inherits capabilities on a nested application tab', async () => {
		applicationRow = { id: 42, job: { title: 'Staff Engineer' } };

		await resolveChatContext({
			...base,
			routeId: '/(app)/applications/[id]/texts',
			params: { id: '42' }
		});

		expect(mockResolveCapabilities.mock.calls[0][0]).toContain('edit_application_details');
	});

	it('offers nothing on a page with no capabilities declared', async () => {
		const { capabilities } = await resolveChatContext({
			...base,
			routeId: '/(app)/profile',
			params: {}
		});

		expect(mockResolveCapabilities).toHaveBeenCalledWith(
			[],
			null,
			expect.anything(),
			expect.anything()
		);
		expect(capabilities).toEqual([]);
	});

	it('passes staff status through to the registry rather than assuming it', async () => {
		// Staff can edit manual jobs they didn't import, so this flag decides real
		// access. It comes from the session — never from the request body, which is
		// where the route and params come from.
		jobRow = { id: 5, title: 'Backend Engineer' };

		await resolveChatContext({
			...base,
			isStaff: true,
			routeId: '/(app)/jobs/[id]',
			params: { id: '5' }
		});

		expect(mockResolveCapabilities).toHaveBeenCalledWith(
			expect.anything(),
			expect.anything(),
			{ profileId: 7, isStaff: true },
			expect.anything()
		);
	});

	it('still resolves capabilities when the entity did not resolve', async () => {
		// resolveCapabilities is what decides a null entity means nothing to act
		// on — chat-context must not silently skip the call and let a stale
		// capability list survive.
		applicationRow = null;

		await resolveChatContext({
			...base,
			routeId: '/(app)/applications/[id]',
			params: { id: '9999' }
		});

		expect(mockResolveCapabilities).toHaveBeenCalledWith(
			expect.anything(),
			null,
			expect.anything(),
			expect.anything()
		);
	});
});

describe('profile section pages', () => {
	const SECTIONS = [
		['/(app)/profile/(data)/work-experience/[id]', 'work_experience', 'edit_work_experience'],
		['/(app)/profile/(data)/education/[id]', 'education', 'edit_education'],
		['/(app)/profile/(data)/side-projects/[id]', 'side_project', 'edit_side_project']
	] as const;

	it.each(SECTIONS)('%s is about one %s row', (route, resource, capability) => {
		const scope = scopeForRoute(route);
		expect(scope.entity).toBe(resource);
		expect(scope.param).toBe('id');
		expect(scope.capabilities).toContain(capability);
	});

	it.each(SECTIONS)('%s offers all three verbs on its own row', (route, resource) => {
		// Adding is the same request from a list and from one entry ("add another
		// role"), and hiding follows the same targeting as editing, so a page that
		// can reach a section can do all three to it.
		expect(tieredCapabilities(scopeForRoute(route)).subject).toEqual([
			`edit_${resource}`,
			`add_${resource}`,
			`hide_${resource}`
		]);
	});

	it.each(SECTIONS)('%s says what a bare question is about', (route) => {
		// A section page is about one row, so the model must not read "tighten
		// this" as being about the profile at large.
		expect(scopeForRoute(route).hint?.subject).toBeTruthy();
	});

	it('makes only the page’s own section unconditional', () => {
		// The three verbs of ONE section are the promise the page makes, and
		// nothing may drop them. Anything else it grants is a child collection
		// that lives on the same page — a role's projects — and those go in the
		// tier that gives way, because a busy role’s five sections measure 30k
		// against a 22k budget. Without the split a page would either overflow or
		// have to give up its own subject.
		for (const [route, resource] of SECTIONS) {
			const { subject, children } = tieredCapabilities(scopeForRoute(route));

			expect(subject, route).toHaveLength(3);
			expect(
				subject.every((c) => c.endsWith(`_${resource}`)),
				`${route}: ${subject.join(', ')}`
			).toBe(true);

			// A child group is a section's whole set of verbs — never a lone edit,
			// which would leave the model able to correct a project and not add one.
			for (const group of children) {
				expect(group.length, `${route}: ${group.join(', ')}`).toBeGreaterThan(0);
				expect(
					group.some((c) => subject.includes(c)),
					route
				).toBe(false);
			}
		}
	});

	it('reaches a role’s projects from the role’s own page', () => {
		// The gap this closed: the assistant could rewrite a role's summary and
		// not touch the projects listed right under it, because a project is a row
		// of another table and only the role's own section was declared here.
		const { children } = tieredCapabilities(
			scopeForRoute('/(app)/profile/(data)/work-experience/[id]')
		);

		expect(children.flat()).toEqual([
			'edit_work_experience_project',
			'add_work_experience_project',
			'edit_work_experience_achievement',
			'add_work_experience_achievement',
			'hide_work_experience_achievement',
			'edit_work_experience_technology',
			'add_work_experience_technology',
			'hide_work_experience_technology',
			'edit_work_experience_project_technology',
			'add_work_experience_project_technology'
		]);
	});

	it('orders the children by what should survive the budget', () => {
		// Groups are admitted in this order and dropped from the end, so the order
		// IS the decision about what a busy role keeps. Projects and achievements
		// carry prose the assistant can actually improve; the technology lists are
		// single names, and they are what goes.
		const { children } = tieredCapabilities(
			scopeForRoute('/(app)/profile/(data)/work-experience/[id]')
		);

		expect(children.map((group) => group[0])).toEqual([
			'edit_work_experience_project',
			'edit_work_experience_achievement',
			'edit_work_experience_technology',
			'edit_work_experience_project_technology'
		]);
	});

	it('leaves the section LIST pages without a capability', () => {
		// They show a list, so there is no row to resolve and nothing for the
		// model to name yet. They inherit /profile, which is about the applicant
		// rather than about one entry.
		//
		// True of the sections that HAVE a detail page. A section edited inline on
		// its list is the other way round — see the skills page below.
		const list = scopeForRoute('/(app)/profile/(data)/work-experience');
		expect(list.entity).toBeNull();
		expect(list.capabilities).toBeUndefined();
	});

	it('grants both of the skills page’s sections, not whichever was declared last', () => {
		// Two sections share one page, and the scope table is keyed by PATH for
		// exactly this: keyed by section, the second would have silently replaced
		// the first and the assistant could rename a group but not add a skill,
		// on a page showing both.
		const scope = scopeForRoute('/(app)/profile/(data)/skills');

		expect(scope.capabilities).toEqual([
			'edit_skill',
			'add_skill',
			'hide_skill',
			'edit_skill_category',
			'add_skill_category',
			'hide_skill_category'
		]);
		// A list page: no row comes from the URL, so the model names one.
		expect(scope.entity).toBeNull();
	});

	it('passes the resolved row to the capability registry', async () => {
		sectionRow = { id: 5, profile_id: 12 };

		await resolveChatContext({
			routeId: '/(app)/profile/(data)/work-experience/[id]',
			params: { id: '5' },
			message: 'tighten this summary',
			profileId: 12,
			isStaff: false
		});

		// The page's own section, resolved against the row the URL named. Its child
		// collections are resolved in their own calls — see the tiering above.
		expect(mockResolveCapabilities).toHaveBeenCalledWith(
			['edit_work_experience', 'add_work_experience', 'hide_work_experience'],
			{ type: 'profile_section', resource: 'work_experience', id: 5 },
			expect.objectContaining({ profileId: 12 }),
			expect.anything()
		);
	});

	it("resolves no entity for a row that is not this profile's", async () => {
		sectionRow = null;

		const { capabilities, context } = await resolveChatContext({
			routeId: '/(app)/profile/(data)/work-experience/[id]',
			params: { id: '5' },
			message: 'tighten this summary',
			profileId: 12,
			isStaff: false
		});

		expect(context.entity).toBeUndefined();
		expect(capabilities).toEqual([]);
		expect(mockResolveCapabilities).toHaveBeenCalledWith(
			['edit_work_experience', 'add_work_experience', 'hide_work_experience'],
			null,
			expect.anything(),
			expect.anything()
		);
	});
});

describe('profile section list pages', () => {
	const LISTS = [
		['/(app)/profile/(data)/languages', 'edit_language'],
		['/(app)/profile/(data)/references', 'edit_reference'],
		['/(app)/profile/(data)/certificates', 'edit_certificate'],
		['/(app)/profile/(data)/highlights', 'edit_highlight']
	] as const;

	it.each(LISTS)('%s offers its section without naming a row', (route, capability) => {
		const scope = scopeForRoute(route);

		// No entity: these sections have no [id] page, so the row comes from the
		// model naming one out of the list the capability offers.
		expect(scope.entity).toBeNull();
		expect(scope.capabilities).toContain(capability);
	});

	it.each(LISTS)('%s says a bare question is about the section, not one row', (route) => {
		expect(scopeForRoute(route).hint?.subject).toBeNull();
	});

	it('grants one section and no more', () => {
		// Two verbs, not three: none of the list-page sections can be hidden —
		// nothing filters them on a document. See HIDEABLE_RESOURCES.
		for (const [route] of LISTS) {
			expect(scopeForRoute(route).capabilities, route).toEqual([
				expect.stringMatching(/^edit_/),
				expect.stringMatching(/^add_/)
			]);
		}
	});

	it('leaves the long sections’ list pages capability-free', () => {
		// Work experience and education rows are far bigger than a language, so
		// offering every one of them is a budget question rather than a free one.
		// Deliberate, not an oversight.
		for (const route of [
			'/(app)/profile/(data)/work-experience',
			'/(app)/profile/(data)/education',
			'/(app)/profile/(data)/side-projects'
		]) {
			expect(scopeForRoute(route).capabilities, route).toBeUndefined();
		}
	});
});

describe('sections the message reaches for', () => {
	// Page bias is the default and the matcher is the exception, so what these
	// assert is mostly that the exception stays an exception: it fires when the
	// user said which part they meant, and not otherwise.

	beforeEach(() => {
		sectionRows = { language: [{ id: 11, name: 'Spanish' }] };
		mockResolveCapabilities.mockImplementation((capabilities: string[]) =>
			Promise.resolve(
				capabilities.map((capability) => ({
					capability,
					targets: [{ id: 1, label: 'x' }],
					current: {}
				}))
			)
		);
	});

	const onJobPage = (message: string, history?: string[]) =>
		resolveChatContext({
			routeId: '/(app)/jobs/[id]',
			params: { id: '5' },
			profileId: 7,
			isStaff: false,
			message,
			history
		});

	it('offers a named section from a page that does not hold it', async () => {
		jobRow = { id: 5, title: 'Staff Engineer' };

		const { capabilities } = await onJobPage('while I think of it, add Spanish to my languages');

		expect(capabilities.map((c) => c.capability)).toEqual([
			'edit_job_details',
			'edit_job_description',
			'edit_job_skills',
			'edit_language',
			'add_language'
		]);
	});

	it('leaves a page alone when the message names no section', async () => {
		jobRow = { id: 5, title: 'Staff Engineer' };

		const { capabilities } = await onJobPage('is this job worth applying to?');

		expect(capabilities.map((c) => c.capability)).toEqual([
			'edit_job_details',
			'edit_job_description',
			'edit_job_skills'
		]);
	});

	it('passes a named row as the entity, so it resolves like a detail page', async () => {
		// The whole point of narrowing: the capability gets one target and its
		// current values, exactly as if the user had navigated to the row.
		await onJobPage('make my Spanish conversational');

		expect(mockResolveCapabilities).toHaveBeenCalledWith(
			['edit_language', 'add_language'],
			{ type: 'profile_section', resource: 'language', id: 11 },
			expect.objectContaining({ profileId: 7 }),
			expect.anything()
		);
	});

	it('does not offer a section the page already grants', async () => {
		// Twice would be two copies of the same contract in one prompt.
		sectionRow = { id: 5, profile_id: 7 };

		const { capabilities } = await resolveChatContext({
			routeId: '/(app)/profile/(data)/languages',
			params: {},
			profileId: 7,
			isStaff: false,
			message: 'fix my languages'
		});

		expect(capabilities.map((c) => c.capability)).toEqual(['edit_language', 'add_language']);
	});

	it('carries a section through a follow-up that names nothing', async () => {
		jobRow = { id: 5, title: 'Staff Engineer' };

		const { capabilities } = await onJobPage('actually, make it conversational', [
			'add Spanish to my languages'
		]);

		expect(capabilities.map((c) => c.capability)).toContain('edit_language');
	});
});
