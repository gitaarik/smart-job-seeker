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
		insert: () => ({
			values: (v: unknown) => {
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
		}
	}
}));

vi.mock('$lib/server/db/schema', () => ({
	applications: {
		id: 'applications.id',
		profile_id: 'applications.profile_id'
	},
	jobs: { id: 'jobs.id' },
	job_importers: {},
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
	highlights: { id: 'highlights.id', sort: 'highlights.sort' }
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
	type Capability,
	capabilityFieldSchema,
	describeProposalChanges,
	executeCapability,
	fieldsFromChanges,
	pickCapabilityFields,
	renderCapabilityBlock,
	renderCapabilityPrompt,
	resolveCapabilities
} from '../capabilities';

const ACTOR = { profileId: 12, isStaff: false };

beforeEach(() => {
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
	mockAppUpdateSet.mockReturnValue({
		where: vi.fn().mockResolvedValue(undefined)
	});
});

describe('registry invariants', () => {
	it('keeps field names unique across capabilities', () => {
		// buildProposalSchema merges the live capabilities' shapes into one object,
		// so a shared field name would let one capability's value validate inside
		// another's payload and be written to the wrong row.
		const seen = new Map<string, string>();
		for (const [name, def] of Object.entries(CAPABILITIES)) {
			for (const field of Object.keys(def.fields)) {
				expect(
					seen.has(field),
					`"${field}" is declared by both ${seen.get(field)} and ${name}`
				).toBe(false);
				seen.set(field, name);
			}
		}
	});

	it('makes every proposal field optional', () => {
		// "Absent means unchanged" only holds if nothing is required — a required
		// field would force the model to restate values it isn't changing, and
		// restated values are how a partial edit turns into a wipe.
		//
		// Asserted through the real wire schema rather than by inspecting each
		// field's type: it tests the shape the provider is actually handed.
		for (const [name, def] of Object.entries(CAPABILITIES)) {
			const result = buildProposalSchema([name as Capability]).safeParse({ reply: 'x' });
			expect(result.success, `${name} must accept an empty proposal`).toBe(true);
		}
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
	it('has no two capabilities declaring the same field name', () => {
		// buildProposalSchema flattens every live capability's fields into ONE
		// enum for the provider. A shared name is therefore not a collision the
		// model can be blamed for: it can put a value under a name two
		// capabilities answer to, and pickCapabilityFields — which filters by
		// name, having no other signal — hands it to whichever one is being read.
		// The proposal that loses is dropped silently.
		//
		// Enforced across ALL capabilities rather than only co-live ones. The
		// stricter rule is the one the doc comment states, it costs nothing while
		// the names are already distinct, and "these two are never live together"
		// is a fact about ROUTE_SCOPES that a future route can change without
		// anyone thinking about this file.
		const owners = new Map<string, Capability[]>();
		for (const [capability, def] of Object.entries(CAPABILITIES)) {
			for (const field of Object.keys(def.fields)) {
				owners.set(field, [...(owners.get(field) ?? []), capability as Capability]);
			}
		}

		const shared = [...owners.entries()].filter(([, caps]) => caps.length > 1);
		expect(shared.map(([field, caps]) => `${field}: ${caps.join(', ')}`)).toEqual([]);
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
		// three. It deliberately does NOT measure every capability at once. Once
		// the profile sections were generated, "all of them" became a state no
		// route can reach — each section page grants exactly one (asserted in
		// chat-context.test.ts), so their cost is bounded by the per-capability
		// ceiling below, not by a sum nothing ever pays.
		const BUDGET_CHARS = 11500;

		const together = (Object.keys(CAPABILITIES) as Capability[]).filter(
			(capability) => !PROFILE_CAPABILITY_NAMES.includes(capability as never)
		);

		const live = together.map((capability) => ({
			capability,
			targets: [{ id: 1, label: 'x' }],
			current: {}
		}));
		expect(renderCapabilityPrompt(live).length).toBeLessThanOrEqual(BUDGET_CHARS);
	});

	it('keeps any single capability inside a one-page budget', () => {
		// The binding constraint for the generated profile capabilities, which are
		// never live beside another. The number is the largest block measured,
		// rounded up — add_activity_record, which carries a chronology as well as
		// a contract. Adding a capability that exceeds it is supposed to fail here
		// and make you decide the turn is worth it; the alternative is finding out
		// from a token bill, or from Gemini's thinking budget quietly eating the
		// answer.
		const PER_CAPABILITY_CHARS = 6000;

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
		const outcome = await executeCapability('add_activity_record', TARGET, ACTOR, {
			entry_content: 'They want two office days.'
		});

		// add_activity_record appends, so there is no prior value for the field it
		// writes — an empty before-image is the correct answer here, not a missing
		// one. An editing capability returns the values it replaced (below).
		expect(outcome).toEqual({ ok: true, previous: {} });
		expect(mockRecordInsert).toHaveBeenCalledTimes(1);
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
			{ salary_min: 75000 }
		);

		expect(outcome.ok).toBe(true);
		// Only the field being written — not a snapshot of the whole row, which
		// would drift from the proposal the moment a capability grew a field.
		expect((outcome as { previous: Record<string, unknown> }).previous).toEqual({
			salary_min: 55000
		});
	});

	it('refuses, and writes nothing, when the actor no longer owns the row', async () => {
		// The window this closes is real: a proposal sits in a 12h-resumable
		// thread, and rights can be lost inside it rather than only outside.
		applicationRow = null;

		const outcome = await executeCapability('add_activity_record', TARGET, ACTOR, {
			entry_content: 'They want two office days.'
		});

		expect(outcome).toMatchObject({ ok: false, reason: 'unauthorized' });
		expect(mockRecordInsert).not.toHaveBeenCalled();
	});

	it('refuses when nothing survives coercion', async () => {
		const outcome = await executeCapability('add_activity_record', TARGET, ACTOR, {
			salary_min: 90000
		});

		expect(outcome).toMatchObject({ ok: false, reason: 'empty' });
		expect(mockRecordInsert).not.toHaveBeenCalled();
	});

	it('refuses what validate refuses', async () => {
		const outcome = await executeCapability('add_activity_record', TARGET, ACTOR, {
			entry_content: 'x',
			entry_type: 'phone'
		});

		expect(outcome).toMatchObject({ ok: false, reason: 'invalid' });
		expect(mockRecordInsert).not.toHaveBeenCalled();
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
