/**
 * Tests for the capability registry — what the assistant may propose, and the
 * checks standing between a proposal and a write.
 *
 * The load-bearing behaviours here are the ones a reader would not guess:
 *
 *  - a capability resolves through the *page's* entity, so `edit_job_details`
 *    reaches a job from an application page as well as a job page;
 *  - `authorize` is asked independently of the entity resolving, because
 *    resolveEntity resolves any job to any signed-in user by design;
 *  - proposals are partial, so an omitted field must keep its current value —
 *    the alternative is a model that mentions one field wiping the other twelve.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { PROFILE_CAPABILITY_NAMES } from '../profile-capabilities';

let applicationRow: unknown = null;
let jobRow: unknown = null;
let recordRows: unknown[] = [];
const mockAppUpdateSet = vi.fn().mockReturnValue({
	where: vi.fn().mockResolvedValue(undefined)
});
const mockRecordInsert = vi.fn();
// The edit log's insert, kept apart from the activity-record one above so the
// call-count assertions on that spy keep meaning what they say. Dispatched on
// the table rather than the call order, because `recordEdit` runs after every
// successful write and would otherwise be counted as one.
const mockEditLogInsert = vi.fn();

// vi.mock is hoisted above every top-level binding, so the query object is
// written out twice rather than shared through a helper — a helper here is a
// ReferenceError at import time, not a tidier test.
vi.mock('$lib/server/db', () => ({
	db: {
		query: {
			applications: { findFirst: () => Promise.resolve(applicationRow) },
			jobs: { findFirst: () => Promise.resolve(jobRow) },
			application_records: { findMany: () => Promise.resolve(recordRows) }
		},
		update: () => ({ set: (...a: unknown[]) => mockAppUpdateSet(...a) }),
		insert: (table: unknown) => ({
			values: (v: unknown) => {
				if ((table as { id?: string })?.id === 'capability_edits.id') {
					mockEditLogInsert(v);
					return { returning: () => Promise.resolve([{ id: 999 }]) };
				}
				mockRecordInsert(v);
				return { returning: () => Promise.resolve([{ id: 777 }]) };
			}
		})
	},
	dbDirect: {
		query: {
			applications: { findFirst: () => Promise.resolve(applicationRow) },
			jobs: { findFirst: () => Promise.resolve(jobRow) },
			application_records: { findMany: () => Promise.resolve(recordRows) }
		},
		// The edit log writes through `dbDirect`, not `db` — see the alias in
		// edit-log.ts. Spelled out again rather than shared with the insert above,
		// for the same hoisting reason the query object is.
		insert: (table: unknown) => ({
			values: (v: unknown) => {
				if ((table as { id?: string })?.id === 'capability_edits.id') {
					mockEditLogInsert(v);
					return { returning: () => Promise.resolve([{ id: 999 }]) };
				}
				mockRecordInsert(v);
				return { returning: () => Promise.resolve([{ id: 777 }]) };
			}
		})
	}
}));

/**
 * The profile write layer, for the one thing this file asks of it: how many rows
 * a section has. `resolveMany` is a read, and what it returns decides whether a
 * capability prints its whole list or narrows to what the message named — which
 * is the behaviour, not the storage.
 */
let sectionRows: Record<string, Record<string, unknown>[]> = {};
vi.mock('$lib/server/profile/write', async (importOriginal) => {
	const actual = await importOriginal<typeof import('$lib/server/profile/write')>();
	return {
		...actual,
		readOwnedRow: (resource: string, _actor: unknown, id: number) =>
			Promise.resolve(sectionRows[resource]?.find((row) => row.id === id) ?? null),
		readOwnedRows: (resource: string) => Promise.resolve(sectionRows[resource] ?? [])
	};
});

vi.mock('$lib/server/db/schema', () => ({
	applications: {
		id: 'applications.id',
		profile_id: 'applications.profile_id'
	},
	jobs: { id: 'jobs.id' },
	job_importers: {},
	// Present so `recordEdit` can run for real. Without it the lazy import in
	// executeCapability threw, the catch there swallowed it, and every test in
	// this file passed while the log was never written — which is the failure
	// the log exists to make impossible.
	capability_edits: { id: 'capability_edits.id', profile_id: 'capability_edits.profile_id' },
	application_records: {
		application_id: 'application_records.application_id',
		event_date: 'application_records.event_date',
		date_created: 'application_records.date_created'
	},
	// The registry now includes the generated profile capabilities, so importing
	// it reaches PROFILE_RESOURCES and every table it declares. Placeholders, not
	// the real tables: the drizzle mock below returns whatever it was compared
	// against, and these strings are what makes a `where` argument readable in an
	// assertion. A new section failing here is the intended signal.
	profiles: { id: 'profiles.id', user_id: 'profiles.user_id' },
	work_experiences: { id: 'work_experiences.id', sort: 'work_experiences.sort' },
	education: { id: 'education.id', sort: 'education.sort' },
	side_projects: { id: 'side_projects.id', sort: 'side_projects.sort' },
	languages: { id: 'languages.id', sort: 'languages.sort' },
	references: { id: 'references.id', sort: 'references.sort' },
	certificates: { id: 'certificates.id', sort: 'certificates.sort' },
	highlights: { id: 'highlights.id', sort: 'highlights.sort' },
	// Skills are two tables, because a skill belongs to a category rather than to
	// the profile. `category_id` is the join the write layer follows to find out
	// whose a row is — see ResourceOwner.
	tech_skills: {
		id: 'tech_skills.id',
		sort: 'tech_skills.sort',
		category_id: 'tech_skills.category_id'
	},
	tech_skill_categories: {
		id: 'tech_skill_categories.id',
		sort: 'tech_skill_categories.sort',
		profile_id: 'tech_skill_categories.profile_id'
	},
	// The child collections. Each hangs off a row rather than off the profile,
	// so what they carry here is the foreign key the write layer follows —
	// `work_experience_project_technologies` twice over, since its parent is
	// itself parent-owned.
	work_experience_projects: {
		id: 'work_experience_projects.id',
		sort: 'work_experience_projects.sort',
		work_experience_id: 'work_experience_projects.work_experience_id'
	},
	work_experience_project_technologies: {
		id: 'work_experience_project_technologies.id',
		sort: 'work_experience_project_technologies.sort',
		work_experience_project_id: 'work_experience_project_technologies.work_experience_project_id'
	},
	work_experience_achievements: {
		id: 'work_experience_achievements.id',
		sort: 'work_experience_achievements.sort',
		work_experience_id: 'work_experience_achievements.work_experience_id'
	},
	work_experience_technologies: {
		id: 'work_experience_technologies.id',
		sort: 'work_experience_technologies.sort',
		work_experience_id: 'work_experience_technologies.work_experience_id'
	},
	side_project_achievements: {
		id: 'side_project_achievements.id',
		sort: 'side_project_achievements.sort',
		side_project_id: 'side_project_achievements.side_project_id'
	},
	side_project_technologies: {
		id: 'side_project_technologies.id',
		sort: 'side_project_technologies.sort',
		side_project_id: 'side_project_technologies.side_project_id'
	}
}));

// The two passes an applied entry triggers. Mocked to assert they run, in the
// order they have to run in — see the comment on add_activity_record's apply.
const mockDeriveRecord = vi.fn().mockResolvedValue(undefined);
const mockSummarize = vi.fn().mockResolvedValue(undefined);
vi.mock('../record-derivation', () => ({
	deriveRecordMetadata: (...a: unknown[]) => mockDeriveRecord(...a)
}));
vi.mock('../application-summary', () => ({
	summarizeApplication: (...a: unknown[]) => mockSummarize(...a)
}));

/**
 * The status write layer, mocked the way `edit-job` is: the capability's job is
 * to decide WHAT the application should say, and this file asserts that. What
 * the columns and the timeline row then do about it is `applications/status.ts`
 * and has its own tests.
 *
 * The pure half — the vocabulary and the status check — is kept real, because a
 * fake list would let a contract and a validator agree with each other and with
 * nothing the editor offers.
 */
const mockWriteStatus = vi.fn().mockResolvedValue({
	from: 'applying',
	logId: 5,
	replaced: false,
	appliedDateSet: null
});
const mockRevertStatus = vi.fn().mockResolvedValue(true);
vi.mock('$lib/server/applications/status', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/applications/status')>()),
	writeApplicationStatus: (...a: unknown[]) => mockWriteStatus(...a),
	revertApplicationStatus: (...a: unknown[]) => mockRevertStatus(...a)
}));

const mockCanEditJob = vi.fn();
const mockApplyJobFields = vi.fn().mockResolvedValue(undefined);
const mockApplyJobTexts = vi.fn().mockResolvedValue(undefined);
const mockApplyJobSkills = vi.fn().mockResolvedValue(undefined);

vi.mock('$lib/server/jobs/edit-job', async (importOriginal) => ({
	...(await importOriginal<typeof import('$lib/server/jobs/edit-job')>()),
	canEditJob: (...a: unknown[]) => mockCanEditJob(...a),
	applyJobFields: (...a: unknown[]) => mockApplyJobFields(...a),
	applyJobTexts: (...a: unknown[]) => mockApplyJobTexts(...a),
	applyJobSkills: (...a: unknown[]) => mockApplyJobSkills(...a)
}));

import {
	buildProposalSchema,
	CAPABILITIES,
	CAPABILITY_PROMPT_BUDGET_CHARS,
	TARGET_LIST_CAP,
	type Capability,
	capabilityFieldSchema,
	describeProposalChanges,
	executeCapability,
	fieldsFromChanges,
	fitMatchedCapabilities,
	type LiveCapability,
	pickCapabilityFields,
	renderCapabilityBlock,
	renderCapabilityPrompt,
	resolveCapabilities
} from '../capabilities';

/** What /applications/[id] declares — the busiest route in the table. */
const APPLICATION_PAGE_CAPABILITIES: Capability[] = [
	'edit_application_details',
	'update_application_status',
	'add_activity_record',
	'edit_job_details',
	'edit_job_description',
	'edit_job_skills'
];

const ACTOR = { profileId: 12, isStaff: false };

beforeEach(() => {
	sectionRows = {};
	vi.clearAllMocks();
	applicationRow = null;
	jobRow = null;
	recordRows = [];
	mockDeriveRecord.mockResolvedValue(undefined);
	mockSummarize.mockResolvedValue(undefined);
	mockCanEditJob.mockResolvedValue(true);
	mockApplyJobFields.mockResolvedValue(undefined);
	mockApplyJobTexts.mockResolvedValue(undefined);
	mockApplyJobSkills.mockResolvedValue(undefined);
	mockWriteStatus.mockResolvedValue({
		from: 'applying',
		logId: 5,
		replaced: false,
		appliedDateSet: null
	});
	mockRevertStatus.mockResolvedValue(true);
	mockAppUpdateSet.mockReturnValue({
		where: vi.fn().mockResolvedValue(undefined)
	});
});

describe('registry invariants', () => {
	it('makes a field name mean the same column everywhere it appears', () => {
		// buildProposalSchema merges the live capabilities' shapes into one enum,
		// and fieldsFromChanges then keeps whatever the named capability declares.
		// So a name shared by two capabilities that mean DIFFERENT columns by it
		// lets a value validate inside the wrong payload and land on the wrong row.
		//
		// This used to be asserted as "no name is ever shared", which was the same
		// rule while every capability acted on a different thing. It stopped being
		// so once the sections grew verbs: `edit_language` and `add_language` both
		// declare `language.name` and MUST, because it is one column and they
		// disagree only about whether the row exists yet. The verb is the model's
		// explicit choice and shows on the card, so that sharing is not ambiguity.
		//
		// What must still never happen is two capabilities over different things
		// sharing a name.
		const declarers = new Map<string, string[]>();
		for (const [name, def] of Object.entries(CAPABILITIES)) {
			for (const field of Object.keys(def.fields)) {
				declarers.set(field, [...(declarers.get(field) ?? []), name]);
			}
		}

		/** `add_language` and `edit_language` are two verbs over one thing. */
		const subject = (capability: string) => capability.slice(capability.indexOf('_') + 1);

		for (const [field, names] of declarers) {
			const subjects = new Set(names.map(subject));
			expect(
				[...subjects],
				`"${field}" is declared by ${names.join(' and ')}, which act on different things`
			).toHaveLength(1);
		}
	});

	it('makes every proposal field optional', () => {
		// "Absent means unchanged" only holds if nothing is required — a required
		// field would force the model to restate values it isn't changing, and
		// restated values are how a partial edit turns into a wipe.
		//
		// Asserted through the real wire schema rather than by inspecting each
		// field's type: it tests the shape the provider is actually handed.
		for (const name of Object.keys(CAPABILITIES)) {
			const result = buildProposalSchema([name as Capability]).safeParse({ reply: 'x' });
			expect(result.success, `${name} must accept an empty proposal`).toBe(true);
		}
	});
});

describe('a target list too long to print', () => {
	/** `n` skills, labelled the way the declaration labels them. */
	const givenSkills = (n: number) => {
		sectionRows.skill_category = [{ id: 1, name: 'Backend', profile_id: 12 }];
		sectionRows.skill = Array.from({ length: n }, (_, i) => ({
			id: 100 + i,
			name: i === 0 ? 'PostgreSQL' : `Thing ${i}`,
			category: 'Backend',
			profile_id: 12
		}));
	};

	it('prints every row while the section is small enough', async () => {
		givenSkills(TARGET_LIST_CAP);

		const [live] = await resolveCapabilities(['edit_skill'], null, ACTOR);

		expect(live.targets).toHaveLength(TARGET_LIST_CAP);
		expect(live.omitted).toBeUndefined();
	});

	it('narrows to the row the message named', async () => {
		// The case that matters on a real profile: 93 skills, and the one they are
		// asking about is in the message. Narrowed to one, it also gets its current
		// values — the same shape a detail page produces.
		givenSkills(TARGET_LIST_CAP + 20);

		const [live] = await resolveCapabilities(['edit_skill'], null, ACTOR, {
			message: 'can you set my PostgreSQL level to expert?'
		});

		// `match` rides along: the row's own name, for the next turn's narrowing.
		expect(live.targets).toEqual([{ id: 100, label: 'PostgreSQL — Backend', match: 'PostgreSQL' }]);
		expect(live.current).toMatchObject({ 'skill.name': 'PostgreSQL' });
		expect(live.omitted).toBe(TARGET_LIST_CAP + 19);
	});

	it('narrows on the skill, not on the words in its group’s note', async () => {
		// The label carries the group, and the group carries a note — "Backend
		// (Python / Django)". Matched whole, asking about Python reaches every row
		// of that group, which is not narrowing. `match` is the row's own name.
		sectionRows.skill_category = [
			{ id: 1, name: 'Backend', note: 'Python / Django', profile_id: 12 }
		];
		sectionRows.skill = Array.from({ length: TARGET_LIST_CAP + 20 }, (_, i) => ({
			id: 100 + i,
			name: i === 0 ? 'Python' : `Thing ${i}`,
			category: 'Backend (Python / Django)',
			profile_id: 12
		}));

		const [live] = await resolveCapabilities(['edit_skill'], null, ACTOR, {
			message: 'set my Python level to expert'
		});

		expect(live.targets).toEqual([
			{ id: 100, label: 'Python — Backend (Python / Django)', match: 'Python' }
		]);
	});

	it('falls back to the head of the list when the message names none', async () => {
		givenSkills(TARGET_LIST_CAP + 20);

		const [live] = await resolveCapabilities(['edit_skill'], null, ACTOR, {
			message: 'what should I be learning next?'
		});

		expect(live.targets).toHaveLength(TARGET_LIST_CAP);
		expect(live.omitted).toBe(20);
	});

	it('says the list is partial rather than letting it read as the whole section', async () => {
		// A truncated list that reads like the whole list is an assistant telling
		// someone they have no such skill because it sorted 41st.
		givenSkills(TARGET_LIST_CAP + 20);

		const live = await resolveCapabilities(['edit_skill'], null, ACTOR, {
			message: 'what should I be learning next?'
		});

		expect(renderCapabilityPrompt(live)).toContain('20 more exist and are not listed');
	});

	it('prints one list for a section, not one per verb', async () => {
		// `hide_*` resolves the same rows as `edit_*` by construction. Printing
		// them twice is the section's whole list again, for nothing.
		givenSkills(10);

		const live = await resolveCapabilities(['edit_skill', 'hide_skill'], null, ACTOR);
		const prompt = renderCapabilityPrompt(live);

		expect(prompt.match(/target_id 100: PostgreSQL/g)).toHaveLength(1);
		expect(prompt).toContain('the rows listed under edit_skill above');
	});
});

describe('resolveCapabilities', () => {
	it('reaches the attached job from an application page', async () => {
		applicationRow = { id: 42, job_id: 900 };
		jobRow = { id: 900, title: 'Staff Engineer', company: 'Acme' };

		const live = await resolveCapabilities(
			['edit_job_details'],
			{ type: 'application', id: 42 },
			ACTOR
		);

		expect(live).toHaveLength(1);
		expect(live[0].targets).toEqual([{ id: 900, label: 'Staff Engineer at Acme' }]);
	});

	it('drops the job capabilities when the application has no job', async () => {
		applicationRow = { id: 42, job_id: null };

		const live = await resolveCapabilities(
			['edit_job_details', 'edit_job_description'],
			{ type: 'application', id: 42 },
			ACTOR
		);

		expect(live).toEqual([]);
	});

	it('drops a capability the actor is not allowed to use', async () => {
		// A scraped job, or a manual one this profile didn't import. The assistant
		// is never told it could edit it, rather than offering an edit that 403s.
		jobRow = { id: 900, title: 'Staff Engineer', company: 'Acme' };
		mockCanEditJob.mockResolvedValue(false);

		const live = await resolveCapabilities(['edit_job_details'], { type: 'job', id: 900 }, ACTOR);

		expect(live).toEqual([]);
	});

	it('asks authorize even though the entity already resolved', async () => {
		// resolveEntity resolves any job to any signed-in user by design, because
		// /jobs/[id] renders any job to any signed-in user. Edit rights are a
		// separate question and must be asked separately.
		jobRow = { id: 900, title: 'Staff Engineer', company: null };

		await resolveCapabilities(
			['edit_job_details'],
			{
				type: 'job',
				id: 900
			},
			ACTOR
		);

		expect(mockCanEditJob).toHaveBeenCalledWith(900, 12, false);
	});

	it('resolves nothing without an entity', async () => {
		const live = await resolveCapabilities(
			['edit_job_details', 'edit_application_details'],
			null,
			ACTOR
		);
		expect(live).toEqual([]);
	});

	it('does not offer application edits on a job page', async () => {
		jobRow = { id: 900, title: 'Staff Engineer', company: null };

		const live = await resolveCapabilities(
			['edit_application_details'],
			{ type: 'job', id: 900 },
			ACTOR
		);

		expect(live).toEqual([]);
	});

	it('carries the current values so the model can propose a diff', async () => {
		jobRow = {
			id: 900,
			title: 'Staff Engineer',
			company: 'Acme',
			salary_min: 100,
			salary_period: 'year',
			work_location: ['remote']
		};

		const live = await resolveCapabilities(['edit_job_details'], { type: 'job', id: 900 }, ACTOR);

		expect(live[0].current).toMatchObject({
			title: 'Staff Engineer',
			salary_min: 100,
			work_location: ['remote']
		});
	});
});

describe('pickCapabilityFields', () => {
	it('drops fields that belong to another capability', () => {
		// The provider sees one merged object, so a model can put a job field in an
		// application proposal and have it validate. This is where that is undone.
		const picked = pickCapabilityFields('edit_application_details', {
			cv_sent_through: 'LinkedIn',
			salary_min: 999,
			title: 'Nope'
		});
		expect(picked).toEqual({ cv_sent_through: 'LinkedIn' });
	});
});

describe('edit_job_details', () => {
	const def = CAPABILITIES.edit_job_details;
	const target = { id: 900, label: 'Staff Engineer at Acme' };

	it('merges a partial proposal over the current row', async () => {
		// The single most important behaviour here: applyJobFields is authoritative
		// for every column it writes, so an unmerged partial would clear the twelve
		// fields the model didn't mention.
		const current = {
			title: 'Staff Engineer',
			company: 'Acme',
			salary_min: 100000,
			salary_max: 130000,
			salary_currency: 'EUR',
			salary_period: 'year',
			work_location: ['remote']
		};

		await def.apply(target, { salary_max: 140000 }, current, ACTOR);

		expect(mockApplyJobFields).toHaveBeenCalledWith(
			900,
			expect.objectContaining({
				title: 'Staff Engineer',
				company: 'Acme',
				salary_min: 100000,
				salary_max: 140000,
				work_location: ['remote']
			})
		);
	});

	it('lets an explicit null clear a column', async () => {
		await def.apply(
			target,
			{ salary_min: null },
			{
				title: 'Staff Engineer',
				salary_min: 100000
			},
			ACTOR
		);

		expect(mockApplyJobFields).toHaveBeenCalledWith(
			900,
			expect.objectContaining({ salary_min: null })
		);
	});

	it('rejects a proposal that would empty the title', () => {
		const res = def.validate({ title: null }, { title: 'Staff Engineer' });
		expect(res.ok).toBe(false);
	});

	it('accepts a proposal that leaves the title alone', () => {
		const res = def.validate({ salary_min: 50 }, { title: 'Staff Engineer' });
		expect(res.ok).toBe(true);
	});
});

describe('edit_job_description', () => {
	const def = CAPABILITIES.edit_job_description;
	const target = { id: 900, label: 'x' };

	it('rejects an empty job description', () => {
		expect(def.validate({ job_description: '   ' }, {}).ok).toBe(false);
	});

	it('accepts a proposal that only touches the company profile', () => {
		// The gap this closes: with job_description as the only field, a request to
		// fix the "About the company" blurb had nowhere to go, so the model wrote
		// company text into the posting and then claimed it had removed details
		// that were still sitting in the field it could not reach.
		expect(def.validate({ company_description: 'About G2i…' }, {}).ok).toBe(true);
	});

	it('covers both long-form texts', () => {
		expect(Object.keys(def.fields).sort()).toEqual(['company_description', 'job_description']);
	});

	it('writes only the text that was proposed', async () => {
		// applyJobTexts leaves an omitted field alone, so rewriting one text must
		// never blank the other.
		await def.apply(target, { company_description: 'About G2i' }, {}, ACTOR);
		expect(mockApplyJobTexts).toHaveBeenCalledWith(900, {
			company_description: 'About G2i'
		});
		expect(mockApplyJobTexts.mock.calls[0][1]).not.toHaveProperty('job_description');
	});

	it('writes both when both are proposed', async () => {
		await def.apply(
			target,
			{
				job_description: 'New posting',
				company_description: 'New blurb'
			},
			{},
			ACTOR
		);
		expect(mockApplyJobTexts).toHaveBeenCalledWith(900, {
			job_description: 'New posting',
			company_description: 'New blurb'
		});
	});

	it('tells the model which field holds which subject', async () => {
		// Without this the model routes a company correction into the posting —
		// the exact failure that produced three rewrites of the wrong field.
		jobRow = { id: 900, title: 'Evaluator', company: 'G2i' };
		const live = await resolveCapabilities(
			['edit_job_description'],
			{ type: 'job', id: 900 },
			ACTOR
		);
		const prompt = renderCapabilityPrompt(live);
		expect(prompt).toMatch(/about the ROLE/i);
		expect(prompt).toMatch(/about the COMPANY/i);
		expect(prompt).toMatch(/change THAT field/i);
	});
});

describe('edit_job_skills', () => {
	const def = CAPABILITIES.edit_job_skills;
	const target = { id: 900, label: 'Senior Full Stack Engineer at Verdo' };

	it('writes only the list that was proposed', async () => {
		// Each list is replaced whole, so passing the untouched one through as null
		// would empty it. Absent has to stay absent all the way to the column.
		await def.apply(
			target,
			{ skills_required: ['React', 'Node.js'] },
			{
				skills_required: ['React', 'Next.js', 'Node.js'],
				skills_preferred: ['LangGraph']
			},
			ACTOR
		);

		expect(mockApplyJobSkills).toHaveBeenCalledWith(900, {
			skills_required: ['React', 'Node.js']
		});
		expect(mockApplyJobSkills.mock.calls[0][1]).not.toHaveProperty('skills_preferred');
	});

	it('lets an explicit null clear a list', async () => {
		await def.apply(target, { skills_preferred: null }, {}, ACTOR);
		expect(mockApplyJobSkills).toHaveBeenCalledWith(900, {
			skills_preferred: null
		});
	});

	it('reads both lists as the current values', async () => {
		jobRow = {
			id: 900,
			skills_required: ['React', 'Next.js'],
			skills_preferred: ['pgvector']
		};
		expect(await def.current(target, ACTOR)).toEqual({
			skills_required: ['React', 'Next.js'],
			skills_preferred: ['pgvector']
		});
	});

	it("reads an unextracted job's lists as unset, not as empty", async () => {
		// A job the parser never got to has null columns. They must render as "not
		// set" so the model proposes a list rather than a diff against [].
		jobRow = { id: 900 };
		expect(await def.current(target, ACTOR)).toEqual({
			skills_required: null,
			skills_preferred: null
		});
	});

	it('refuses a sentence dressed as a skill', () => {
		// The failure mode the length cap exists for: the model pastes a
		// requirement line out of the posting, and it renders as a chip.
		const res = def.validate(
			{
				skills_required: [
					'React',
					'At least 5 years of experience building distributed payment ' +
						'systems in a regulated environment'
				]
			},
			{}
		);
		expect(res.ok).toBe(false);
	});

	it('refuses a list longer than any real posting', () => {
		const res = def.validate(
			{ skills_preferred: Array.from({ length: 61 }, (_, i) => `skill${i}`) },
			{}
		);
		expect(res.ok).toBe(false);
	});

	it('accepts a realistic list, and a clear', () => {
		expect(def.validate({ skills_required: ['React', 'Node.js'] }, {}).ok).toBe(true);
		expect(def.validate({ skills_required: null }, {}).ok).toBe(true);
		expect(def.validate({}, {}).ok).toBe(true);
	});

	it('tells the model the list is replaced whole, not edited', async () => {
		// Without this the model sends ["Next.js"] meaning "drop this one" and
		// deletes the other thirteen. It is the single rule this capability cannot
		// ship without.
		jobRow = { id: 900, title: 'Senior Full Stack Engineer', company: 'Verdo' };
		const live = await resolveCapabilities(['edit_job_skills'], { type: 'job', id: 900 }, ACTOR);

		const prompt = renderCapabilityPrompt(live);
		expect(prompt).toMatch(/REPLACED\s+WHOLE/);
		expect(prompt).toMatch(/deletes\s+all\s+the\s+others/i);
		expect(prompt).toMatch(/re-scores\s+it/i);
	});

	it('shows the current skills so the model can drop one', async () => {
		// The whole reason chat 53 removed Next.js from the description and left it
		// in the skills: nothing the model could see listed it as a skill.
		jobRow = {
			id: 900,
			title: 'Senior Full Stack Engineer',
			company: 'Verdo',
			skills_required: ['React', 'Next.js', 'Node.js']
		};
		const live = await resolveCapabilities(['edit_job_skills'], { type: 'job', id: 900 }, ACTOR);

		expect(renderCapabilityPrompt(live)).toContain('Next.js');
	});

	it('is offered on an application page too, via the attached job', async () => {
		applicationRow = { id: 42, job_id: 900 };
		jobRow = { id: 900, title: 'Staff Engineer', company: 'Acme' };

		const live = await resolveCapabilities(
			['edit_job_skills'],
			{ type: 'application', id: 42 },
			ACTOR
		);
		expect(live[0]?.targets[0]).toMatchObject({ id: 900 });
	});

	it('drops out for a job this profile may not edit', async () => {
		jobRow = { id: 900, title: 'Staff Engineer', company: 'Acme' };
		mockCanEditJob.mockResolvedValue(false);

		expect(
			await resolveCapabilities(
				['edit_job_skills'],
				{
					type: 'job',
					id: 900
				},
				ACTOR
			)
		).toEqual([]);
	});
});

describe('edit_application_details', () => {
	const def = CAPABILITIES.edit_application_details;

	it("rejects a date that isn't YYYY-MM-DD", () => {
		expect(def.validate({ application_sent_date: '30-07-2026' }, {}).ok).toBe(false);
		expect(def.validate({ application_sent_date: '2026-07-30' }, {}).ok).toBe(true);
	});

	it('merges over current values rather than clearing the rest', async () => {
		await def.apply(
			{ id: 42, label: 'x' },
			{
				application_seen_date: '2026-08-01'
			},
			{
				cv_sent_through: 'LinkedIn',
				application_sent_date: '2026-07-30',
				application_seen_date: null
			},
			ACTOR
		);

		expect(mockAppUpdateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				cv_sent_through: 'LinkedIn',
				application_sent_date: '2026-07-30',
				application_seen_date: '2026-08-01'
			})
		);
	});

	it('only authorizes an application this profile owns', async () => {
		applicationRow = null;
		expect(await def.authorize({ id: 42, label: 'x' }, ACTOR)).toBe(false);

		applicationRow = { id: 42 };
		expect(await def.authorize({ id: 42, label: 'x' }, ACTOR)).toBe(true);
	});
});

describe('update_application_status', () => {
	const def = CAPABILITIES.update_application_status;
	const APPLYING = {
		status: 'applying',
		status_step: 'Applied through job platform',
		status_action: 'Awaiting response',
		status_action_date: null
	};

	const apply = (fields: Record<string, unknown>, current = APPLYING) =>
		def.apply({ id: 49, label: 'x' }, fields, current, ACTOR);

	it('only accepts a status the pipeline actually has', () => {
		expect(def.validate({ status: 'interviewing' }, APPLYING).ok).toBe(true);
		expect(def.validate({ status: 'ghosted' }, APPLYING).ok).toBe(false);
		// The read-side legacy names render on old rows and must not be written
		// onto new ones — see `settableStatuses`.
		expect(def.validate({ status: 'offered' }, APPLYING).ok).toBe(false);
		expect(def.validate({ status: 'draft' }, APPLYING).ok).toBe(false);
	});

	it('holds a proposed stage to the ones that status has', () => {
		expect(
			def.validate({ status: 'interviewing', status_step: 'Team interview' }, APPLYING).ok
		).toBe(true);

		// Right label, wrong status: "Offer received" is a negotiating stage, and
		// accepting it here is how a stage ends up under a status it cannot be
		// reached from.
		const wrong = def.validate({ status: 'interviewing', status_step: 'Offer received' }, APPLYING);
		expect(wrong.ok).toBe(false);
		expect(wrong.ok === false && wrong.error).toContain('Screening call');
	});

	it('refuses a stage on a status that finishes the application', () => {
		const refused = def.validate(
			{ status: 'rejected', status_step: 'Technical interview' },
			APPLYING
		);
		expect(refused.ok).toBe(false);
		expect(refused.ok === false && refused.error).toContain('no stage');

		expect(def.validate({ status: 'rejected' }, APPLYING).ok).toBe(true);
		expect(def.validate({ status: 'rejected', status_step: null }, APPLYING).ok).toBe(true);
	});

	it('accepts a next action the stage offers, and one the phase does', () => {
		// From actionsByStep for that stage.
		expect(
			def.validate(
				{ status: 'interviewing', status_step: 'Technical interview', status_action: 'Scheduled' },
				APPLYING
			).ok
		).toBe(true);
		// From actionsByPhase, which the editor falls back to.
		expect(
			def.validate(
				{
					status: 'interviewing',
					status_step: 'Technical interview',
					status_action: 'Provide references'
				},
				APPLYING
			).ok
		).toBe(true);
		expect(
			def.validate({ status: 'interviewing', status_action: 'Send application' }, APPLYING).ok
		).toBe(false);
	});

	it('leaves a stage the applicant typed themselves alone', () => {
		// The editor offers "Custom…", so a stage on the row is not necessarily one
		// from the list. Validating the CARRIED value rather than the proposed one
		// would refuse a proposal about the next action because of a label nobody
		// proposed — and make this stricter than the form it mirrors.
		const custom = { ...APPLYING, status: 'interviewing', status_step: 'Coffee chat with the CTO' };
		expect(def.validate({ status_action: 'Awaiting result' }, custom).ok).toBe(true);
	});

	it('rejects a note long enough to be the account of what happened', () => {
		// Carried on a real move, since a note on its own is refused above.
		const withMove = (note: string) => ({ status: 'interviewing', status_note: note });
		expect(def.validate(withMove('x'.repeat(301)), APPLYING).ok).toBe(false);
		expect(def.validate(withMove('x'.repeat(300)), APPLYING).ok).toBe(true);
	});

	it('refuses a note with no move to hang it on', async () => {
		// A note has no current value, so `tierForWrite` would grade a note-only
		// call additive and write it directly — a timeline row saying the
		// application went from "applying" to "applying".
		const refused = def.validate({ status_note: 'they seemed keen' }, APPLYING);
		expect(refused.ok).toBe(false);
		expect(refused.ok === false && refused.error).toContain('add_activity_record');

		expect(
			def.validate({ status: 'interviewing', status_note: 'they seemed keen' }, APPLYING).ok
		).toBe(true);
	});

	it('clears the stage and the next action when the status moves without them', async () => {
		await apply({ status: 'interviewing' });

		expect(mockWriteStatus).toHaveBeenCalledWith(
			49,
			ACTOR.profileId,
			expect.objectContaining({ status: 'interviewing', step: null, action: null })
		);
	});

	it('keeps them when the status is not what moved', async () => {
		await apply({ status_action_date: '2026-09-01' });

		expect(mockWriteStatus).toHaveBeenCalledWith(
			49,
			ACTOR.profileId,
			expect.objectContaining({
				status: 'applying',
				step: 'Applied through job platform',
				action: 'Awaiting response',
				actionDate: '2026-09-01'
			})
		);
	});

	it('carries a proposed stage through the move', async () => {
		await apply({
			status: 'interviewing',
			status_step: 'Technical interview',
			status_action: 'Scheduled',
			status_note: '  second round with the client  '
		});

		expect(mockWriteStatus).toHaveBeenCalledWith(49, ACTOR.profileId, {
			status: 'interviewing',
			step: 'Technical interview',
			action: 'Scheduled',
			actionDate: null,
			description: 'second round with the client'
		});
	});

	it('drops the stage entirely for a status that finishes the application', async () => {
		await apply({ status: 'rejected' });

		expect(mockWriteStatus).toHaveBeenCalledWith(49, ACTOR.profileId, {
			status: 'rejected',
			step: null,
			action: null,
			actionDate: null,
			description: null
		});
	});

	it('records every column it could clear, not only the ones proposed', async () => {
		// The undo case this exists for: the proposal names the status alone, the
		// write clears the stage as well, and a before-image of the proposed
		// fields would put the status back with the stage still gone.
		const before = await def.beforeImage?.({ id: 49, label: 'x' }, APPLYING, ACTOR);

		expect(before).toEqual(APPLYING);
	});

	it('puts back what the write replaced', async () => {
		await def.revert?.({ id: 49, label: 'x' }, APPLYING, ACTOR);

		expect(mockRevertStatus).toHaveBeenCalledWith(49, ACTOR.profileId, {
			status: 'applying',
			step: 'Applied through job platform',
			action: 'Awaiting response',
			actionDate: null,
			description: null
		});
	});

	it('refuses an undo with no status recorded rather than writing an empty one', async () => {
		await expect(def.revert?.({ id: 49, label: 'x' }, {}, ACTOR)).rejects.toThrow();
		expect(mockRevertStatus).not.toHaveBeenCalled();
	});
});

describe('buildProposalSchema', () => {
	it('accepts the loose shapes both providers actually return', () => {
		// gpt-oss returns bare values where arrays belong and quotes its numbers.
		// The wire schema has to ADMIT those rather than reject the turn — it
		// cannot fix them, because a schema that coerces can't be converted to
		// JSON Schema, and the provider needs JSON Schema. fieldsFromChanges does
		// the fixing, below.
		const schema = buildProposalSchema(['edit_job_details']);
		const parsed = schema.parse({
			reply: 'Sure.',
			proposals: [
				{
					capability: 'edit_job_details',
					rationale: 'Matches the posting.',
					changes: [
						{ field: 'salary_min', value: '55,000' },
						{ field: 'work_location', value: 'remote' },
						{ field: 'job_types', value: ['contract'] }
					]
				}
			]
		});

		expect(parsed.proposals?.[0].changes[0].value).toBe('55,000');
		expect(parsed.proposals?.[0].changes[1].value).toBe('remote');
	});

	it('rejects a field name outside the live capabilities', () => {
		// The enum constrains the provider at generation time, so a cross-
		// capability field can't be produced in the first place.
		const schema = buildProposalSchema(['edit_job_description']);
		expect(() =>
			schema.parse({
				reply: 'x',
				proposals: [
					{
						capability: 'edit_job_description',
						rationale: 'y',
						changes: [{ field: 'salary_min', value: 1 }]
					}
				]
			})
		).toThrow();
	});

	it('carries two proposals from one turn', () => {
		// The shape that removes the two-turn dance: a message asking for a field
		// fix AND a rewrite comes back as two entries, which become two cards with
		// independent Apply buttons. Measured against the real model before it was
		// built — 3/3 runs returned both, populated.
		const schema = buildProposalSchema(['edit_job_details', 'edit_job_description']);
		const parsed = schema.parse({
			reply: 'Both done.',
			proposals: [
				{
					capability: 'edit_job_details',
					rationale: 'Corrects the salary.',
					changes: [{ field: 'salary_min', value: 120000 }]
				},
				{
					capability: 'edit_job_description',
					rationale: 'Leads with the migration.',
					changes: [{ field: 'job_description', value: 'New text.' }]
				}
			]
		});

		expect(parsed.proposals).toHaveLength(2);
		expect(parsed.proposals?.map((p) => p.capability)).toEqual([
			'edit_job_details',
			'edit_job_description'
		]);
	});

	it('folds a change list into coerced fields', () => {
		expect(
			fieldsFromChanges('edit_job_details', [
				{ field: 'salary_min', value: '55,000' },
				{ field: 'work_location', value: 'remote' },
				{ field: 'cv_sent_through', value: 'LinkedIn' }
			])
		).toEqual({ salary_min: 55000, work_location: ['remote'] });
	});

	it("lets a repeated field's last entry win", () => {
		expect(
			fieldsFromChanges('edit_job_details', [
				{ field: 'salary_min', value: 100 },
				{ field: 'salary_min', value: 200 }
			])
		).toEqual({ salary_min: 200 });
	});

	it('stays convertible to JSON Schema', () => {
		// The reason the wire types are plain. A transform anywhere in here makes
		// LangChain throw "Transforms cannot be represented in JSON Schema" and
		// every capable turn fails — which is exactly how this shipped the first
		// time. z.toJSONSchema is the same conversion the provider path does.
		for (const capability of Object.keys(CAPABILITIES) as Capability[]) {
			expect(() => z.toJSONSchema(buildProposalSchema([capability]))).not.toThrow();
		}
		expect(() =>
			z.toJSONSchema(buildProposalSchema(Object.keys(CAPABILITIES) as Capability[]))
		).not.toThrow();
	});

	it('treats absent, null or empty proposals as no proposal', () => {
		const schema = buildProposalSchema(['edit_job_details']);
		expect(schema.parse({ reply: 'Just answering.' }).proposals).toBeUndefined();
		expect(schema.parse({ reply: 'x', proposals: null }).proposals).toBeNull();
		expect(schema.parse({ reply: 'x', proposals: [] }).proposals).toEqual([]);
	});

	it('only admits the capabilities that are live this turn', () => {
		const schema = buildProposalSchema(['edit_job_description']);
		expect(() =>
			schema.parse({
				reply: 'x',
				proposals: [
					{
						capability: 'edit_job_details',
						rationale: 'y',
						changes: []
					}
				]
			})
		).toThrow();
	});
});

describe('pickCapabilityFields — coercion', () => {
	it('repairs the shapes the wire schema had to let through', () => {
		const picked = pickCapabilityFields('edit_job_details', {
			salary_min: '55,000',
			salary_max: 70000.4,
			work_location: 'remote',
			job_types: ['contract'],
			company: '  Acme  '
		});

		expect(picked).toEqual({
			salary_min: 55000,
			salary_max: 70000,
			work_location: ['remote'],
			job_types: ['contract'],
			company: 'Acme'
		});
	});

	it('splits a comma-joined list into an array', () => {
		expect(
			pickCapabilityFields('edit_job_details', {
				experience_levels: 'senior, lead'
			})
		).toEqual({ experience_levels: ['senior', 'lead'] });
	});

	it('empties a blank string rather than writing one', () => {
		expect(pickCapabilityFields('edit_job_details', { company: '   ' })).toEqual({ company: null });
	});

	it('keeps an explicit null as a clear instruction', () => {
		expect(pickCapabilityFields('edit_job_details', { salary_min: null })).toEqual({
			salary_min: null
		});
	});

	it('drops a number it cannot make sense of', () => {
		expect(pickCapabilityFields('edit_job_details', { salary_min: 'competitive' })).toEqual({
			salary_min: null
		});
	});
});

describe('describeProposalChanges', () => {
	it('pairs each proposed field with what it replaces', () => {
		const changes = describeProposalChanges(
			'edit_job_details',
			{ salary_min: 55000, work_location: ['hybrid'] },
			{ salary_min: 50000, work_location: ['remote'], company: 'Acme' }
		);

		expect(changes).toEqual([
			{ field: 'salary_min', label: 'Salary min', from: '50000', to: '55000' },
			{
				field: 'work_location',
				label: 'Work arrangement',
				from: 'remote',
				to: 'hybrid'
			}
		]);
	});

	it('drops fields the model restated without changing', () => {
		// Models echo unchanged values back despite being told not to; a "change"
		// that changes nothing is noise between the user and the real one.
		const changes = describeProposalChanges(
			'edit_job_details',
			{ company: 'Acme', salary_min: 55000 },
			{ company: 'Acme', salary_min: 50000 }
		);
		expect(changes.map((c) => c.field)).toEqual(['salary_min']);
	});

	it('renders an unset current value as a dash', () => {
		const changes = describeProposalChanges(
			'edit_job_details',
			{ company: 'Acme' },
			{ company: null }
		);
		expect(changes[0].from).toBe('—');
	});
});

/**
 * Invariants over the registry as a whole, which no single capability's tests
 * can see. Both are stated in CapabilityDef's doc comment and neither was
 * checked anywhere — the kind of rule that holds until the day someone adds the
 * entry that breaks it, and then fails somewhere else entirely.
 */
describe('the registry as a whole', () => {
	it('has no two SUBJECTS declaring the same field name', () => {
		// buildProposalSchema flattens every live capability's fields into ONE
		// enum for the provider. A shared name is therefore not a collision the
		// model can be blamed for: it can put a value under a name two
		// capabilities answer to, and pickCapabilityFields — which filters by
		// name, having no other signal — hands it to whichever one is being read.
		// The proposal that loses is dropped silently.
		//
		// Grouped by SUBJECT rather than by capability, since the sections grew
		// verbs: `edit_language` and `add_language` answer to `language.name` and
		// have to, because it is one column. What must stay distinct is the thing
		// being written to, not the operation.
		//
		// Enforced across ALL capabilities rather than only co-live ones. The
		// stricter rule is the one the doc comment states, it costs nothing while
		// the names are already distinct, and "these two are never live together"
		// is a fact about ROUTE_SCOPES that a future route can change without
		// anyone thinking about this file.
		const subject = (capability: string) => capability.slice(capability.indexOf('_') + 1);
		const owners = new Map<string, Set<string>>();
		for (const [capability, def] of Object.entries(CAPABILITIES)) {
			for (const field of Object.keys(def.fields)) {
				owners.set(field, (owners.get(field) ?? new Set()).add(subject(capability)));
			}
		}

		const shared = [...owners.entries()].filter(([, subjects]) => subjects.size > 1);
		expect(shared.map(([field, subjects]) => `${field}: ${[...subjects].join(', ')}`)).toEqual([]);
	});

	it('keeps the capabilities one page can grant inside its budget', () => {
		// A ratchet, in the style of CI's svelte-check baseline: it may go down
		// freely and up only deliberately.
		//
		// Every live capability's contract ships on every capable turn, because a
		// single structured-output call has to carry the rules for anything it
		// might propose. That cost is inherent to the shape and can't be hoisted
		// away — measured, when the shared rules were pulled into the preamble it
		// saved 524 characters across the five blocks and spent 550 stating them
		// once, because only edit_job_details had carried all three. What CAN be
		// hoisted already has been; the remaining lever is progressive disclosure
		// (the model asks for a contract when it wants one), which needs
		// tool-calling and a second round trip.
		//
		// This measures the hand-written capabilities together because those
		// genuinely co-occur: a job page grants three, an application page grants
		// five. It deliberately does NOT measure every capability at once — that
		// is a state no route can reach, and the arrangements that ARE reachable
		// are asserted below.
		const live = (Object.keys(CAPABILITIES) as Capability[])
			.filter((capability) => !PROFILE_CAPABILITY_NAMES.includes(capability as never))
			.map((capability) => ({ capability, targets: [{ id: 1, label: 'x' }], current: {} }));

		expect(renderCapabilityPrompt(live).length).toBeLessThanOrEqual(CAPABILITY_PROMPT_BUDGET_CHARS);
	});

	it('keeps the worst page a message can reach inside the budget', () => {
		// The arrangement that actually binds, since message matching: the busiest
		// page's own capabilities PLUS a whole section the message named. Neither
		// half is measured by the per-capability ceiling below, and the two arrive
		// together by design rather than by accident.
		//
		// Twelve rows because a target list grows with the profile — three would
		// measure the feature rather than the applicant. Measured at 17,828.
		//
		// This has to fail before the runtime starts dropping. `fitMatchedCapabilities`
		// degrades gracefully when a turn does not fit, which is right for a heavy
		// profile and wrong as a way to absorb a contract that grew: the section
		// would stop being offered and nothing would say so.
		const roles = Array.from({ length: 12 }, (_, i) => ({
			id: i + 1,
			label: `Senior Software Engineer at Some Company Name ${i}`
		}));

		const applicationPage = APPLICATION_PAGE_CAPABILITIES.map((capability) => ({
			capability,
			targets: [{ id: 1, label: 'x' }],
			current: {}
		}));

		const matchedSection: LiveCapability[] = [
			{ capability: 'edit_work_experience', targets: roles, current: null },
			{
				capability: 'add_work_experience',
				targets: [{ id: 12, label: 'their work experience' }],
				current: { existing: roles.map((r) => r.label) }
			},
			{ capability: 'hide_work_experience', targets: roles, current: null }
		];

		expect(
			renderCapabilityPrompt([...applicationPage, ...matchedSection]).length
		).toBeLessThanOrEqual(CAPABILITY_PROMPT_BUDGET_CHARS);
	});

	/**
	 * A real profile's skills, in shape and in size: seven groups and 93 skills,
	 * two of the groups being version variants that share a heading. Names are
	 * padded to the length real ones run to — a fixture of "a", "b", "c" would
	 * measure the code rather than the applicant.
	 */
	const SKILL_GROUPS = [
		'Backend (Python / Django)',
		'Backend (TypeScript / React)',
		'Frontend',
		'AI & LLM engineering',
		'Databases',
		'DevOps & Cloud',
		'Tooling & Methodology'
	];
	const SKILL_INVENTORY = {
		parents: SKILL_GROUPS,
		existingByGroup: Object.fromEntries(
			SKILL_GROUPS.map((group, i) => [
				group,
				Array.from({ length: i === 0 ? 33 : 10 }, (_, n) => `PostgreSQL ${n}`)
			])
		)
	};

	it('keeps the biggest section a message can reach inside the budget', () => {
		// Skills are the section that made TARGET_LIST_CAP necessary: 93 of them on
		// the profile this was measured against, against twelve roles for the
		// arrangement above. Two of the three verbs list rows, so an uncapped list
		// would have put ~6,500 characters of skill names into every turn that
		// mentioned the section — and the group would then have been dropped for
		// not fitting, which is the feature silently not working.
		//
		// Capped, this is the same shape as the work-history case above, and it is
		// asserted for the same reason: the runtime degrades gracefully when a turn
		// does not fit, which is right for a heavy profile and wrong as a way to
		// absorb a contract that grew.
		const skills = Array.from({ length: TARGET_LIST_CAP }, (_, i) => ({
			id: i + 1,
			label: `PostgreSQL ${i} — Backend (TypeScript / React)`
		}));

		const applicationPage = APPLICATION_PAGE_CAPABILITIES.map((capability) => ({
			capability,
			targets: [{ id: 1, label: 'x' }],
			current: {}
		}));

		const matchedSection: LiveCapability[] = [
			{ capability: 'edit_skill', targets: skills, current: null, omitted: 53 },
			{
				capability: 'add_skill',
				targets: [{ id: 12, label: 'their skills' }],
				current: SKILL_INVENTORY
			},
			{ capability: 'hide_skill', targets: skills, current: null, omitted: 53 }
		];

		expect(
			renderCapabilityPrompt([...applicationPage, ...matchedSection]).length
		).toBeLessThanOrEqual(CAPABILITY_PROMPT_BUDGET_CHARS);
	});

	it('keeps the skills page inside the budget with both its sections live', () => {
		// /profile/skills grants six capabilities — three verbs over skills and
		// three over the groups — because two sections share one page. Nothing
		// drops a page's OWN capabilities, so this one is not protected by
		// fitMatchedCapabilities and has to fit on its own.
		const skills = Array.from({ length: TARGET_LIST_CAP }, (_, i) => ({
			id: i + 1,
			label: `PostgreSQL ${i} — Backend (TypeScript / React)`
		}));
		const groups = SKILL_GROUPS.map((label, i) => ({ id: 100 + i, label }));

		const live: LiveCapability[] = [
			{ capability: 'edit_skill', targets: skills, current: null, omitted: 53 },
			{
				capability: 'add_skill',
				targets: [{ id: 1, label: 'their skills' }],
				current: SKILL_INVENTORY
			},
			{ capability: 'hide_skill', targets: skills, current: null, omitted: 53 },
			{ capability: 'edit_skill_category', targets: groups, current: null },
			{
				capability: 'add_skill_category',
				targets: [{ id: 1, label: 'their skill categories' }],
				current: { existing: SKILL_GROUPS }
			},
			{ capability: 'hide_skill_category', targets: groups, current: null }
		];

		expect(renderCapabilityPrompt(live).length).toBeLessThanOrEqual(CAPABILITY_PROMPT_BUDGET_CHARS);
	});

	describe('fitMatchedCapabilities', () => {
		// Real capability names, so the sizes measured are the sizes shipped.
		// `hide` only exists for the three sections that can be hidden, so a
		// section's group is two or three entries depending on which it is.
		const section = (resource: string): LiveCapability[] =>
			(['edit', 'add', 'hide'] as const)
				.map((verb) => `${verb}_${resource}` as Capability)
				.filter((capability) => capability in CAPABILITIES)
				.map((capability) => ({
					capability,
					targets: [{ id: 1, label: 'x' }],
					current: {}
				}));

		it('admits a matched section when it fits', () => {
			const granted = section('language');
			const fitted = fitMatchedCapabilities(granted, [section('certificate')]);

			expect(fitted.map((c) => c.capability)).toContain('edit_certificate');
			// Two sections that cannot be hidden: two verbs each.
			expect(fitted).toHaveLength(4);
		});

		it('drops a matched section rather than exceeding the budget', () => {
			// The degradation that makes matching safe to have at all: the section
			// is not offered, and the manifest still names it and its page — which
			// is the answer the user got before matching existed.
			const granted = section('language');
			const fitted = fitMatchedCapabilities(granted, [section('certificate')], 100);

			expect(fitted).toEqual(granted);
		});

		it('never drops what the page itself granted', () => {
			// A page that silently stops offering its own edit is the failure the
			// whole layer exists to avoid: the user is standing on the thing.
			const granted = section('work_experience');
			const fitted = fitMatchedCapabilities(granted, [section('education')], 1);

			expect(fitted).toEqual(granted);
		});

		it('admits a section whole or not at all', () => {
			// Three verbs are one offer. Half of one would leave the model able to
			// correct a language and not to add one, for a reason no prompt states.
			const granted = section('language');
			const budget = renderCapabilityPrompt([...granted, ...section('certificate')]).length;

			const fitted = fitMatchedCapabilities(
				granted,
				[section('certificate'), section('education')],
				budget
			);

			const matched = fitted.filter((c) => !granted.includes(c)).map((c) => c.capability);
			expect(matched).toEqual(['edit_certificate', 'add_certificate']);
		});

		it('keeps the earlier match when only one fits', () => {
			// Rank order is the matcher's, and it is the message's: the section
			// named first is the one the user led with.
			const granted: LiveCapability[] = [];
			const budget = renderCapabilityPrompt(section('certificate')).length;

			const fitted = fitMatchedCapabilities(
				granted,
				[section('certificate'), section('education')],
				budget
			);

			expect(fitted.map((c) => c.capability)).toEqual(['edit_certificate', 'add_certificate']);
		});
	});

	it('keeps any single capability inside a one-page budget', () => {
		// The binding constraint for the generated profile capabilities, which are
		// never live beside another. The number is the largest block measured,
		// rounded up — add_activity_record, which carries a chronology as well as
		// a contract. Adding a capability that exceeds it is supposed to fail here
		// and make you decide the turn is worth it; the alternative is finding out
		// from a token bill, or from Gemini's thinking budget quietly eating the
		// answer.
		//
		// Ratcheted from 6,000 to 5,700 once the preamble was rewritten: it had
		// grown three paragraphs saying the same thing at two levels (count the
		// fields, count the kinds, cover every entry), and folding them back into
		// one took it from 3,351 characters to 3,025 — which every capability
		// pays, on every capable turn. It left add_activity_record at 5,657, and
		// 17 characters of headroom was not a budget, it was a coincidence.
		const PER_CAPABILITY_CHARS = 5700;

		for (const capability of Object.keys(CAPABILITIES) as Capability[]) {
			const rendered = renderCapabilityPrompt([
				{ capability, targets: [{ id: 1, label: 'x' }], current: {} }
			]);
			expect(rendered.length, capability).toBeLessThanOrEqual(PER_CAPABILITY_CHARS);
		}
	});

	it('keeps every contract renderable without a target', () => {
		// `contract` is the half of the old describe() that an MCP list_tools
		// response can answer with, long before anyone has said which job they
		// mean. A leftover `${...}` is what a botched split leaves behind, and it
		// would ship to the model as literal text.
		for (const [capability, def] of Object.entries(CAPABILITIES)) {
			expect(def.contract, capability).toBeTruthy();
			expect(def.contract, capability).not.toContain('${');
		}
	});
});

describe('renderCapabilityPrompt', () => {
	it('is empty when nothing is proposable', () => {
		expect(renderCapabilityPrompt([])).toBe('');
	});

	it('spells the JSON contract out in prose, not just in the schema', async () => {
		// Passing a schema is not enough with either provider in use — this is the
		// text that makes structured output hold, so its absence is a real failure.
		jobRow = { id: 900, title: 'Staff Engineer', company: 'Acme' };
		const live = await resolveCapabilities(['edit_job_details'], { type: 'job', id: 900 }, ACTOR);

		const prompt = renderCapabilityPrompt(live);
		expect(prompt).toContain('"reply"');
		expect(prompt).toContain('"proposals"');
		expect(prompt).toContain('edit_job_details');
		// The three rules that stop a partial edit losing or wiping data. `\s+`
		// because the contract is hard-wrapped prose — asserting on the wrapping
		// would make this fail on a reflow that changes nothing.
		expect(prompt).toMatch(/keep\s+their\s+current\s+value/i);
		expect(prompt).toMatch(/clears\s+that\s+field/i);
		// The count-what-they-asked-for rule, which is what stopped the model
		// promising a salary change in its reply and then omitting it.
		expect(prompt).toMatch(/count\s+the\s+distinct\s+things/i);
		// And the same rule one level up: two kinds of change asked for in one
		// message must come back as two entries, not one plus an apology.
		expect(prompt).toMatch(/TWO\s+entries/);
		expect(prompt).toMatch(/separate\s+card/i);
	});

	it('says a replaced value is not merged, so a partial one loses the rest', async () => {
		// The rule the block was missing for its first two weeks. "Each is replaced
		// outright" told the model HOW to send a value and nothing about what
		// happens to the part it leaves out — so asked to combine a job posting
		// with a second one the user pasted in, it returned a merge 950 characters
		// SHORTER than the description it replaced, and every fact it dropped went
		// without a word to anyone. `edit_job_skills` had the equivalent rule from
		// the day it was written, because a half-sent list is visibly a wipe; a
		// half-sent text is not.
		jobRow = { id: 900, title: 'Staff Engineer', company: 'Acme' };
		const live = await resolveCapabilities(
			['edit_job_description'],
			{ type: 'job', id: 900 },
			ACTOR
		);

		const prompt = renderCapabilityPrompt(live);
		expect(prompt).toMatch(/never\s+merged\s+with\s+it/i);
		expect(prompt).toMatch(/comes\s+back\s+whole/i);
		expect(prompt).toMatch(/[Rr]ewriting\s+is\s+not\s+condensing/);
	});

	it('carves the stale-neighbour case out of "change nothing adjacent"', async () => {
		// Two rules that contradicted each other for three days. The preamble said
		// to change nothing adjacent to what was asked for; edit_job_description
		// said to correct the structured fields its own rewrite had made stale.
		// The model split the difference — it re-proposed the skills, which the
		// skills contract also asks for, and left salary_min = salary_max = 8500
		// standing against a new text saying "up to €8,500".
		jobRow = { id: 900, title: 'Staff Engineer', company: 'Acme' };
		const live = await resolveCapabilities(
			['edit_job_details', 'edit_job_description'],
			{ type: 'job', id: 900 },
			ACTOR
		);

		const prompt = renderCapabilityPrompt(live);
		expect(prompt).toMatch(/never\s+tidy\s+up\s+unasked/i);
		expect(prompt).toMatch(/your\s+OWN\s+change\s+makes\s+wrong/);
	});

	it('shows the current values so the model proposes a diff', async () => {
		jobRow = {
			id: 900,
			title: 'Staff Engineer',
			company: 'Acme',
			salary_min: 100000
		};
		const live = await resolveCapabilities(['edit_job_details'], { type: 'job', id: 900 }, ACTOR);

		expect(renderCapabilityPrompt(live)).toContain('100000');
	});
});

describe('add_activity_record', () => {
	const def = CAPABILITIES.add_activity_record;
	const TARGET = { id: 42, label: 'Staff Engineer at Acme' };

	beforeEach(() => {
		applicationRow = {
			id: 42,
			profile_id: 12,
			status_step: 'screening',
			job: { title: 'Staff Engineer', company: 'Acme' }
		};
	});

	it('writes the entry, then derives, then summarises', async () => {
		// Order is load-bearing: the summariser reads the derived type and
		// contacts, so summarising first would digest the write-time fallbacks.
		const order: string[] = [];
		mockDeriveRecord.mockImplementation(() => {
			order.push('derive');
			return Promise.resolve();
		});
		mockSummarize.mockImplementation(() => {
			order.push('summarise');
			return Promise.resolve();
		});

		await def.apply(TARGET, { entry_content: 'They want two office days.' }, {}, ACTOR);

		expect(mockRecordInsert).toHaveBeenCalledTimes(1);
		expect(order).toEqual(['derive', 'summarise']);
		expect(mockDeriveRecord).toHaveBeenCalledWith(777, 12);
		expect(mockSummarize).toHaveBeenCalledWith(42, 12);
	});

	it('fills type, title, date and stage when the proposal omits them', async () => {
		await def.apply(
			TARGET,
			{ entry_content: 'Recruiter called\n\nThey want two office days.' },
			{},
			ACTOR
		);

		expect(mockRecordInsert).toHaveBeenCalledWith(
			expect.objectContaining({
				application_id: 42,
				record_type: 'note',
				title: 'Recruiter called',
				event_date: new Date().toISOString().slice(0, 10),
				step: 'screening',
				extraction_status: 'none'
			})
		);
	});

	it('keeps the proposed type, title and date when it has them', async () => {
		await def.apply(
			TARGET,
			{
				entry_content: 'Base 92000, respond by Friday.',
				entry_type: 'offer',
				entry_title: 'Verbal offer',
				entry_date: '2026-07-30'
			},
			{},
			ACTOR
		);

		expect(mockRecordInsert).toHaveBeenCalledWith(
			expect.objectContaining({
				record_type: 'offer',
				title: 'Verbal offer',
				event_date: '2026-07-30'
			})
		);
	});

	it('clamps a long title rather than letting the column reject it', async () => {
		// `title` is varchar(255) NOT NULL, so an over-long value is a database
		// error at apply time — a 500 on a button the user just pressed.
		await def.apply(
			TARGET,
			{
				entry_content: '…',
				entry_title: 'x'.repeat(400)
			},
			{},
			ACTOR
		);

		const values = mockRecordInsert.mock.calls[0][0] as { title: string };
		expect(values.title.length).toBeLessThanOrEqual(255);
	});

	it('refuses an entry with no content', () => {
		expect(def.validate({ entry_title: 'Just a title' }, {}).ok).toBe(false);
		expect(def.validate({ entry_content: '   ' }, {}).ok).toBe(false);
	});

	it('refuses a type outside the known set', () => {
		// An unknown type renders as the fallback label and is invisible to the
		// filters, so it has to be rejected rather than stored.
		expect(def.validate({ entry_content: 'x', entry_type: 'phone' }, {}).ok).toBe(false);
		expect(def.validate({ entry_content: 'x', entry_type: 'offer' }, {}).ok).toBe(true);
	});

	it("refuses a date that isn't YYYY-MM-DD", () => {
		expect(def.validate({ entry_content: 'x', entry_date: 'last Tuesday' }, {}).ok).toBe(false);
		expect(def.validate({ entry_content: 'x', entry_date: '2026-07-30' }, {}).ok).toBe(true);
	});

	it("shows the model what is already logged, so it doesn't log it twice", async () => {
		recordRows = [
			{
				id: 3,
				record_type: 'interview_recap',
				title: 'Second round',
				event_date: '2026-07-28'
			}
		];

		const current = await def.current(TARGET, ACTOR);
		expect(renderCapabilityBlock('add_activity_record', [TARGET], current)).toContain(
			'Second round'
		);
	});

	it('says so when there is nothing logged yet', async () => {
		const current = await def.current(TARGET, ACTOR);
		expect(renderCapabilityBlock('add_activity_record', [TARGET], current)).toContain(
			'Nothing is logged'
		);
	});

	it('does not resolve on a page that is not an application', async () => {
		expect(await def.resolve({ type: 'job', id: 900 }, ACTOR)).toBeNull();
		expect(await def.resolve(null, ACTOR)).toBeNull();
	});
});

describe('executeCapability', () => {
	const TARGET = { id: 42, label: 'Staff Engineer at Acme' };

	beforeEach(() => {
		applicationRow = {
			id: 42,
			profile_id: 12,
			status_step: 'screening',
			job: { title: 'Staff Engineer', company: 'Acme' }
		};
	});

	it('writes on the happy path', async () => {
		const outcome = await executeCapability(
			'add_activity_record',
			TARGET,
			ACTOR,
			{
				entry_content: 'They want two office days.'
			},
			'chat'
		);

		// add_activity_record appends, so there is no prior value for the field it
		// writes — an empty before-image is the correct answer here, not a missing
		// one. An editing capability returns the values it replaced (below).
		//
		// `editId` is the log row this write produced. It comes back because it is
		// the handle an undo is addressed by, and the caller who most needs it is
		// the one with nobody watching: an MCP tool result carries it into the
		// transcript the user is reading at the time.
		//
		// `created` is the entry itself, not the application it was filed under.
		// An add is called with a target it cannot have written to — there was no
		// row yet — so without this the only id the caller keeps is the one place
		// the change did not happen.
		expect(outcome).toEqual({
			ok: true,
			previous: {},
			editId: 999,
			created: { id: 777, label: 'They want two office days.' }
		});
		expect(mockRecordInsert).toHaveBeenCalledTimes(1);
	});

	it('logs an add against the row it created, not against what it was called with', async () => {
		// The target an add resolves is the parent — an application here, a profile
		// for a section — because there is no row to name until the write happens.
		// Logging that is how the history came to say only which list had grown,
		// while the same add made through a form recorded the row itself.
		await executeCapability(
			'add_activity_record',
			TARGET,
			ACTOR,
			{ entry_content: 'They want two office days.' },
			'chat'
		);

		expect(mockEditLogInsert).toHaveBeenCalledWith(
			expect.objectContaining({
				capability: 'add_activity_record',
				target: { id: 777, label: 'They want two office days.' }
			})
		);
	});

	it('hands back what an edit replaced, read inside the call', async () => {
		// The before-image is what makes an applied proposal reviewable and an
		// undo possible at all: applyJobFields keeps no audit trail, and jobs have
		// no version table. Read here rather than by the caller beforehand, so it
		// reflects the row as it was immediately before this write rather than
		// before the caller's own authorize/validate round trip.
		jobRow = {
			id: 3818,
			title: 'Data Engineer',
			company: 'Acme',
			salary_min: 55000,
			salary_max: 70000
		};

		const outcome = await executeCapability(
			'edit_job_details',
			{ id: 3818, label: 'Data Engineer at Acme' },
			ACTOR,
			{ salary_min: 75000 },
			'chat'
		);

		expect(outcome.ok).toBe(true);
		// Only the field being written — not a snapshot of the whole row, which
		// would drift from the proposal the moment a capability grew a field.
		expect((outcome as { previous: Record<string, unknown> }).previous).toEqual({
			salary_min: 55000
		});
	});

	it('records the change in the edit log, from inside the write', async () => {
		// The claim the whole design rests on: every surface logs by construction
		// rather than by remembering to. Nothing else asserts it — recordEdit is
		// tested in isolation, and the call from here is wrapped in a catch that
		// swallows failures on purpose, so a regression that stopped logging
		// altogether would leave this file green without this test.
		jobRow = { id: 3818, title: 'Data Engineer', company: 'Acme', salary_min: 55000 };

		const outcome = await executeCapability(
			'edit_job_details',
			{ id: 3818, label: 'Data Engineer at Acme' },
			ACTOR,
			{ salary_min: 75000 },
			'chat'
		);

		expect(outcome.ok).toBe(true);
		expect(mockEditLogInsert).toHaveBeenCalledTimes(1);
		expect(mockEditLogInsert).toHaveBeenCalledWith(
			expect.objectContaining({
				profile_id: 12,
				source: 'chat',
				capability: 'edit_job_details',
				target: { id: 3818, label: 'Data Engineer at Acme' },
				fields: { salary_min: 75000 },
				// The before-image, not the new value — an undo reads this back.
				previous: { salary_min: 55000 }
			})
		);
	});

	it('logs nothing when the write was refused', async () => {
		// A log row is a record of a change that happened. One written for a
		// refused write would offer an undo for something never applied.
		mockCanEditJob.mockResolvedValue(false);
		jobRow = { id: 3818, title: 'Data Engineer', company: 'Acme', salary_min: 55000 };

		const outcome = await executeCapability(
			'edit_job_details',
			{ id: 3818, label: 'Data Engineer at Acme' },
			ACTOR,
			{ salary_min: 75000 },
			'chat'
		);

		expect(outcome.ok).toBe(false);
		expect(mockEditLogInsert).not.toHaveBeenCalled();
	});

	it('refuses, and writes nothing, when the actor no longer owns the row', async () => {
		// The window this closes is real: a proposal sits in a 12h-resumable
		// thread, and rights can be lost inside it rather than only outside.
		applicationRow = null;

		const outcome = await executeCapability(
			'add_activity_record',
			TARGET,
			ACTOR,
			{
				entry_content: 'They want two office days.'
			},
			'chat'
		);

		expect(outcome).toMatchObject({ ok: false, reason: 'unauthorized' });
		expect(mockRecordInsert).not.toHaveBeenCalled();
	});

	it('refuses when nothing survives coercion', async () => {
		const outcome = await executeCapability(
			'add_activity_record',
			TARGET,
			ACTOR,
			{
				salary_min: 90000
			},
			'chat'
		);

		expect(outcome).toMatchObject({ ok: false, reason: 'empty' });
		expect(mockRecordInsert).not.toHaveBeenCalled();
	});

	it('refuses what validate refuses', async () => {
		const outcome = await executeCapability(
			'add_activity_record',
			TARGET,
			ACTOR,
			{
				entry_content: 'x',
				entry_type: 'phone'
			},
			'chat'
		);

		expect(outcome).toMatchObject({ ok: false, reason: 'invalid' });
		expect(mockRecordInsert).not.toHaveBeenCalled();
	});
});

describe('undoing a job or an application edit', () => {
	/**
	 * These four reverts are what let an MCP write be undone at all — before
	 * them, `revertible` was false for every job and application change in the
	 * feed, whoever made it. The property each one has to hold is the same:
	 * the write is authoritative for a set of columns, so the before-image goes
	 * back merged over a fresh read rather than on its own.
	 *
	 * Ownership is not re-checked in any of them, and that is deliberate:
	 * `revertEdit` asks the capability's own `authorize` first, which is
	 * `canEditJob` for the three job verbs. A second check here would be a
	 * different one, and two answers to one question is how they drift.
	 */
	it('puts a job field back without clearing the twelve it never touched', async () => {
		jobRow = {
			id: 3818,
			title: 'Data Engineer',
			company: 'Acme',
			salary_min: 75000,
			salary_max: 90000,
			salary_currency: 'EUR'
		};

		await CAPABILITIES.edit_job_details.revert!(
			{ id: 3818, label: 'Data Engineer at Acme' },
			{ salary_min: 55000 },
			ACTOR
		);

		// applyJobFields writes every column it is given, so passing the
		// before-image through alone would undo one correction by wiping the rest.
		expect(mockApplyJobFields).toHaveBeenCalledWith(
			3818,
			expect.objectContaining({
				salary_min: 55000,
				salary_max: 90000,
				salary_currency: 'EUR',
				title: 'Data Engineer',
				company: 'Acme'
			})
		);
	});

	it('refuses a job revert with nothing recorded, rather than writing the row over itself', async () => {
		jobRow = { id: 3818, title: 'Data Engineer', company: 'Acme' };

		await expect(
			CAPABILITIES.edit_job_details.revert!({ id: 3818, label: 'x' }, {}, ACTOR)
		).rejects.toThrow(/no fields/);
		expect(mockApplyJobFields).not.toHaveBeenCalled();
	});

	it('puts back only the text that was replaced', async () => {
		// Same partial semantics as the write: applyJobTexts touches what it is
		// given, so restoring both would blank a company blurb the edit never saw.
		await CAPABILITIES.edit_job_description.revert!(
			{ id: 3818, label: 'Data Engineer at Acme' },
			{ job_description: 'The posting as it was.' },
			ACTOR
		);

		expect(mockApplyJobTexts).toHaveBeenCalledWith(3818, {
			job_description: 'The posting as it was.'
		});
	});

	it('puts back a skill list whole, and only the list that changed', async () => {
		await CAPABILITIES.edit_job_skills.revert!(
			{ id: 3818, label: 'Data Engineer at Acme' },
			{ skills_required: ['Python', 'SQL'] },
			ACTOR
		);

		expect(mockApplyJobSkills).toHaveBeenCalledWith(3818, {
			skills_required: ['Python', 'SQL']
		});
	});

	it('puts an application detail back merged over the other two', async () => {
		applicationRow = {
			id: 44,
			cv_sent_through: 'Company website',
			application_sent_date: '2026-08-01',
			application_seen_date: '2026-08-05'
		};

		await CAPABILITIES.edit_application_details.revert!(
			{ id: 44, label: 'Data Engineer at Acme' },
			{ cv_sent_through: 'LinkedIn Easy Apply' },
			ACTOR
		);

		expect(mockAppUpdateSet).toHaveBeenCalledWith(
			expect.objectContaining({
				cv_sent_through: 'LinkedIn Easy Apply',
				application_sent_date: '2026-08-01',
				application_seen_date: '2026-08-05'
			})
		);
	});

	it('gives an add no undo, so nothing offers one', () => {
		// The rule the whole hide-not-delete design rests on: the registry has no
		// delete, so an add is taken back on the page that shows it. A revert here
		// would be that delete, arriving through the back door.
		expect(CAPABILITIES.add_activity_record.revert).toBeUndefined();
	});
});

describe('capabilityFieldSchema', () => {
	it('gives each capability its own object, keyed by its own fields', () => {
		for (const [name, def] of Object.entries(CAPABILITIES)) {
			const shape = capabilityFieldSchema(name as Capability).shape;
			expect(Object.keys(shape).sort()).toEqual(Object.keys(def.fields).sort());
		}
	});

	it('accepts a partial call and the loose wire values models send', () => {
		// Same permissiveness as the chat's schema, for the same reason: the
		// coercion is on our side of the boundary, not in the schema.
		const schema = capabilityFieldSchema('edit_job_details');
		expect(schema.safeParse({}).success).toBe(true);
		expect(schema.safeParse({ salary_min: '55,000' }).success).toBe(true);
		expect(schema.safeParse({ work_location: 'remote' }).success).toBe(true);
	});
});

describe('a capability live over several rows', () => {
	const THREE = [
		{ id: 1, label: 'Dutch' },
		{ id: 2, label: 'German' },
		{ id: 3, label: 'Spanish' }
	];

	it('lists the rows with their ids instead of one row’s values', () => {
		const block = renderCapabilityBlock('edit_language', THREE, null);

		expect(block).toContain('target_id 1: Dutch');
		expect(block).toContain('target_id 3: Spanish');
		// No "Current values" heading: there is no one row to diff against, and
		// printing all of them is what the budget cannot hold.
		expect(block).not.toContain('Current values');
	});

	it('says the list is the whole of what it can reach', () => {
		expect(renderCapabilityBlock('edit_language', THREE, null)).toContain('only one of these');
	});

	it('keeps the single-row form when there is one row', () => {
		const block = renderCapabilityBlock('edit_language', [THREE[0]], { 'language.name': 'Dutch' });

		expect(block).toContain('— Dutch');
		expect(block).toContain('Current values');
		expect(block).not.toContain('target_id');
	});

	it('tells the model how to name a row only when one is offered a choice', () => {
		const choosing = renderCapabilityPrompt([
			{ capability: 'edit_language', targets: THREE, current: null }
		]);
		const fixed = renderCapabilityPrompt([
			{ capability: 'edit_language', targets: [THREE[0]], current: {} }
		]);

		expect(choosing).toContain('add "target_id" to the proposal');
		// A page about one row cannot use the rule, and every live capability's
		// block ships on every capable turn — so it must not pay for it.
		expect(fixed).not.toContain('target_id');
	});

	it('stays inside the one-page budget with a realistic list', () => {
		// A section list is the widest this gets: the block carries the contract
		// AND a line per row. Twenty languages is well past what a real profile
		// holds and is the point of measuring it.
		const many = Array.from({ length: 20 }, (_, i) => ({
			id: i + 1,
			label: `Language number ${i + 1}`
		}));

		const rendered = renderCapabilityPrompt([
			{ capability: 'edit_language', targets: many, current: null }
		]);

		expect(rendered.length).toBeLessThanOrEqual(6000);
	});
});
