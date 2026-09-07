/**
 * The four texts an applicant writes with an AI editor, read for an agent.
 *
 * Cover letters, application questions, STAR stories and interview cheat
 * sheets. Four tables, one shape: a row holding the text that counts, and an
 * append-only trail of versions beside it (`entity-versions.ts`). The editor
 * proposes into the trail and the applicant commits from it, which is the
 * property this whole surface is built on — see `text-version-capabilities.ts`.
 *
 * ## Why one module for four tables
 *
 * The counterpart to `applications/profile-applications.ts` and
 * `jobs/profile-jobs.ts`: the MCP layer should not be assembling queries of its
 * own. What is new here is that the four kinds are addressed together, because
 * an agent asked to "sharpen the answers on this application" should not have
 * to know that two of them live under /applications and two under
 * /applications/interview.
 *
 * Each kind still writes its own query rather than being generated from a table
 * binding. `entity-versions.ts` records what generating over Drizzle table
 * objects costs — the generic types do not compose through a runtime binding,
 * so the columns end up `any` — and the four queries differ in more than the
 * table anyway: two are scoped through an application and two carry
 * `profile_id`, the answer column is named `answer` on one and `content` on two,
 * and a story has no single column at all.
 *
 * ## Two ownership rules, not one
 *
 * A story and a cheat sheet carry `profile_id`, so naming one is a WHERE
 * clause. A letter and a question do not: they hang off an application, and the
 * profile is one join away. Both end the same way — a row outside this profile
 * is indistinguishable from one that was never there — which is the rule
 * `mcp/entities.ts` states for jobs and applications.
 *
 * ## What "the text" means here
 *
 * The newest version's content, falling back to the committed column. That is
 * not a choice this module made: it is the rule `application-letter-followup.ts`
 * already revises against, and an agent revising something other than what the
 * app's own editor would revise is a divergence with no upside. `latest_is_current`
 * says whether that text is on the entity yet, which is the fact an agent needs
 * to avoid stacking a second proposal on top of one nobody has looked at.
 */

import { db } from '$lib/server/db';
import { and, desc, eq } from 'drizzle-orm';
import {
	application_letters,
	application_questions,
	applications,
	cheat_sheets,
	project_stories
} from '$lib/server/db/schema';
import {
	CHEATSHEET_VERSIONS,
	LETTER_VERSIONS,
	QUESTION_VERSIONS,
	STORY_VERSIONS,
	buildConversation,
	summarizeVersions,
	type VersionBinding,
	type VersionSource,
	type VersionTrailSummary
} from '$lib/server/ai-chat/entity-versions';
import { serializeStarMarkdown } from '$lib/interview/star';
import { touchProfile } from '$lib/server/profile/touch-profile';

/** How much of one text comes back in a single read. Same slice as a document. */
export const TEXT_READ_CHARS = 60000;

export const TEXT_PAGE_DEFAULT = 20;
export const TEXT_PAGE_MAX = 50;

export const TEXT_KIND_NAMES = ['letter', 'question', 'story', 'cheat_sheet'] as const;
export type TextKind = (typeof TEXT_KIND_NAMES)[number];

/**
 * The kinds an agent may START, as opposed to append a version to.
 *
 * A policy, written out rather than derived from which defs happen to carry a
 * `create`. The question "which of these may something outside the app bring
 * into existence" is a decision, and a decision that reads as a side effect of
 * an implementation detail is one nobody revisits on purpose. A test binds the
 * two, so a kind listed here without a `create` fails rather than ships.
 *
 * The two that are here own nothing but themselves: a story and a cheat sheet
 * hang off the profile, hold prep the applicant writes for their own use, and
 * are deleted with one click from the page they live on.
 *
 * The two that are NOT here are both claims about the outside world. A letter
 * is a document on an application, and a question asserts that an employer
 * asked something, and inventing one is inventing history, which is the line this
 * whole surface is drawn around. They are still made in the app.
 */
export const TEXT_CREATE_KIND_NAMES = ['story', 'cheat_sheet'] as const;
export type CreatableTextKind = (typeof TEXT_CREATE_KIND_NAMES)[number];

export function isTextKind(value: unknown): value is TextKind {
	return typeof value === 'string' && (TEXT_KIND_NAMES as readonly string[]).includes(value);
}

/** One row of one kind, in the terms the four have in common. */
interface TextRow {
	id: number;
	/** Names it to a person: the letter type, the question, the story's title. */
	label: string;
	/** The application it belongs to, or null for interview prep. */
	applicationId: number | null;
	/** The text the entity currently holds, before the trail is consulted. */
	committed: string | null;
	/**
	 * What this text is answering, where that is a separate thing from the text.
	 *
	 * Only a question has one, and it is not decoration: an answer read without
	 * its question is a paragraph with no way to tell whether it is any good.
	 */
	prompt?: string | null;
	/** Where a person opens it. */
	path: string;
}

export interface TextKindDef {
	kind: TextKind;
	/** Singular, for prose that has to name one. */
	noun: string;
	/** The page family it lives under, named the way the sidebar names it. */
	collection: { name: string; path: string };
	versions: VersionBinding;
	list(profileId: number, opts: { applicationId?: number; limit: number }): Promise<TextRow[]>;
	read(id: number, profileId: number): Promise<TextRow | null>;
	/**
	 * Make an empty one under this profile, titled, and return it as any other
	 * read would. Absent for a kind that may not be created from outside the app;
	 * see TEXT_CREATE_KIND_NAMES for which and why.
	 *
	 * Empty deliberately: the title is the whole of what a create decides, and
	 * the text arrives afterwards as a version the applicant takes. A create
	 * that accepted content would put a whole document on the profile that no
	 * timeline ever showed anyone, which is the one property the version verbs
	 * exist to preserve.
	 */
	create?(profileId: number, title: string): Promise<TextRow>;
}

/* ------------------------------------------------------------------ *
 * The four kinds
 * ------------------------------------------------------------------ */

const LETTER_TYPE_LABELS: Record<string, string> = {
	cover_letter: 'Cover letter',
	cheat_sheet: 'Interview cheat sheet'
};

/**
 * A letter's own name, which is its type and not a title.
 *
 * `letter_type` can itself be "cheat_sheet", which is NOT the `cheat_sheets`
 * table this module also reads — two features named the same thing, one a
 * letter written on an application and one an interview-prep sheet on the
 * profile. Spelling the label out is the only thing keeping them apart in a
 * list, and the tool description says so too.
 */
function letterLabel(letterType: string): string {
	return LETTER_TYPE_LABELS[letterType] ?? letterType;
}

/**
 * Where a newly created row goes in the applicant's own ordering: last.
 *
 * Both creatable kinds are hand-orderable lists, and both API routes that
 * create one compute this the same way. Reproducing it slightly differently
 * here is how an agent's cheat sheet would land somewhere the applicant's own
 * button never puts one.
 */
async function nextSort(
	table: typeof cheat_sheets | typeof project_stories,
	profileId: number
): Promise<number> {
	const [last] = await db
		.select({ sort: table.sort })
		.from(table)
		.where(eq(table.profile_id, profileId))
		.orderBy(desc(table.sort))
		.limit(1);
	return (last?.sort ?? -1) + 1;
}

/** Trim a question down to something that fits on one line of a list. */
function shorten(text: string | null, max = 100): string {
	const flat = (text ?? '').replace(/\s+/g, ' ').trim();
	if (!flat) return '';
	return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

// Hoisted: an inline array here becomes a readonly tuple and takes the whole
// query's inferred return type with it.
const NEWEST_LETTERS = [desc(application_letters.id)];

/**
 * Two orders, because "the questions" means two different lists.
 *
 * On one application it means the questions in the order the applicant put them
 * in, which is what `sort` is for and what their page shows. Across the whole
 * profile it means the ones they are working on now — and ascending `sort`
 * there is not an order at all, since every application numbers its own
 * questions from one. A page of twenty came back holding the oldest questions
 * on the profile, and a text written a minute ago was not in it.
 */
const QUESTION_ORDER = [application_questions.sort, application_questions.id];
const NEWEST_QUESTIONS = [desc(application_questions.id)];
const NEWEST_STORIES = [desc(project_stories.id)];
const NEWEST_SHEETS = [desc(cheat_sheets.id)];

const letterKind: TextKindDef = {
	kind: 'letter',
	noun: 'letter',
	collection: { name: 'Applications', path: '/applications' },
	versions: LETTER_VERSIONS,
	list: async (profileId, opts) => {
		const rows = await db
			.select({
				id: application_letters.id,
				letter_type: application_letters.letter_type,
				content: application_letters.content,
				application_id: application_letters.application_id
			})
			.from(application_letters)
			.innerJoin(applications, eq(application_letters.application_id, applications.id))
			.where(
				opts.applicationId
					? and(eq(applications.profile_id, profileId), eq(applications.id, opts.applicationId))
					: eq(applications.profile_id, profileId)
			)
			.orderBy(...NEWEST_LETTERS)
			.limit(opts.limit);

		return rows.map((row) => ({
			id: row.id,
			label: letterLabel(row.letter_type),
			applicationId: row.application_id,
			committed: row.content,
			path: `/applications/${row.application_id}/texts/${row.id}`
		}));
	},
	read: async (id, profileId) => {
		const row = await db.query.application_letters.findFirst({
			where: eq(application_letters.id, id),
			columns: { id: true, letter_type: true, content: true, application_id: true },
			with: { application: { columns: { id: true, profile_id: true } } }
		});
		if (!row || row.application?.profile_id !== profileId) return null;
		return {
			id: row.id,
			label: letterLabel(row.letter_type),
			applicationId: row.application_id,
			committed: row.content,
			path: `/applications/${row.application_id}/texts/${row.id}`
		};
	}
};

const questionKind: TextKindDef = {
	kind: 'question',
	noun: 'answer',
	collection: { name: 'Applications', path: '/applications' },
	versions: QUESTION_VERSIONS,
	list: async (profileId, opts) => {
		const rows = await db
			.select({
				id: application_questions.id,
				question: application_questions.question,
				answer: application_questions.answer,
				application_id: application_questions.application_id
			})
			.from(application_questions)
			.innerJoin(applications, eq(application_questions.application_id, applications.id))
			.where(
				opts.applicationId
					? and(eq(applications.profile_id, profileId), eq(applications.id, opts.applicationId))
					: eq(applications.profile_id, profileId)
			)
			.orderBy(...(opts.applicationId ? QUESTION_ORDER : NEWEST_QUESTIONS))
			.limit(opts.limit);

		return rows.map((row) => ({
			id: row.id,
			label: shorten(row.question),
			applicationId: row.application_id,
			committed: row.answer,
			prompt: row.question,
			path: `/applications/${row.application_id}/texts/questions/${row.id}`
		}));
	},
	read: async (id, profileId) => {
		const row = await db.query.application_questions.findFirst({
			where: eq(application_questions.id, id),
			columns: { id: true, question: true, answer: true, application_id: true },
			with: { application: { columns: { id: true, profile_id: true } } }
		});
		if (!row || row.application?.profile_id !== profileId) return null;
		return {
			id: row.id,
			label: shorten(row.question),
			applicationId: row.application_id,
			committed: row.answer,
			prompt: row.question,
			path: `/applications/${row.application_id}/texts/questions/${row.id}`
		};
	}
};

/**
 * A story's committed text is assembled, not stored.
 *
 * `project_stories` keeps the five STAR sections in their own columns and the
 * trail carries one canonical markdown document per version, so the comparison
 * "is the newest version what the story says" only means anything through
 * `serializeStarMarkdown`. See $lib/interview/star.
 */
const storyKind: TextKindDef = {
	kind: 'story',
	noun: 'story',
	collection: { name: 'Interview Prep', path: '/applications/interview' },
	versions: STORY_VERSIONS,
	list: async (profileId, opts) => {
		const rows = await db.query.project_stories.findMany({
			where: eq(project_stories.profile_id, profileId),
			columns: {
				id: true,
				title: true,
				situation: true,
				task: true,
				action: true,
				result: true,
				reflection: true
			},
			orderBy: NEWEST_STORIES,
			limit: opts.limit
		});
		return rows.map((row) => ({
			id: row.id,
			label: row.title || 'Untitled story',
			applicationId: null,
			committed: serializeStarMarkdown(row) || null,
			path: `/applications/interview/stories/${row.id}`
		}));
	},
	read: async (id, profileId) => {
		const row = await db.query.project_stories.findFirst({
			where: and(eq(project_stories.id, id), eq(project_stories.profile_id, profileId)),
			columns: {
				id: true,
				title: true,
				situation: true,
				task: true,
				action: true,
				result: true,
				reflection: true
			}
		});
		if (!row) return null;
		return {
			id: row.id,
			label: row.title || 'Untitled story',
			applicationId: null,
			committed: serializeStarMarkdown(row) || null,
			path: `/applications/interview/stories/${row.id}`
		};
	},
	create: async (profileId, title) => {
		const [row] = await db
			.insert(project_stories)
			.values({
				title,
				profile_id: profileId,
				sort: await nextSort(project_stories, profileId),
				date_created: new Date()
			})
			.returning({ id: project_stories.id, title: project_stories.title });

		await touchProfile(profileId);

		return {
			id: row.id,
			label: row.title || 'Untitled story',
			applicationId: null,
			// Every STAR section is empty, so there is nothing to serialize. Null
			// rather than "" for the same reason the reads use it: it is what an
			// unwritten text holds, and `currentText` compares against it.
			committed: null,
			path: `/applications/interview/stories/${row.id}`
		};
	}
};

const cheatSheetKind: TextKindDef = {
	kind: 'cheat_sheet',
	noun: 'cheat sheet',
	collection: { name: 'Interview Prep', path: '/applications/interview' },
	versions: CHEATSHEET_VERSIONS,
	list: async (profileId, opts) => {
		const rows = await db.query.cheat_sheets.findMany({
			where: eq(cheat_sheets.profile_id, profileId),
			columns: { id: true, title: true, content: true },
			orderBy: NEWEST_SHEETS,
			limit: opts.limit
		});
		return rows.map((row) => ({
			id: row.id,
			label: row.title || 'Untitled cheat sheet',
			applicationId: null,
			committed: row.content,
			path: `/applications/interview/cheatsheets/${row.id}`
		}));
	},
	read: async (id, profileId) => {
		const row = await db.query.cheat_sheets.findFirst({
			where: and(eq(cheat_sheets.id, id), eq(cheat_sheets.profile_id, profileId)),
			columns: { id: true, title: true, content: true }
		});
		if (!row) return null;
		return {
			id: row.id,
			label: row.title || 'Untitled cheat sheet',
			applicationId: null,
			committed: row.content,
			path: `/applications/interview/cheatsheets/${row.id}`
		};
	},
	create: async (profileId, title) => {
		const [row] = await db
			.insert(cheat_sheets)
			.values({
				title,
				content: null,
				profile_id: profileId,
				sort: await nextSort(cheat_sheets, profileId),
				date_created: new Date()
			})
			.returning({ id: cheat_sheets.id, title: cheat_sheets.title });

		await touchProfile(profileId);

		return {
			id: row.id,
			label: row.title || 'Untitled cheat sheet',
			applicationId: null,
			committed: null,
			path: `/applications/interview/cheatsheets/${row.id}`
		};
	}
};

export const TEXT_KINDS: Record<TextKind, TextKindDef> = {
	letter: letterKind,
	question: questionKind,
	story: storyKind,
	cheat_sheet: cheatSheetKind
};

/* ------------------------------------------------------------------ *
 * Reads
 * ------------------------------------------------------------------ */

export interface ProfileTextSummary {
	kind: TextKind;
	id: number;
	label: string;
	application_id: number | null;
	/** The question, for a kind that has one separately from its text. */
	prompt: string | null;
	/** Length of the text as it stands, which is the trail's newest or the column. */
	chars: number;
	versions: number;
	latest_version_id: number | null;
	latest_version_source: VersionSource | null;
	/**
	 * Whether the newest version is the text the entity actually holds.
	 *
	 * False means a version is sitting in the trail that the applicant has not
	 * taken — usually the last thing the editor or an agent proposed. Read it
	 * before proposing another: stacking a second rewrite on an unread one is
	 * how a timeline becomes a queue nobody works through.
	 */
	latest_is_current: boolean;
	/** Where a person opens it. */
	path: string;
}

export interface ProfileTextDetail extends ProfileTextSummary {
	/** The text as an editor would revise it: newest version, else the column. */
	text: string;
	offset: number;
	returned_chars: number;
	more: boolean;
	/** The trail, oldest first. Content is summarised by length, never inlined. */
	trail: {
		version_id: number;
		source: VersionSource;
		chars: number;
		/** What the AI said about that turn, where it said anything. */
		feedback: string | null;
		/** What the applicant asked for, where they typed it themselves. */
		request: string | null;
		at: string | null;
	}[];
}

/** The text an editor would revise, and whether it is on the entity yet. */
function currentText(
	row: TextRow,
	latest: { content: string | null } | undefined
): { text: string; latestIsCurrent: boolean } {
	const committed = row.committed ?? '';
	if (!latest) return { text: committed, latestIsCurrent: true };
	const newest = latest.content ?? '';
	// A version carrying no content is an advice turn: it changed nothing, so
	// what the entity holds is still current.
	if (!newest) return { text: committed, latestIsCurrent: true };
	return { text: newest, latestIsCurrent: newest.trim() === committed.trim() };
}

async function summarize(def: TextKindDef, rows: TextRow[]): Promise<ProfileTextSummary[]> {
	const trails = await summarizeVersions(
		def.versions,
		rows.map((row) => row.id)
	);

	return rows.map((row) => {
		const trail = trails.get(row.id);
		const { text, latestIsCurrent } = currentText(row, trail?.latest);
		return {
			kind: def.kind,
			id: row.id,
			label: row.label,
			application_id: row.applicationId,
			prompt: row.prompt ?? null,
			chars: text.length,
			versions: trail?.count ?? 0,
			latest_version_id: trail?.latest.id ?? null,
			latest_version_source: trail?.latest.source ?? null,
			latest_is_current: latestIsCurrent,
			path: row.path
		};
	});
}

/**
 * Every text this profile has, or every one on one application.
 *
 * The limit is per kind rather than over the whole list: an applicant with
 * forty stories should not push their two cover letters off the end of a call
 * that asked for both.
 */
export async function listProfileTexts(
	profileId: number,
	opts: { kind?: TextKind; applicationId?: number; limit?: number } = {}
): Promise<ProfileTextSummary[]> {
	const limit = Math.min(Math.max(opts.limit ?? TEXT_PAGE_DEFAULT, 1), TEXT_PAGE_MAX);
	const kinds = opts.kind ? [TEXT_KINDS[opts.kind]] : TEXT_KIND_NAMES.map((k) => TEXT_KINDS[k]);

	// An application id names letters and questions; the other two hang off the
	// profile and have nothing to filter by it. Returning every story on the
	// profile for a call scoped to one application would answer a question
	// nobody asked, so those kinds drop out instead.
	const wanted = opts.applicationId
		? kinds.filter((def) => def.kind === 'letter' || def.kind === 'question')
		: kinds;

	const perKind = await Promise.all(
		wanted.map(async (def) =>
			summarize(def, await def.list(profileId, { applicationId: opts.applicationId, limit }))
		)
	);

	return perKind.flat();
}

export async function readProfileText(
	kind: TextKind,
	id: number,
	profileId: number,
	opts: { offset?: number } = {}
): Promise<ProfileTextDetail | null> {
	const def = TEXT_KINDS[kind];
	const row = await def.read(id, profileId);
	if (!row) return null;

	const [summary] = await summarize(def, [row]);
	const conversation = await buildConversation(def.versions, id);
	const latest = [...conversation].reverse().find((entry) => entry.content);
	const { text } = currentText(row, latest ? { content: latest.content ?? null } : undefined);

	const offset = Math.max(opts.offset ?? 0, 0);
	const slice = text.slice(offset, offset + TEXT_READ_CHARS);

	return {
		...summary,
		text: slice,
		offset,
		returned_chars: slice.length,
		more: offset + slice.length < text.length,
		trail: conversation.map((entry) => ({
			version_id: entry.versionId,
			source: entry.type,
			chars: entry.content?.length ?? 0,
			feedback: entry.aiFeedback ?? null,
			request: entry.userRequest ?? null,
			at: entry.date ? entry.date.toISOString() : null
		}))
	};
}

/**
 * One kind's trail shapes, so a caller does not need to know its binding.
 *
 * The bindings are an implementation detail of which table holds which
 * versions; a capability asking "how many versions does letter 12 have" should
 * name the kind and nothing else.
 */
export function summarizeTextVersions(
	kind: TextKind,
	entityIds: number[]
): Promise<Map<number, VersionTrailSummary>> {
	return summarizeVersions(TEXT_KINDS[kind].versions, entityIds);
}

/** The row a write names, for the capabilities. Null when it is not theirs. */
export function readOwnedText(
	kind: TextKind,
	id: number,
	profileId: number
): Promise<TextRow | null> {
	return TEXT_KINDS[kind].read(id, profileId);
}

export type { TextRow };
