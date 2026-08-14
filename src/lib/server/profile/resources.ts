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

export interface ProfileResource {
	/** The rows' table. */
	table: SectionTable;
	/** Singular and lowercase — it goes straight into "… not found" messages. */
	label: string;
	/** Names one row on a proposal card and in a prompt. */
	rowLabel(row: SectionRow): string;
	/**
	 * The columns a caller may write, by kind. One declaration drives the
	 * coercion, the allow-list and (from Phase 1) the wire schema, so those
	 * cannot drift apart the way `buildUpdateData`'s allow-list drifted from the
	 * zod schema beside it.
	 */
	fields: Record<string, FieldKind>;
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

export const PROFILE_RESOURCES: Record<ProfileResourceName, ProfileResource> = {
	work_experience: {
		table: work_experiences,
		label: 'work experience',
		rowLabel: (row) => joined([row.position, row.name]) || 'Untitled role',
		fields: {
			name: 'string',
			position: 'string',
			location: 'string',
			website: 'string',
			headline: 'string',
			description: 'string',
			summary: 'string',
			start_date: 'date',
			end_date: 'date',
			tags: 'stringArray'
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
		rowLabel: (row) => joined([row.area, row.institution]) || 'Untitled education entry',
		fields: {
			institution: 'string',
			area: 'string',
			study_type: 'string',
			location: 'string',
			url: 'string',
			graduation_year: 'int',
			start_date: 'date',
			end_date: 'date',
			summary: 'string',
			tags: 'stringArray'
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
		rowLabel: (row) => short(row.name) || 'Untitled project',
		fields: {
			name: 'string',
			url: 'string',
			repo_url: 'string',
			summary: 'string',
			stars: 'int',
			start_date: 'date',
			end_date: 'date',
			tags: 'stringArray'
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
		rowLabel: (row) => short(row.name) || 'Untitled language',
		fields: {
			name: 'string',
			language_code: 'string',
			proficiency: 'string'
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
		rowLabel: (row) => joined([row.author, row.author_position], ', ') || 'Untitled reference',
		fields: {
			author: 'string',
			author_position: 'string',
			text: 'string'
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
		rowLabel: (row) => joined([row.name, row.issuer], ' — ') || 'Untitled certificate',
		fields: {
			name: 'string',
			issuer: 'string',
			date: 'date',
			url: 'string'
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
		rowLabel: (row) => short(row.text) || 'Untitled highlight',
		fields: {
			text: 'string',
			icon_name: 'string'
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
