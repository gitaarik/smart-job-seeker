/**
 * What a profile is made of, declared once.
 *
 * Seven sections, each a collection of rows owned by a profile, each previously
 * written by two unrelated pieces of code: a set of form actions under
 * `profile/(data)/*` doing create/delete/reorder, and a REST endpoint under
 * `api/*` doing update. They shared no validation, no coercion and no ownership
 * check, and they had already drifted — the form actions wrote a `YYYY-MM-DD`
 * string into the date columns while the REST layer wrote a `Date`, and four of
 * the seven sections had no declared schema at all because nothing but a form
 * had ever written them.
 *
 * This file is the declaration; `write.ts` is the one write path over it. The
 * split matters: a declaration is a thing a factory can walk, and the point of
 * having one is that the next writer — the assistant's capability registry, and
 * an MCP server after it — is generated from it rather than hand-written beside
 * it. A capability written next to the form actions would become a *fourth*
 * convention and drift the same way.
 *
 * Deliberately not here:
 *
 *  - **Skills.** Ten form actions over categories *and* skills, with its own
 *    reorder semantics on both. Whether it is generated or hand-written like
 *    jobs is still open.
 *  - **The child collections** — achievements, technologies, projects. Their
 *    writes are id-stable merges (a row keeps its id across a save so
 *    translations keyed on it don't orphan), which is real bespoke logic, not
 *    CRUD wearing a different name.
 *  - **The profile row itself.** It has no `status`, its owner is `user_id`
 *    rather than `profile_id`, and its slug needs canonicalizing and a
 *    uniqueness check. One member with three exceptions is not a member.
 */

import { z } from 'zod';
import { asc, desc, type SQL } from 'drizzle-orm';
import type { PgColumn, PgTable } from 'drizzle-orm/pg-core';
import {
	certificates,
	education,
	highlights,
	languages,
	references,
	side_projects,
	work_experiences
} from '$lib/server/db/schema';
import type { FieldKind } from '$lib/server/utils/field-kinds';
import {
	certificateBasicSchema,
	educationUpdateSchema,
	highlightBasicSchema,
	languageBasicSchema,
	referenceBasicSchema,
	sideProjectBasicSchema,
	workExperienceBasicSchema
} from '$lib/server/validation/api-schemas';

export type ProfileResourceName =
	| 'work_experience'
	| 'education'
	| 'side_project'
	| 'language'
	| 'reference'
	| 'certificate'
	| 'highlight';

/**
 * The columns every section shares, which is what lets one write path serve all
 * seven. Structural rather than a union of the seven table types: Drizzle infers
 * its insert and update value types from the table it is given, and a union
 * would make every write demand the intersection of seven different row shapes.
 */
export interface SectionTable extends PgTable {
	id: PgColumn;
	profile_id: PgColumn;
	status: PgColumn;
	sort: PgColumn;
	date_created: PgColumn;
	date_updated: PgColumn;
}

/** A row as this layer needs to see it, whatever else the section carries. */
export interface SectionRow {
	id: number;
	profile_id: number;
	sort: number | null;
	status: string | null;
	[column: string]: unknown;
}

/**
 * Where a newly-created row lands.
 *
 * Not a detail — it is the difference between two list behaviours the applicant
 * can see. `append` puts the row at the end of a hand-ordered list.
 * `unsorted` leaves `sort` null so the row slots into date order, which is what
 * work experience and side projects default to; an explicit reorder is what
 * switches those lists to manual mode, and creating a row must not do it by
 * accident.
 */
export type NewRowPlacement = 'append' | 'unsorted';

/** Everything true of one writable column. */
export interface FieldSpec {
	kind: FieldKind;
	/**
	 * One short line saying what this column holds, for the assistant's
	 * contract. Omit where the column name already says it — a note that
	 * restates the name is worse than none, because it spends prompt budget
	 * teaching the model something it already knew.
	 */
	note?: string;
	/**
	 * The only values this column may hold. Spelled out in the contract *and*
	 * enforced on write: a declared vocabulary that nothing checks is a lie the
	 * next reader believes.
	 */
	allowed?: string[];
	/**
	 * Keep this column away from the assistant, with the reason.
	 *
	 * Not the same question as whether a person may edit it. These are the
	 * fields whose wrong value is *silent* — a version slug that matches no
	 * version doesn't error, it just stops the item appearing on any document,
	 * and the applicant finds out from a resume that is missing a job.
	 */
	notForAssistant?: string;
}

/** Just the kinds, for the coercion, which is the one caller that wants nothing else. */
export function fieldKinds(resource: ProfileResource): Record<string, FieldKind> {
	return Object.fromEntries(
		Object.entries(resource.fields).map(([name, spec]) => [name, spec.kind])
	);
}

/** The columns the assistant may propose values for. */
export function assistantFields(resource: ProfileResource): Record<string, FieldSpec> {
	return Object.fromEntries(
		Object.entries(resource.fields).filter(([, spec]) => !spec.notForAssistant)
	);
}

export interface ProfileResource {
	/** The rows' table. */
	table: SectionTable;
	/** Singular and lowercase — it goes straight into "… not found" messages. */
	label: string;
	/**
	 * Where a person edits this section, named the way the page names itself.
	 *
	 * Part of the declaration rather than a table beside it because two things
	 * need it and would otherwise each keep their own copy: the route scopes,
	 * which decide where the assistant may propose an edit, and the manifest,
	 * which tells the applicant where to go for the sections it cannot reach
	 * from here. A wrong answer to the second is worse than no answer — it sends
	 * them to a page that does not hold the thing.
	 */
	page: {
		/** Route path of the list, normalized (no `(group)` segments). */
		path: string;
		/** As the navigation labels it. */
		name: string;
	};
	/**
	 * The row's own page, for the sections that have one. Its absence is what
	 * says the section is edited inline on its list, which is why those four are
	 * the ones the assistant reaches by naming a row rather than by URL.
	 */
	detailPath?: (id: number) => string;
	/**
	 * What a person calls this section when they are not reading the navigation.
	 *
	 * Used only by `profile-matching.ts`, to decide whether a message is about a
	 * section the current page does not offer. `page.name` and `label` are terms
	 * already and are not repeated here.
	 *
	 * Conservative on purpose, and the bar is this app's vocabulary rather than
	 * English: an alias earns its place only if it means this section and nothing
	 * else *here*. "job" is the clearest exclusion — it means a posting far more
	 * often than a past role, and it appears in nearly every turn on a job page,
	 * so it would load the work-history capabilities on every one of them.
	 * Multi-word phrases are safer than single nouns for the same reason, and
	 * plurals are matched automatically rather than listed.
	 */
	aliases?: string[];
	/** Names one row on a proposal card and in a prompt. */
	rowLabel(row: SectionRow): string;
	/**
	 * The columns a caller may write, described once each.
	 *
	 * One declaration drives the coercion, the allow-list, the assistant's
	 * contract prose and the wire schema, so those cannot drift apart the way
	 * `buildUpdateData`'s allow-list drifted from the zod schema beside it. That
	 * is also why a field is a spec rather than a bare kind: the moment a second
	 * map keyed by field name exists — notes here, exclusions there — it starts
	 * disagreeing with this one, which is the disease this whole layer treats.
	 */
	fields: Record<string, FieldSpec>;
	/**
	 * Fields that may not be empty: the row's identity, the thing every list
	 * renders. Required on create, and rejected if an update tries to clear one.
	 * An update that simply omits them is fine — that is a partial patch, not a
	 * deletion.
	 */
	required: string[];
	/** Columns set on insert that no caller supplies. */
	insertDefaults: Record<string, unknown>;
	/**
	 * Editable columns the database refuses null for. Clearing one writes an
	 * empty string instead.
	 *
	 * Five of work experience's text columns are `NOT NULL` with no default —
	 * a historical shape rather than a decision anything relies on. The form
	 * actions wrote `''` into them and the REST layer wrote null, so emptying
	 * the location box on the detail page raised a constraint violation while
	 * clearing the same box on the create form did not. Declared rather than
	 * fixed in the schema: a migration relaxing five columns is a change to what
	 * every reader of them may assume, and that is not this phase's to make.
	 */
	notNullColumns: string[];
	newRowPlacement: NewRowPlacement;
	/** How the section's list reads, so append placement and reorder agree with the page. */
	orderBy: SQL[];
	/**
	 * Validates a partial patch. Runs before anything is coerced or written.
	 *
	 * An object schema specifically, not any zod type: a patch is a set of named
	 * fields, and declaring the shape is what lets a check confirm that every
	 * field this resource says it can write is one the schema will let through.
	 * A field missing from the schema is stripped before the coercion sees it —
	 * writable in name only.
	 */
	schema: z.ZodObject<z.ZodRawShape>;
}

/** Trim a long text down to something that fits on a card. */
function short(value: unknown, max = 60): string {
	const text = String(value ?? '').trim();
	return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** Join the parts of a label, dropping the ones this row hasn't filled in. */
function joined(parts: unknown[], separator = ' at '): string {
	return parts
		.map((part) => String(part ?? '').trim())
		.filter(Boolean)
		.join(separator);
}

/** Said once, because three sections carry the same field for the same reason. */
const VERSION_SLUGS =
	'Version slugs, which name documents by a string that nothing keeps in step: a slug matching no version silently drops the item from every document rather than erroring.';

export const PROFILE_RESOURCES: Record<ProfileResourceName, ProfileResource> = {
	work_experience: {
		table: work_experiences,
		label: 'work experience',
		page: { path: '/profile/work-experience', name: 'Work experience' },
		detailPath: (id) => `/profile/work-experience/${id}`,
		// No bare "job" or "role": both mean a posting they are looking at at
		// least as often as a position they held.
		aliases: [
			'work history',
			'employment history',
			'career history',
			'employment',
			'employer',
			'past job',
			'previous job',
			'former job',
			'past role',
			'previous role'
		],
		rowLabel: (row) => joined([row.position, row.name]) || 'Untitled role',
		fields: {
			name: { kind: 'string', note: 'the employer or client' },
			position: { kind: 'string', note: 'the job title held there' },
			location: { kind: 'string', note: 'where the role was based' },
			website: { kind: 'string', note: "the employer's site" },
			headline: { kind: 'string', note: 'a one-line framing of the role, shown above the summary' },
			description: {
				kind: 'string',
				note: 'the employer blurb — who they are, NOT what the applicant did there'
			},
			summary: { kind: 'string', note: 'what the applicant did in this role' },
			start_date: { kind: 'date' },
			end_date: { kind: 'date', note: 'empty means they are still there' },
			tags: { kind: 'stringArray', notForAssistant: VERSION_SLUGS }
		},
		required: ['name', 'position'],
		insertDefaults: {},
		notNullColumns: ['name', 'position', 'location', 'description', 'summary'],
		newRowPlacement: 'unsorted',
		// Postgres sorts ASC NULLS LAST, so with no manual sort the list falls
		// through to date order; once reordered, `sort` wins.
		orderBy: [asc(work_experiences.sort), desc(work_experiences.start_date)],
		schema: workExperienceBasicSchema
	},

	education: {
		table: education,
		label: 'education entry',
		page: { path: '/profile/education', name: 'Education' },
		detailPath: (id) => `/profile/education/${id}`,
		aliases: [
			'degree',
			'diploma',
			'university',
			'college',
			'studied',
			'studies',
			'graduated',
			'bachelor',
			'master',
			'masters',
			'phd',
			'doctorate'
		],
		rowLabel: (row) => joined([row.area, row.institution]) || 'Untitled education entry',
		fields: {
			institution: { kind: 'string', note: 'the school or university' },
			area: { kind: 'string', note: 'the field of study' },
			study_type: { kind: 'string', note: 'the qualification, such as BSc or Minor' },
			location: { kind: 'string' },
			url: { kind: 'string' },
			graduation_year: { kind: 'int' },
			start_date: { kind: 'date' },
			end_date: { kind: 'date' },
			summary: { kind: 'string' },
			tags: { kind: 'stringArray', notForAssistant: VERSION_SLUGS }
		},
		required: ['institution'],
		insertDefaults: {},
		notNullColumns: [],
		newRowPlacement: 'append',
		orderBy: [asc(education.sort), desc(education.start_date)],
		schema: educationUpdateSchema
	},

	side_project: {
		table: side_projects,
		label: 'side project',
		page: { path: '/profile/side-projects', name: 'Side projects' },
		detailPath: (id) => `/profile/side-projects/${id}`,
		// Not bare "project": a work experience has projects of its own, and so
		// does half the prose in any job description.
		aliases: ['personal project', 'hobby project', 'own project', 'open source project'],
		rowLabel: (row) => short(row.name) || 'Untitled project',
		fields: {
			name: { kind: 'string' },
			url: { kind: 'string', note: 'where the project can be seen running' },
			repo_url: { kind: 'string', note: 'where its source lives' },
			summary: { kind: 'string', note: 'what it is and what the applicant built' },
			stars: { kind: 'int', note: 'GitHub stars — a count, not a rating' },
			start_date: { kind: 'date' },
			end_date: { kind: 'date' },
			tags: { kind: 'stringArray', notForAssistant: VERSION_SLUGS }
		},
		required: ['name'],
		insertDefaults: {},
		notNullColumns: [],
		newRowPlacement: 'unsorted',
		orderBy: [asc(side_projects.sort), desc(side_projects.start_date)],
		schema: sideProjectBasicSchema
	},

	language: {
		table: languages,
		label: 'language',
		page: { path: '/profile/languages', name: 'Languages' },
		aliases: ['mother tongue', 'native speaker', 'bilingual', 'spoken language'],
		rowLabel: (row) => short(row.name) || 'Untitled language',
		fields: {
			name: { kind: 'string', note: 'the language, written the way a reader would name it' },
			language_code: { kind: 'string', note: 'its two-letter code, such as nl or de' },
			proficiency: {
				kind: 'string',
				allowed: ['native', 'fluent', 'proficient', 'conversational', 'basic']
			}
		},
		required: ['name'],
		insertDefaults: {},
		notNullColumns: [],
		newRowPlacement: 'append',
		orderBy: [asc(languages.sort)],
		schema: languageBasicSchema
	},

	reference: {
		table: references,
		label: 'reference',
		page: { path: '/profile/references', name: 'References' },
		aliases: ['referee', 'recommendation', 'testimonial', 'referral'],
		rowLabel: (row) => joined([row.author, row.author_position], ', ') || 'Untitled reference',
		fields: {
			author: { kind: 'string', note: 'who gave the reference' },
			author_position: { kind: 'string', note: 'their role, and where' },
			text: { kind: 'string', note: 'what they said, in their words' }
		},
		required: ['author'],
		insertDefaults: {},
		notNullColumns: ['author'],
		newRowPlacement: 'append',
		orderBy: [asc(references.sort)],
		schema: referenceBasicSchema
	},

	certificate: {
		table: certificates,
		label: 'certificate',
		page: { path: '/profile/certificates', name: 'Certificates' },
		aliases: ['certification', 'certified', 'accreditation', 'credential', 'qualification'],
		rowLabel: (row) => joined([row.name, row.issuer], ' — ') || 'Untitled certificate',
		fields: {
			name: { kind: 'string', note: 'the certificate' },
			issuer: { kind: 'string', note: 'who awarded it' },
			date: { kind: 'date', note: 'when it was awarded' },
			url: { kind: 'string', note: 'where it can be verified' }
		},
		required: ['name'],
		insertDefaults: {},
		notNullColumns: ['name'],
		newRowPlacement: 'append',
		orderBy: [asc(certificates.sort)],
		schema: certificateBasicSchema
	},

	highlight: {
		table: highlights,
		label: 'highlight',
		page: { path: '/profile/highlights', name: 'Highlights' },
		// Not "achievement": a work experience owns a table of those, and they are
		// a different thing in a different place.
		aliases: ['profile highlight', 'selling point'],
		rowLabel: (row) => short(row.text) || 'Untitled highlight',
		fields: {
			text: { kind: 'string', note: 'the highlight itself, one line' },
			icon_name: {
				kind: 'string',
				notForAssistant:
					'A Font Awesome identifier such as faPython. A name that does not exist renders nothing, and the applicant sees a gap rather than an error.'
			}
		},
		required: ['text'],
		// The table also holds other kinds of profile blurb; the highlights page
		// writes and reads this one.
		insertDefaults: { type: 'highlight' },
		notNullColumns: [],
		newRowPlacement: 'append',
		orderBy: [asc(highlights.sort)],
		schema: highlightBasicSchema
	}
};

export const PROFILE_RESOURCE_NAMES = Object.keys(PROFILE_RESOURCES) as ProfileResourceName[];
