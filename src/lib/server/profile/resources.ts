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
 * Nine sections, since skills joined them. Skills were the open question this
 * file used to record — generated, or hand-written like jobs — and the answer is
 * generated, at the cost of one new idea: a section's rows belong to the profile
 * *directly or through one parent row*. A skill hangs off a category, which
 * hangs off the profile; everything else about it — a name, a level, a list
 * ordered by `sort`, validation, tags — is the same CRUD the other eight are.
 * See `ResourceOwner`.
 *
 * Deliberately not here:
 *
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
	tech_skill_categories,
	tech_skills,
	work_experiences
} from '$lib/server/db/schema';
import { SKILL_LEVELS } from '$lib/data/field-labels';
import type { FieldKind } from '$lib/server/utils/field-kinds';
import { versionsOf } from '$lib/profile-visibility';
import {
	certificateBasicSchema,
	educationUpdateSchema,
	highlightBasicSchema,
	languageBasicSchema,
	referenceBasicSchema,
	sideProjectBasicSchema,
	techSkillBasicSchema,
	techSkillCategoryBasicSchema,
	workExperienceBasicSchema
} from '$lib/server/validation/api-schemas';

export type ProfileResourceName =
	| 'work_experience'
	| 'education'
	| 'side_project'
	| 'language'
	| 'reference'
	| 'certificate'
	| 'highlight'
	| 'skill'
	| 'skill_category';

/**
 * The columns every section shares, which is what lets one write path serve all
 * nine. Structural rather than a union of the nine table types: Drizzle infers
 * its insert and update value types from the table it is given, and a union
 * would make every write demand the intersection of nine different row shapes.
 *
 * `profile_id` is deliberately NOT here. Eight sections have it and `tech_skills`
 * does not — it carries `category_id` and reaches the profile through that — so
 * the owning column is named by `ResourceOwner` instead. Declaring it here would
 * have been a structural type that one member could not satisfy, which is the
 * point at which a shared layer starts growing exceptions.
 */
export interface SectionTable extends PgTable {
	id: PgColumn;
	status: PgColumn;
	sort: PgColumn;
	date_created: PgColumn;
	date_updated: PgColumn;
}

/**
 * A row as this layer needs to see it, whatever else the section carries.
 *
 * `profile_id` is optional for the same reason it is absent above. A
 * parent-owned row genuinely has no such column; what it has instead is the
 * parent's name, which `readOwnedRows` attaches under the resource's declared
 * `nameField` so that everything reading a row by field name — the assistant's
 * current values, the MCP read tool, a proposal card — sees the parent the same
 * way it sees any other value.
 */
export interface SectionRow {
	id: number;
	profile_id?: number;
	sort: number | null;
	status: string | null;
	[column: string]: unknown;
}

/**
 * How a section's rows reach the profile that owns them.
 *
 * Eight sections carry `profile_id` and are owned outright. Skills are owned
 * through their category, and that one indirection is the whole of what made
 * them "the odd section": every ownership check, every list read, every create
 * and every reorder has to go one row further to find out whose the row is.
 * Written down once here, the write layer asks the declaration rather than
 * assuming a column, and no caller has to know which kind it is holding.
 *
 * A parent is a section in its own right — `skill_category` is declared below
 * with its own verbs — so nothing about this makes a child row reachable
 * without its parent being reachable too.
 */
export type ResourceOwner =
	| {
			via: 'profile';
			/** The `profile_id` column on this section's own table. */
			column: PgColumn;
	  }
	| {
			via: 'parent';
			/** The section holding the parent row. */
			parent: ProfileResourceName;
			/** The foreign key on this section's table, for a WHERE or a JOIN. */
			column: PgColumn;
			/**
			 * The same foreign key as a property name, for reading it off a row and
			 * for writing it in an insert.
			 *
			 * Spelled out rather than taken from `column.name`, which is the name in
			 * the DATABASE: the two agree today and Drizzle does not require them
			 * to, so a column declared `integer('cat_id')` would have made every
			 * read here quietly return undefined. `via: 'profile'` needs no
			 * equivalent — carrying `profile_id` is what that branch means.
			 */
			key: string;
			/**
			 * The declared field that names the parent, rather than pointing at it.
			 *
			 * A caller says `category: 'Backend'`, never `category_id: 7`. An id is
			 * not something a person types or a model can produce without a lookup it
			 * has no reason to have made, and a wrong id is a write into someone
			 * else's shape of the profile — where a wrong NAME is a refusal that
			 * names the categories that do exist. The write layer resolves it
			 * against the actor's own parent rows, which is also where the
			 * ownership check on the parent happens.
			 */
			nameField: string;
	  };

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
	/** Which profile a row belongs to, and how you find out. See `ResourceOwner`. */
	owner: ResourceOwner;
	/**
	 * What the section is called, plural, as a person would say it.
	 *
	 * Distinct from `page.name` because two sections share a page: skills and
	 * skill categories are both edited on the page the navigation calls "Skills",
	 * and a manifest listing "Skills" twice tells the applicant nothing. For the
	 * other seven this is the page's name, said again — worth the repetition,
	 * because the alternative is a default that a reader has to know about to
	 * predict what any given section is called.
	 */
	title: string;
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
	 * The row's own name, for a list that has already said which parent it is
	 * under.
	 *
	 * Only parent-owned sections need it, and only because their `rowLabel` names
	 * the parent to stay unique: an inventory printed by group would otherwise
	 * read "Backend: Python — Backend, Django — Backend". Defaults to `rowLabel`,
	 * which is right for every section whose label stands alone.
	 */
	shortLabel?(row: SectionRow): string;
	/**
	 * Why naming one of this section's rows is not, on its own, evidence that a
	 * message is about the profile — with the reason, since this switches off a
	 * whole tier of matching for the section.
	 *
	 * `profile-matching.ts` has a second tier for messages that name a row and no
	 * section ("make my Spanish conversational"). It works because a language, a
	 * referee or a certificate appears in a sentence only when the applicant is
	 * talking about their own. A skill is the opposite: "React" and "Postgres"
	 * are this app's ordinary vocabulary, in every job description it reads and
	 * most of the questions asked about one, so matching on them would load the
	 * skills capabilities on turns that were never about the profile — and spend
	 * a section's worth of prompt on each.
	 */
	rowNamesAreAmbiguous?: string;
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
	/**
	 * What else goes when this section's entry is hidden, where that is more than
	 * the entry.
	 *
	 * Hiding a skill category takes its skills off the document with it — both
	 * renderers drop a group whose heading is filtered out — and someone
	 * accepting a card that says "hide this category" is entitled to be told
	 * that before they click rather than after.
	 */
	hideNote?: string;
}

/**
 * Sections an entry can be taken off every document from — and why the other
 * four cannot.
 *
 * Visibility on a rendered resume or CV is decided by `tags`, through
 * `profile-filter.ts`: the `!resume` + `!cv` pair (`$lib/profile-visibility`'s
 * "profile-only") holds an item back from every base template while leaving any
 * per-version tag it carries intact. Five sections have a `tags` column AND go
 * through that filter in both renderers. Languages, references and certificates
 * are rendered straight from the profile with no filter at all, and highlights
 * have no `tags` column, so for those four there is simply no way to hide an
 * entry — not from the assistant and not from the UI either.
 *
 * Skills and their categories are filtered on both sides — `ProfileDisplay`
 * filters the groups and then the skills inside each, and `StructuredResume`
 * does the same and additionally drops a group left with nothing in it. The
 * mechanism is already load-bearing there: the job page's "keep it, but off my
 * CV" control writes exactly this pair, which is what `profile_only` means in
 * `skill-visibility.ts`.
 *
 * `status` is NOT that mechanism, though it reads like one and was taken for it
 * when `hide_*` was built. Every section's `status` defaults to `'draft'`,
 * `resume/apply-diff.ts` writes `'draft'` for every row it imports and never
 * promotes them, and **nothing anywhere filters a section row on it** — measured
 * on the dev database, 30 of 73 work experiences and 12 of 24 languages sit at
 * `'draft'` and print on every document. So hiding through `status` was a write
 * that changed nothing while the assistant reported it done.
 *
 * Declared rather than derived from `'tags' in fields`, because the column is
 * only half of it: highlights would pass that test on a column the renderers
 * never consult. A test asserts the other half — that every name here does have
 * the column the mechanism writes.
 */
export const HIDEABLE_RESOURCES = [
	'work_experience',
	'education',
	'side_project',
	'skill',
	'skill_category'
] as const;

export type HideableResourceName = (typeof HIDEABLE_RESOURCES)[number];

export function isHideable(name: ProfileResourceName): name is HideableResourceName {
	return (HIDEABLE_RESOURCES as readonly string[]).includes(name);
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

/**
 * How much of a group's note goes in its label.
 *
 * Enough to tell two headings apart, and no more: the note is free text, and a
 * skill's label carries its group's, so a long one is paid once per row of the
 * biggest section there is.
 */
const NOTE_IN_LABEL = 40;

/** Said once, because three sections carry the same field for the same reason. */
const VERSION_SLUGS =
	'Version slugs, which name documents by a string that nothing keeps in step: a slug matching no version silently drops the item from every document rather than erroring.';

export const PROFILE_RESOURCES: Record<ProfileResourceName, ProfileResource> = {
	work_experience: {
		table: work_experiences,
		owner: { via: 'profile', column: work_experiences.profile_id },
		title: 'Work experience',
		label: 'work experience',
		page: {
			path: '/profile/work-experience',
			name: 'Work experience'
		},
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
		owner: { via: 'profile', column: education.profile_id },
		title: 'Education',
		label: 'education entry',
		page: {
			path: '/profile/education',
			name: 'Education'
		},
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
		owner: { via: 'profile', column: side_projects.profile_id },
		title: 'Side projects',
		label: 'side project',
		page: {
			path: '/profile/side-projects',
			name: 'Side projects'
		},
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
		owner: { via: 'profile', column: languages.profile_id },
		title: 'Languages',
		label: 'language',
		page: {
			path: '/profile/languages',
			name: 'Languages'
		},
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
		owner: { via: 'profile', column: references.profile_id },
		title: 'References',
		label: 'reference',
		page: {
			path: '/profile/references',
			name: 'References'
		},
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
		owner: { via: 'profile', column: certificates.profile_id },
		title: 'Certificates',
		label: 'certificate',
		page: {
			path: '/profile/certificates',
			name: 'Certificates'
		},
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
		owner: { via: 'profile', column: highlights.profile_id },
		title: 'Highlights',
		label: 'highlight',
		page: {
			path: '/profile/highlights',
			name: 'Highlights'
		},
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
	},

	/**
	 * The one parent-owned section: a skill belongs to a category, and the
	 * category belongs to the profile.
	 *
	 * Its rows are the smallest and by far the most numerous — a working
	 * applicant has a dozen roles and a hundred skills — which is why the
	 * capability layer caps how many it will list at once (see TARGET_LIST_CAP)
	 * while every other section prints its whole list.
	 */
	skill: {
		table: tech_skills,
		owner: {
			via: 'parent',
			parent: 'skill_category',
			column: tech_skills.category_id,
			key: 'category_id',
			nameField: 'category'
		},
		title: 'Skills',
		label: 'skill',
		page: {
			path: '/profile/skills',
			name: 'Skills'
		},
		// No bare "technology" or "stack": a job description is full of both, and
		// this section would then load on every turn spent reading one.
		aliases: ['tech skill', 'technical skill', 'skill set', 'skillset'],
		// Named with its group, because a skill's name alone is not unique on a real
		// profile: a version variant of a group holds its own copy of the skills in
		// it, so "Python" is two rows and the model picking between them by label
		// would be picking at random.
		rowLabel: (row) => joined([short(row.name), row.category], ' — ') || 'Untitled skill',
		shortLabel: (row) => short(row.name) || 'Untitled skill',
		rowNamesAreAmbiguous:
			'A skill name is what job descriptions are made of. Matching on one would ' +
			'reach for this section on any turn that mentions a technology.',
		fields: {
			name: { kind: 'string', note: 'the skill, written the way a job listing would name it' },
			category: {
				kind: 'string',
				note: 'the group it is filed under, named exactly as one of the groups listed below'
			},
			level: { kind: 'string', allowed: SKILL_LEVELS.map((level) => level.value) },
			years_experience: { kind: 'int', note: 'whole years of it' },
			tags: { kind: 'stringArray', notForAssistant: VERSION_SLUGS }
		},
		// `category` is required on a create and is a real answer rather than a
		// convenience: a skill filed nowhere renders nowhere, and picking a group
		// on the applicant's behalf is a decision about how their CV reads.
		required: ['name', 'category'],
		insertDefaults: {},
		notNullColumns: [],
		newRowPlacement: 'append',
		// Ordered as the page reads it — by group, then within the group. The
		// parent table is in scope because a parent-owned read joins it.
		orderBy: [asc(tech_skill_categories.sort), asc(tech_skills.sort)],
		schema: techSkillBasicSchema
	},

	/**
	 * The groups the skills page is organised into, and a section of its own.
	 *
	 * Sharing a page with `skill` is the reason `title` exists: both are edited
	 * at /profile/skills, and a manifest listing "Skills" twice would say nothing
	 * about which one holds what.
	 */
	skill_category: {
		table: tech_skill_categories,
		owner: { via: 'profile', column: tech_skill_categories.profile_id },
		title: 'Skill categories',
		label: 'skill category',
		page: {
			path: '/profile/skills',
			name: 'Skills'
		},
		aliases: ['skill group'],
		/**
		 * The heading, plus whatever tells it apart from a group of the same name.
		 *
		 * Groups are duplicated on purpose: the profile this was built against has
		 * two called "Backend", one tagged onto a `fullstack-react` version and one
		 * held back from it, which is how a tailored CV shows a different stack
		 * under the same heading. Two rows with the same label is a caller — the
		 * model, the write layer resolving a named group — choosing between them
		 * with nothing to choose on.
		 *
		 * `note` is what settles it, and it is not a field invented for this: the
		 * skills page has always offered it, labelled "private hint — which
		 * versions this is for", and it is where the applicant has already written
		 * "Python / Django" and "TypeScript / React" on the two Backends. It never
		 * renders on a document, so it costs nothing to be explicit in. Their own
		 * words beat a slug for the same reason a note beats a tag anywhere: it
		 * says what the group IS, where the tag says only where it appears.
		 *
		 * Version slugs are the fallback for a group with no note, so a profile
		 * that has not written one is still distinguishable rather than refused.
		 * `versionsOf` returns only positive slugs, so a group merely excluded from
		 * a version keeps its plain name. Notes are free text and are cut short
		 * here: this is a label, and every skill in the group carries it.
		 */
		rowLabel: (row) => {
			const heading = short(row.name) || 'Untitled category';
			const note = short(row.note, NOTE_IN_LABEL);
			if (note) return `${heading} (${note})`;

			const versions = versionsOf(row.tags as string[] | null);
			return versions.length > 0 ? `${heading} [${versions.join(', ')}]` : heading;
		},
		rowNamesAreAmbiguous:
			'Group names are words like "Backend" and "Tooling", which say nothing about ' +
			'whose profile is being discussed.',
		fields: {
			name: { kind: 'string', note: 'the heading this group of skills appears under' },
			note: {
				kind: 'string',
				note:
					'a private hint, never shown on a CV or an export — what tells this group ' +
					'apart from another one with the same heading'
			},
			fa_icon: {
				kind: 'string',
				notForAssistant:
					'A Font Awesome identifier such as faPython. A name that does not exist renders nothing, and the applicant sees a gap rather than an error.'
			},
			tags: { kind: 'stringArray', notForAssistant: VERSION_SLUGS }
		},
		required: ['name'],
		insertDefaults: {},
		notNullColumns: [],
		newRowPlacement: 'append',
		orderBy: [asc(tech_skill_categories.sort)],
		schema: techSkillCategoryBasicSchema,
		hideNote:
			'Hiding a group takes every skill in it off the document, not just the ' +
			'heading — both renderers drop a group once its heading is filtered out.'
	}
};

export const PROFILE_RESOURCE_NAMES = Object.keys(PROFILE_RESOURCES) as ProfileResourceName[];
