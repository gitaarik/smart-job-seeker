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
 * Fifteen, since the child collections joined them — the projects,
 * achievements and technologies that hang off a role or a side project. They
 * used to be excluded here on the grounds that their writes are id-stable
 * merges, which is real bespoke logic rather than CRUD. That is true of the
 * *collection* write and irrelevant to a section: the detail page posts every
 * project of one role at once, so its save has to keep each row's id across the
 * round trip, while this layer writes one row at a time and never deletes and
 * re-creates. The merge is what the page needs; a section needs `createRow` and
 * `updateRow`, which are id-stable by construction.
 *
 * What they did cost is two generalizations, both small and both now the rule
 * rather than an exception for them:
 *
 *  - **Ownership more than one row deep.** A project technology hangs off a
 *    project, which hangs off a role, which hangs off the profile. `ownedRows`
 *    used to refuse a chain outright; it now builds one, which turned out to be
 *    less code than the refusal was. See `ResourceOwner`.
 *  - **`status` is not universal.** Three of the six have no such column. It
 *    filters nothing anywhere (see HIDEABLE_RESOURCES), so the write layer
 *    writes it where it exists and does not miss it where it doesn't.
 *
 * Deliberately still not here:
 *
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
	side_project_achievements,
	side_project_technologies,
	side_projects,
	tech_skill_categories,
	tech_skills,
	work_experience_achievements,
	work_experience_project_technologies,
	work_experience_projects,
	work_experience_technologies,
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
	sideProjectAchievementBasicSchema,
	sideProjectBasicSchema,
	sideProjectTechnologyBasicSchema,
	techSkillBasicSchema,
	techSkillCategoryBasicSchema,
	workExperienceAchievementBasicSchema,
	workExperienceBasicSchema,
	workExperienceProjectBasicSchema,
	workExperienceProjectTechnologyBasicSchema,
	workExperienceTechnologyBasicSchema
} from '$lib/server/validation/api-schemas';

export type ProfileResourceName =
	| 'work_experience'
	| 'work_experience_project'
	| 'work_experience_achievement'
	| 'work_experience_technology'
	| 'work_experience_project_technology'
	| 'education'
	| 'side_project'
	| 'side_project_achievement'
	| 'side_project_technology'
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
	/**
	 * Optional, because three of the child collections do not have it.
	 *
	 * Not a gap worth closing with a migration: `status` filters nothing
	 * anywhere (see HIDEABLE_RESOURCES), so the three tables without it are the
	 * ones that never grew a column nothing reads. Declaring it required here
	 * would have meant adding dead columns to make a structural type fit.
	 */
	status?: PgColumn;
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
 *
 * A parent may itself be parent-owned, and one is: a project technology hangs
 * off a project, which hangs off a role. `ownedRows` used to refuse that outright
 * and now recurses, which is fewer lines than the refusal was — the recursion
 * was already there in `ownerOf`, and the SQL is one more nested subquery. The
 * chain must still terminate at a profile-owned section; `write.ts` bounds the
 * depth so a declaration that pointed a section at itself fails loudly rather
 * than hanging.
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
 * per-version tag it carries intact. A section qualifies when it has a `tags`
 * column AND every document renderer that prints it puts it through that
 * filter. Languages, references and certificates are rendered straight from the
 * profile with no filter at all, and highlights have no `tags` column, so for
 * those four there is simply no way to hide an entry — not from the assistant
 * and not from the UI either.
 *
 * The child collections split on the same test rather than on being children:
 *
 *  - **Role achievements** have `tags` and are filtered in both renderers
 *    (`ProfileDisplay` and `StructuredResume` each call `filterOnTags` with
 *    `OVERRIDE_ENTITIES.achievement`), so they hide.
 *  - **Role technologies** have `tags`, are filtered in `StructuredResume`, and
 *    are not printed by `ProfileDisplay` at all — nothing to filter is not the
 *    same failure as printing them unfiltered, so they hide too.
 *  - **Role projects, project technologies and the side-project pair** have no
 *    `tags` column. Projects additionally render on no document — they feed the
 *    generation context, not the layout — so there is nothing a hide could take
 *    them off of.
 *
 * The public portfolio at /p/[slug]/portfolio prints roles, achievements and
 * technologies with no filter at all, which is true of the five original
 * sections as well. It is a portfolio page rather than a document, and this list
 * is about documents; the hide contract says "every CV and every export" and
 * means it.
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
	'work_experience_achievement',
	'work_experience_technology',
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

	/**
	 * The projects inside one role, and the first section that renders on no
	 * document at all.
	 *
	 * That is not an oversight to fix here. Neither `ProfileDisplay` nor
	 * `StructuredResume` prints them; what reads them is the generation context —
	 * `assembleGenerationContext`'s `projects` source ranks them against the job
	 * being written for, and a cover letter or an interview answer is built out
	 * of the two or three that fit. So they are the applicant's evidence rather
	 * than their layout, and the consequence for this file is `hide`: there is
	 * nothing to take a project off, so it does not get the verb. See
	 * HIDEABLE_RESOURCES.
	 */
	work_experience_project: {
		table: work_experience_projects,
		owner: {
			via: 'parent',
			parent: 'work_experience',
			column: work_experience_projects.work_experience_id,
			key: 'work_experience_id',
			nameField: 'work_experience'
		},
		title: 'Role projects',
		label: 'role project',
		page: {
			path: '/profile/work-experience',
			name: 'Work experience'
		},
		// No bare "project": it is what `side_project` is called, it is half of
		// what a job description says, and this section is reached from the page
		// its rows live on rather than by being named.
		aliases: ['work project', 'project at a job', 'project within a role'],
		// Named with its role, for the reason a skill is named with its group: a
		// project called "the migration" is one row under this employer and
		// another under the next, and a label that said only "the migration"
		// would be picking between them by coin toss.
		rowLabel: (row) => joined([short(row.name), row.work_experience], ' — ') || 'Untitled project',
		shortLabel: (row) => short(row.name) || 'Untitled project',
		fields: {
			name: { kind: 'string', note: 'what the project was called' },
			work_experience: {
				kind: 'string',
				note: 'the role it was part of, named exactly as one of the roles listed below'
			},
			url: { kind: 'string', note: 'where it can be seen, if anywhere' },
			start_date: { kind: 'date' },
			end_date: { kind: 'date' },
			description: {
				kind: 'string',
				note: 'what the project was and what the applicant did on it'
			},
			outcome: { kind: 'string', note: 'what it changed — the result, not the work' }
		},
		required: ['name', 'work_experience'],
		insertDefaults: {},
		notNullColumns: [],
		newRowPlacement: 'append',
		// The role's order first, then the project's within it: the page shows
		// projects under the role they belong to, and appending against a
		// profile-wide maximum would put every new project after every project of
		// every other role.
		orderBy: [
			asc(work_experiences.sort),
			desc(work_experiences.start_date),
			asc(work_experience_projects.sort)
		],
		schema: workExperienceProjectBasicSchema
	},

	/** The bullet points under a role — what the applicant actually achieved there. */
	work_experience_achievement: {
		table: work_experience_achievements,
		owner: {
			via: 'parent',
			parent: 'work_experience',
			column: work_experience_achievements.work_experience_id,
			key: 'work_experience_id',
			nameField: 'work_experience'
		},
		title: 'Role achievements',
		label: 'role achievement',
		page: {
			path: '/profile/work-experience',
			name: 'Work experience'
		},
		aliases: ['achievement at a job', 'achievement in a role', 'what they achieved'],
		// The whole row is one sentence, so the label is the row cut short.
		rowLabel: (row) =>
			joined([short(row.description), row.work_experience], ' — ') || 'Untitled achievement',
		shortLabel: (row) => short(row.description) || 'Untitled achievement',
		fields: {
			description: {
				kind: 'string',
				note: 'one achievement, as one sentence — at most 255 characters'
			},
			work_experience: {
				kind: 'string',
				note: 'the role it belongs to, named exactly as one of the roles listed below'
			},
			fa_icon: {
				kind: 'string',
				notForAssistant:
					'A Font Awesome identifier such as faRocket. A name that does not exist renders nothing, and the applicant sees a gap rather than an error.'
			},
			tags: { kind: 'stringArray', notForAssistant: VERSION_SLUGS }
		},
		required: ['description', 'work_experience'],
		insertDefaults: {},
		notNullColumns: [],
		newRowPlacement: 'append',
		orderBy: [
			asc(work_experiences.sort),
			desc(work_experiences.start_date),
			asc(work_experience_achievements.sort)
		],
		schema: workExperienceAchievementBasicSchema
	},

	/** What one role was worked in — the stack listed under the job. */
	work_experience_technology: {
		table: work_experience_technologies,
		owner: {
			via: 'parent',
			parent: 'work_experience',
			column: work_experience_technologies.work_experience_id,
			key: 'work_experience_id',
			nameField: 'work_experience'
		},
		title: 'Role technologies',
		label: 'role technology',
		page: {
			path: '/profile/work-experience',
			name: 'Work experience'
		},
		aliases: ['technology used in a role', 'stack at a job'],
		rowLabel: (row) =>
			joined([short(row.name), row.work_experience], ' — ') || 'Untitled technology',
		shortLabel: (row) => short(row.name) || 'Untitled technology',
		rowNamesAreAmbiguous:
			'A technology name is what job descriptions are made of, exactly as for skills. ' +
			'Matching on one would reach for this section on any turn that mentions a stack.',
		fields: {
			name: { kind: 'string', note: 'the technology, named the way a job listing would' },
			work_experience: {
				kind: 'string',
				note: 'the role it was used in, named exactly as one of the roles listed below'
			},
			tags: { kind: 'stringArray', notForAssistant: VERSION_SLUGS }
		},
		required: ['name', 'work_experience'],
		insertDefaults: {},
		notNullColumns: [],
		newRowPlacement: 'append',
		orderBy: [
			asc(work_experiences.sort),
			desc(work_experiences.start_date),
			asc(work_experience_technologies.sort)
		],
		schema: workExperienceTechnologyBasicSchema
	},

	/**
	 * What one project was built with — the only two-level section there is.
	 *
	 * Its parent is `work_experience_project`, which is itself parent-owned, so
	 * this is the row that makes `ownedRows` recurse. Everything else about it is
	 * a name in a list.
	 */
	work_experience_project_technology: {
		table: work_experience_project_technologies,
		owner: {
			via: 'parent',
			parent: 'work_experience_project',
			column: work_experience_project_technologies.work_experience_project_id,
			key: 'work_experience_project_id',
			nameField: 'work_experience_project'
		},
		title: 'Role project technologies',
		label: 'role project technology',
		page: {
			path: '/profile/work-experience',
			name: 'Work experience'
		},
		rowLabel: (row) =>
			joined([short(row.name), row.work_experience_project], ' — ') || 'Untitled technology',
		shortLabel: (row) => short(row.name) || 'Untitled technology',
		rowNamesAreAmbiguous:
			'A technology name is what job descriptions are made of, exactly as for skills. ' +
			'Matching on one would reach for this section on any turn that mentions a stack.',
		fields: {
			name: { kind: 'string', note: 'the technology, named the way a job listing would' },
			work_experience_project: {
				kind: 'string',
				note: 'the project it was used on, named exactly as one of the projects listed below'
			}
		},
		required: ['name', 'work_experience_project'],
		insertDefaults: {},
		notNullColumns: [],
		newRowPlacement: 'append',
		// Only one join deep, so the role's order is not in scope here — a
		// grandchild's read joins its parent and no further. Within a project is
		// the order that matters anyway; across projects the list is grouped.
		orderBy: [asc(work_experience_projects.sort), asc(work_experience_project_technologies.sort)],
		schema: workExperienceProjectTechnologyBasicSchema
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

	/** The bullet points under a side project. Same shape as a role's, one column lighter. */
	side_project_achievement: {
		table: side_project_achievements,
		owner: {
			via: 'parent',
			parent: 'side_project',
			column: side_project_achievements.side_project_id,
			key: 'side_project_id',
			nameField: 'side_project'
		},
		title: 'Side project achievements',
		label: 'side project achievement',
		page: {
			path: '/profile/side-projects',
			name: 'Side projects'
		},
		rowLabel: (row) =>
			joined([short(row.description), row.side_project], ' — ') || 'Untitled achievement',
		shortLabel: (row) => short(row.description) || 'Untitled achievement',
		fields: {
			description: {
				kind: 'string',
				note: 'one achievement, as one sentence — at most 255 characters'
			},
			side_project: {
				kind: 'string',
				note: 'the project it belongs to, named exactly as one of the projects listed below'
			}
		},
		required: ['description', 'side_project'],
		insertDefaults: {},
		notNullColumns: [],
		newRowPlacement: 'append',
		orderBy: [
			asc(side_projects.sort),
			desc(side_projects.start_date),
			asc(side_project_achievements.sort)
		],
		schema: sideProjectAchievementBasicSchema
	},

	/** What one side project was built with. */
	side_project_technology: {
		table: side_project_technologies,
		owner: {
			via: 'parent',
			parent: 'side_project',
			column: side_project_technologies.side_project_id,
			key: 'side_project_id',
			nameField: 'side_project'
		},
		title: 'Side project technologies',
		label: 'side project technology',
		page: {
			path: '/profile/side-projects',
			name: 'Side projects'
		},
		rowLabel: (row) => joined([short(row.name), row.side_project], ' — ') || 'Untitled technology',
		shortLabel: (row) => short(row.name) || 'Untitled technology',
		rowNamesAreAmbiguous:
			'A technology name is what job descriptions are made of, exactly as for skills. ' +
			'Matching on one would reach for this section on any turn that mentions a stack.',
		fields: {
			name: { kind: 'string', note: 'the technology, named the way a job listing would' },
			side_project: {
				kind: 'string',
				note: 'the project it was used on, named exactly as one of the projects listed below'
			}
		},
		required: ['name', 'side_project'],
		insertDefaults: {},
		notNullColumns: [],
		newRowPlacement: 'append',
		orderBy: [
			asc(side_projects.sort),
			desc(side_projects.start_date),
			asc(side_project_technologies.sort)
		],
		schema: sideProjectTechnologyBasicSchema
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
