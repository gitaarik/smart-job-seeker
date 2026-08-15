/**
 * What the assistant may *change* on the page the user is on.
 *
 * The read side of the chat is a registry already: `SOURCES` in
 * generation-context.ts teaches every caller one evidence source, and a route
 * scope just lists the keys it wants. This is the same shape for writes — add a
 * CAPABILITIES entry, name it in a route scope, and the assistant can propose
 * that edit everywhere the scope applies.
 *
 * Keying by capability rather than by page is what makes it reusable: an
 * application page wants to edit both the application *and* the manually-created
 * job behind it, and `edit_job_details` gets there by resolving
 * `application.job_id` instead of a route param. One entry, two routes, one
 * permission check.
 *
 * Three rules hold for every entry:
 *
 *  1. **Nothing is ever applied automatically.** A capability produces a
 *     proposal; the user applies it. The registry has no path that writes as a
 *     side effect of a chat turn.
 *  2. **`authorize` is never implied.** `resolveEntity` in chat-context.ts
 *     resolves any job to any signed-in user, because /jobs/[id] renders any job
 *     to any signed-in user. Edit rights are a separate question, asked here,
 *     and asked again at apply time.
 *  3. **Absent means unchanged.** Proposals are partial. A field the model
 *     omits keeps its current value; only an explicit null clears a column.
 *     Both providers in use here drop nullable fields they have no opinion on
 *     (see the gpt-oss/Gemini notes in the prompt contracts below), so the
 *     failure mode of a confused model is proposing nothing, never wiping a row.
 */

import { db } from '$lib/server/db';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { application_records, applications, jobs } from '$lib/server/db/schema';
import type { ContextEntity } from './generation-context';
import { coerceValue, WIRE_TYPES, type FieldKind } from '$lib/server/utils/field-kinds';
import { PROFILE_CAPABILITIES, type ProfileCapability } from './profile-capabilities';
import {
	applyJobFields,
	applyJobSkills,
	applyJobTexts,
	canEditJob,
	type JobFieldValues,
	validateJobFields
} from '$lib/server/jobs/edit-job';
import {
	clampRecordTitle,
	deriveRecordTitle,
	getRecordTypeLabel,
	recordTypeValues,
	today
} from '$lib/application-records';
import { deriveRecordMetadata } from './record-derivation';
import { summarizeApplication } from './application-summary';

/** Re-exported so a capability's `fields` map can be typed without reaching past this module. */
export type { FieldKind };

/**
 * The hand-written capabilities: jobs and applications, whose semantics are
 * bespoke enough that generating them would mean describing the exceptions.
 */
type HandWrittenCapability =
	| 'edit_job_details'
	| 'edit_job_description'
	| 'edit_job_skills'
	| 'edit_application_details'
	| 'add_activity_record';

/**
 * Everything the assistant may propose. The profile half is generated from
 * `PROFILE_RESOURCES` — see profile-capabilities.ts for why those are not
 * written out here.
 */
export type Capability = HandWrittenCapability | ProfileCapability;

/** The concrete row a capability acts on, once resolved from the page entity. */
export interface CapabilityTarget {
	id: number;
	/** Names the thing in the proposal card and in the prompt. */
	label: string;
}

/** Who is asking. Passed to authorize; never taken from the client. */
export interface CapabilityActor {
	profileId: number;
	isStaff: boolean;
}

export interface CapabilityDef {
	/** Shown in the prompt's capability list and on the proposal card. */
	title: string;
	/**
	 * The row this capability acts on for the given page entity, or null when the
	 * page has nothing for it to act on (an application with no job attached, a
	 * profile-only page).
	 */
	resolve(entity: ContextEntity | null, actor: CapabilityActor): Promise<CapabilityTarget | null>;
	/**
	 * The rows this capability may act on when the page is about a *list* rather
	 * than one row — the languages page, not one language.
	 *
	 * Optional, and tried only when `resolve` came back empty, which is what
	 * gives the page its bias: a page that names its row keeps that row, and
	 * only a page that names none offers a choice. A capability without this is
	 * simply never live on a list.
	 *
	 * Every row it returns must already be authorized. The model picks from this
	 * list by id and cannot name anything outside it — it may name a row, never
	 * reach one.
	 */
	resolveMany?(entity: ContextEntity | null, actor: CapabilityActor): Promise<CapabilityTarget[]>;
	/** Re-asked at apply time. Returning false drops the capability silently. */
	authorize(target: CapabilityTarget, actor: CapabilityActor): Promise<boolean>;
	/**
	 * Current values, so the model proposes a diff and the card can show one.
	 *
	 * Takes the actor because not every row is readable by whoever asked. A job
	 * is — /jobs/[id] renders any job to any signed-in user — but a profile row
	 * read by id alone would put another applicant's history into this one's
	 * prompt. The capabilities that don't need it ignore it.
	 */
	current(target: CapabilityTarget, actor: CapabilityActor): Promise<Record<string, unknown>>;
	/**
	 * The fields this capability can change, by kind. One declaration drives
	 * both the wire schema (buildProposalSchema) and the coercion applied to
	 * what comes back (pickCapabilityFields), so the two cannot drift.
	 *
	 * Field names must not collide across capabilities: buildProposalSchema
	 * merges the live ones into a single object for the provider, and a
	 * collision would let one capability's value land in another's payload.
	 */
	fields: Record<string, FieldKind>;
	/**
	 * The prose contract for this capability — what its fields mean and what a
	 * valid value looks like.
	 *
	 * Prose, not just a schema: passing a schema is not enough with either
	 * provider here — gpt-oss returns bare arrays and lists where strings belong,
	 * and Gemini has silently dropped `.transform()`ed fields. Spelling out the
	 * JSON contract in words is what makes structured output hold.
	 *
	 * A plain string, and deliberately so: it holds nothing about the row being
	 * edited, so it can be rendered before a target exists. That is what an MCP
	 * server needs — `list_tools` answers with descriptions long before anyone
	 * has said which job they mean — and it is why this was split out of the
	 * function that used to render the whole block. Rules that hold for *every*
	 * capability don't belong here either; they live once in the preamble of
	 * renderCapabilityPrompt, not n times in the prompt.
	 */
	contract: string;
	/**
	 * This capability's current state, for the model to propose against.
	 *
	 * Defaults to `renderCurrent` — a list of the fields and their values, which
	 * is what a diff needs. Capabilities override it when what the model needs to
	 * see isn't that: the long texts show their lengths because the texts
	 * themselves arrive through a context source, and an entry log shows the
	 * chronology it is about to add to because there is no row to diff yet.
	 */
	renderState?(current: Record<string, unknown>): string;
	/** Checks the schema can't express. Runs before apply, and before storing a proposal. */
	validate(
		fields: Record<string, unknown>,
		current: Record<string, unknown>
	): { ok: true } | { ok: false; error: string };
	/**
	 * Commit. Called only after authorize and validate have passed again.
	 *
	 * The actor is here for the same reason it is on `current`: a write through
	 * the profile write layer is authorized against a profile, and a capability
	 * wrapping it has to say whose. Job writes don't need it and don't take it.
	 */
	apply(
		target: CapabilityTarget,
		fields: Record<string, unknown>,
		current: Record<string, unknown>,
		actor: CapabilityActor
	): Promise<void>;
}

/* ------------------------------------------------------------------ *
 * The LLM boundary
 *
 * Two separate jobs, deliberately not fused: the *wire schema* that goes to the
 * provider and must survive conversion to JSON Schema, and the *coercion* that
 * runs on our side afterwards and gets loose model output back to real types.
 * Both live in `field-kinds.ts`, which the profile write layer shares — the
 * reasoning, and why the strict/lenient split exists, is written up there.
 * ------------------------------------------------------------------ */

/**
 * Render current values for the prompt, so the model can propose a diff.
 *
 * Carries its own heading because the block renderer composes it blind: it
 * knows a capability has state to show, not what that state is called. The two
 * capabilities that override this label theirs differently for the same reason.
 */
function renderCurrent(current: Record<string, unknown>): string {
	const lines = Object.entries(current).map(([key, value]) => {
		const rendered =
			value === null || value === undefined || value === ''
				? '(not set)'
				: Array.isArray(value)
					? value.join(', ')
					: String(value);
		return `  - ${key}: ${rendered}`;
	});
	return `Current values:\n\n${lines.join('\n')}`;
}

/* ------------------------------------------------------------------ *
 * edit_job_details
 * ------------------------------------------------------------------ */

/**
 * The job a page is about: itself on /jobs/[id], the attached one on an
 * application page. Returns null for a page with neither.
 */
async function resolveJobTarget(entity: ContextEntity | null): Promise<CapabilityTarget | null> {
	if (!entity) return null;

	const jobId =
		entity.type === 'job'
			? entity.id
			: (
					await db.query.applications.findFirst({
						where: eq(applications.id, entity.id),
						columns: { job_id: true }
					})
				)?.job_id;
	if (!jobId) return null;

	const job = await db.query.jobs.findFirst({
		where: eq(jobs.id, jobId),
		columns: { id: true, title: true, company: true }
	});
	if (!job) return null;

	return {
		id: job.id,
		label: [job.title ?? 'Untitled job', job.company].filter(Boolean).join(' at ')
	};
}

async function currentJobFields(target: CapabilityTarget): Promise<Record<string, unknown>> {
	const job = await db.query.jobs.findFirst({
		where: eq(jobs.id, target.id)
	});
	if (!job) return {};
	return {
		title: job.title,
		company: job.company,
		job_poster: job.job_poster,
		office_location: job.office_location,
		source_url: job.source_url,
		date_posted: job.date_posted,
		salary_min: job.salary_min,
		salary_max: job.salary_max,
		salary_currency: job.salary_currency,
		salary_period: job.salary_period,
		work_location: job.work_location ?? null,
		job_types: job.job_types ?? null,
		experience_levels: job.experience_levels ?? null
	};
}

const editJobDetails: CapabilityDef = {
	title: "Edit the job's details",
	resolve: (entity) => resolveJobTarget(entity),
	authorize: (target, actor) => canEditJob(target.id, actor.profileId, actor.isStaff),
	current: currentJobFields,
	fields: {
		title: 'string',
		company: 'string',
		job_poster: 'string',
		office_location: 'string',
		source_url: 'string',
		date_posted: 'string',
		salary_min: 'int',
		salary_max: 'int',
		salary_currency: 'string',
		salary_period: 'string',
		work_location: 'stringArray',
		job_types: 'stringArray',
		experience_levels: 'stringArray'
	},
	contract: `You may propose corrections to this job's structured fields.

Field rules, all of which are enforced after you answer:
- "title" is a plain string and can never be empty or null.
- "salary_min" and "salary_max" are whole numbers with no currency symbol, no
  thousands separator and no range in a single field (write 55000, not "55,000"
  or "55-70k"). A range the user states as "75000 to 90000" is TWO fields:
  salary_min 75000 AND salary_max 90000. Sending only one of them leaves the
  other at its old value, which reads as a salary band nobody offered.
- "salary_currency" is a 3-letter code such as EUR, USD, GBP.
- "salary_period" is exactly one of: year, month, week, day, hour, project.
- "date_posted" is YYYY-MM-DD.
- "work_location" is a JSON array drawn from: remote, hybrid, onsite.
- "job_types" is a JSON array drawn from: full_time, part_time, contract, internship.
- "experience_levels" is a JSON array drawn from: entry, junior, mid, mid_senior,
  senior, lead, principal.
- The three array fields must be JSON arrays of strings even when there is one
  value — ["remote"], not "remote".
- "office_location" is a real place. A working arrangement like "Remote" belongs
  in "work_location" instead. Setting "work_location" to remote does NOT mean
  clearing "office_location" — a remote role can still be attached to an office,
  and the user did not ask you to forget which one.`,
	validate: (fields, current) => {
		const merged = { ...current, ...fields };
		return validateJobFields({
			...(merged as unknown as JobFieldValues),
			title: typeof merged.title === 'string' ? merged.title : ''
		});
	},
	apply: async (target, fields, current) => {
		// applyJobFields is authoritative for every column it writes, so the
		// partial proposal is merged over the current row rather than passed
		// through — otherwise an omitted field would read as "clear it".
		const merged = { ...current, ...fields } as unknown as JobFieldValues;
		await applyJobFields(target.id, merged);
	}
};

/* ------------------------------------------------------------------ *
 * edit_job_description
 * ------------------------------------------------------------------ */

const editJobDescription: CapabilityDef = {
	title: "Rewrite the job's description or company profile",
	resolve: (entity) => resolveJobTarget(entity),
	authorize: (target, actor) => canEditJob(target.id, actor.profileId, actor.isStaff),
	current: async (target) => {
		const job = await db.query.jobs.findFirst({
			where: eq(jobs.id, target.id),
			columns: { job_description: true, company_description: true }
		});
		return {
			job_description: job?.job_description ?? null,
			company_description: job?.company_description ?? null
		};
	},
	// Both long-form texts live on one capability because they are one editing
	// job: the model is shown both in the job block and asked to keep them
	// consistent. With only job_description here, a request to fix the "About the
	// company" section had nowhere to go — the model wrote the company text into
	// the posting instead, then insisted it had removed details that were still
	// sitting in the field it could not reach.
	fields: { job_description: 'string', company_description: 'string' },
	contract: `You may propose replacements for this job's two long-form texts.

- "job_description" — the posting itself.
- "company_description" — the "About the company" blurb.

Each is replaced outright, so send the complete new text as the value, not a
fragment or a diff. Change one or both in the same proposal.

Which one holds what matters, and they are edited independently:
- Anything about the ROLE — duties, requirements, pay, hours, process — is
  "job_description".
- Anything about the COMPANY, who they are, who they work with or through, and
  how they relate to other organisations, is "company_description".

If the user asks you to correct something and the outdated text is in the other
field, change THAT field. Rewriting the posting will not fix a stale company
blurb, and saying you have removed something you did not reach is worse than
saying you cannot.

Do not invent requirements, benefits or company details that are not in the
material you have been given; tidying and restructuring are in scope, inventing
facts is not.

The structured fields — skills, salary, location — were extracted from the OLD
text, so anything your rewrite changes is now stale in them. Correct the ones
you have a capability for, in the same answer. For the ones you do not, say so
in your reply: they stay wrong until the job is re-parsed, and the user is the
only one who can decide to do that.`,
	// Lengths, not the texts. The texts themselves reach the model through the
	// `job` context source — which is why this says "shown in full above". A
	// caller that makes this capability live without that source hands the model
	// a rewrite button for something it cannot read; it then proposes nothing,
	// which reads as the contract failing rather than as the context being
	// absent.
	renderState: (current) =>
		`Both are shown in full in the job section above — currently ${
			String(current.job_description ?? '').length
		} characters of job_description and ${
			String(current.company_description ?? '').length
		} of company_description.`,
	validate: (fields) => {
		if (
			fields.job_description !== undefined &&
			(typeof fields.job_description !== 'string' || fields.job_description.trim() === '')
		) {
			return { ok: false, error: 'The description cannot be empty' };
		}
		if (
			fields.company_description !== undefined &&
			fields.company_description !== null &&
			typeof fields.company_description !== 'string'
		) {
			return { ok: false, error: 'The company description must be text' };
		}
		return { ok: true };
	},
	apply: async (target, fields) => {
		// Only the fields actually proposed — applyJobTexts leaves the rest alone,
		// so rewriting one text never blanks the other.
		await applyJobTexts(target.id, {
			...('job_description' in fields
				? { job_description: fields.job_description as string | null }
				: {}),
			...('company_description' in fields
				? { company_description: fields.company_description as string | null }
				: {})
		});
	}
};

/* ------------------------------------------------------------------ *
 * edit_job_skills
 * ------------------------------------------------------------------ */

/** Longer than this and the model has written a requirement, not a skill. */
const MAX_SKILL_LENGTH = 80;
/** Well clear of a real posting — the widest on dev lists 17 preferred. */
const MAX_SKILLS = 60;

/**
 * Separate from `edit_job_details` even though both write columns on `jobs`,
 * because the two are not one editing job. Details are thirteen scalars with a
 * taxonomy behind them; these are two free-text lists with whole-list
 * replacement semantics and a re-score attached. Folding them together would
 * mean one prompt contract carrying both sets of rules, and a model that
 * reaches for the salary rules when it is editing skills.
 *
 * It also keeps the blast radius honest: a user asking to fix a skill gets a
 * card that only ever touches skills.
 */
const editJobSkills: CapabilityDef = {
	title: "Edit the job's required and preferred skills",
	resolve: (entity) => resolveJobTarget(entity),
	authorize: (target, actor) => canEditJob(target.id, actor.profileId, actor.isStaff),
	current: async (target) => {
		const job = await db.query.jobs.findFirst({
			where: eq(jobs.id, target.id),
			columns: { skills_required: true, skills_preferred: true }
		});
		return {
			skills_required: (job?.skills_required as string[] | null) ?? null,
			skills_preferred: (job?.skills_preferred as string[] | null) ?? null
		};
	},
	// Deliberately not `soft_skills` or `responsibilities`, which the parser also
	// extracts: nothing reads them. They are on no page, in no email and in no
	// match score, so exposing them would be asking the model to maintain fields
	// whose only reader would be the next model.
	fields: { skills_required: 'stringArray', skills_preferred: 'stringArray' },
	contract: `You may propose changes to the two skill lists extracted from this
posting.

- "skills_required" — what the posting presents as necessary.
- "skills_preferred" — what it presents as a bonus or a nice-to-have.

Both are JSON arrays of strings, and each is REPLACED WHOLE. There is no way to
say "remove this one": to drop a skill, send the complete list with that skill
left out and every other skill still in it. A list containing only the skill you
meant to remove deletes all the others. Send only the list you are changing —
the one you leave out is untouched.

One skill per entry, named the way the posting names it: "PostgreSQL", not
"experience with PostgreSQL databases" and not "React and Next.js".

These two lists are what this job's match score is computed from, so changing
them re-scores it. Propose a change when the user asks for one, or when they
have just accepted a rewrite of the description that changed which technologies
the role calls for — in that case say so in your reply, because they will not
expect the score to move.

Do not add a skill nobody has mentioned. If the user tells you a skill does not
belong, that is reason enough to remove it — you do not need to find it in the
text first, because the reason it is wrong is usually that the text was wrong.`,
	validate: (fields) => {
		for (const key of ['skills_required', 'skills_preferred'] as const) {
			const value = fields[key];
			// Absent means unchanged and null means clear; both are fine here.
			if (value === undefined || value === null) continue;

			if (!Array.isArray(value)) {
				return { ok: false, error: 'Skills must be a list' };
			}
			if (value.length > MAX_SKILLS) {
				return {
					ok: false,
					error: `That is ${value.length} skills — more than a posting lists`
				};
			}
			const sentence = value.find((s) => String(s).length > MAX_SKILL_LENGTH);
			if (sentence !== undefined) {
				return {
					ok: false,
					error: `"${String(sentence).slice(0, 40)}…" is a requirement, not a skill`
				};
			}
		}
		return { ok: true };
	},
	apply: async (target, fields) => {
		// Only the lists actually proposed. This matters more here than it does for
		// the two texts: each list is written whole, so a list that arrived as
		// "unchanged" and got passed through as null would be silently emptied.
		await applyJobSkills(target.id, {
			...('skills_required' in fields
				? { skills_required: fields.skills_required as string[] | null }
				: {}),
			...('skills_preferred' in fields
				? { skills_preferred: fields.skills_preferred as string[] | null }
				: {})
		});
	}
};

/* ------------------------------------------------------------------ *
 * edit_application_details
 * ------------------------------------------------------------------ */

/** The application a page is about, or null on a page that is about something else. */
async function resolveApplicationTarget(
	entity: ContextEntity | null
): Promise<CapabilityTarget | null> {
	if (entity?.type !== 'application') return null;
	const app = await db.query.applications.findFirst({
		where: eq(applications.id, entity.id),
		columns: { id: true },
		with: { job: { columns: { title: true, company: true } } }
	});
	if (!app) return null;
	return {
		id: app.id,
		label: [app.job?.title ?? 'Application', app.job?.company].filter(Boolean).join(' at ')
	};
}

/**
 * Applications are profile-scoped, unlike jobs: owning the row is the whole
 * check, and resolveEntity already required it. Asked again anyway — this runs
 * at apply time too, when nothing else has.
 */
async function ownsApplication(target: CapabilityTarget, actor: CapabilityActor): Promise<boolean> {
	const owned = await db.query.applications.findFirst({
		where: and(eq(applications.id, target.id), eq(applications.profile_id, actor.profileId)),
		columns: { id: true }
	});
	return !!owned;
}

/**
 * Deliberately the three fields the page's own `?/updateDetails` action covers.
 * Status is excluded: it writes an application_status_log row and drives the
 * pipeline view, so it wants its own capability with its own contract rather
 * than riding along in a details edit.
 */
const editApplicationDetails: CapabilityDef = {
	title: "Edit the application's details",
	resolve: resolveApplicationTarget,
	authorize: ownsApplication,
	current: async (target) => {
		const app = await db.query.applications.findFirst({
			where: eq(applications.id, target.id),
			columns: {
				cv_sent_through: true,
				application_sent_date: true,
				application_seen_date: true
			}
		});
		return {
			cv_sent_through: app?.cv_sent_through ?? null,
			application_sent_date: app?.application_sent_date ?? null,
			application_seen_date: app?.application_seen_date ?? null
		};
	},
	fields: {
		cv_sent_through: 'string',
		application_sent_date: 'string',
		application_seen_date: 'string'
	},
	contract: `You may propose corrections to how and when this application was
sent.

- "cv_sent_through" is free text naming the channel (e.g. "LinkedIn Easy Apply",
  "company website", "referral from Sam").
- "application_sent_date" and "application_seen_date" are YYYY-MM-DD. If the
  user says something relative ("last Tuesday"), resolve it against today's date
  and state the date you used in your reply so they can correct you.

You cannot change the application's status from here — if that is what they
want, tell them to use the status control on the page.`,
	validate: (fields) => {
		for (const key of ['application_sent_date', 'application_seen_date']) {
			const value = fields[key];
			if (value !== undefined && value !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
				return { ok: false, error: `${key} must be a YYYY-MM-DD date` };
			}
		}
		return { ok: true };
	},
	apply: async (target, fields, current) => {
		const merged = { ...current, ...fields };
		await db
			.update(applications)
			.set({
				cv_sent_through: (merged.cv_sent_through as string | null) ?? null,
				application_sent_date: (merged.application_sent_date as string | null) ?? null,
				application_seen_date: (merged.application_seen_date as string | null) ?? null,
				date_updated: new Date()
			})
			.where(eq(applications.id, target.id));
	}
};

/* ------------------------------------------------------------------ *
 * add_activity_record
 * ------------------------------------------------------------------ */

/** How much of the chronology the model sees, so it doesn't re-log what's there. */
const RECENT_ENTRIES_SHOWN = 12;

/**
 * Write down something the user mentioned in conversation, as an entry on the
 * application's Activity tab.
 *
 * ## Why this writes an entry and not a detail
 *
 * The overview's "Worth remembering" list (`applications.context_details`) is a
 * PROJECTION of the entries, not a store. Every summarisation replaces it
 * wholesale, which is exactly what stops a superseded salary figure living on
 * beside the one that replaced it. So a detail written straight into that column
 * would survive until the next entry the user added and then disappear, with
 * nothing anywhere to say where it went — a bug that would present as the
 * assistant lying about having saved something.
 *
 * Writing at the source instead makes every consumer correct from one write:
 * derivation types the entry and pulls out who was involved, the summariser
 * re-reads the chronology, details are re-extracted with a real entry behind
 * them so the card's "source" link resolves, offer terms update if what they
 * mentioned was an offer, and the comparison spine picks it up. The alternative
 * is four writes and a consistency problem.
 *
 * ## Why it is proposed and not just written
 *
 * Every capability here is proposed — but this one would be the tempting
 * exception, because "just remember that for me" sounds like an instruction
 * rather than an edit. It isn't one. An entry is evidence: the summariser reads
 * it as something that happened, the details card cites it as a source, and the
 * spine counts it as contact with the employer. A half-heard "I think they said
 * maybe hybrid?" entering that store unreviewed is indistinguishable, later,
 * from an offer letter the user pasted in verbatim — and the whole reason the
 * details card carries "source" links is so a fact on the overview page can be
 * traced to something the user vouched for.
 */
const addActivityRecord: CapabilityDef = {
	title: 'Add an entry to the activity log',
	resolve: resolveApplicationTarget,
	authorize: ownsApplication,
	// Not a diff — there is no row yet. What the model needs instead is the
	// chronology it is about to add to, so it can tell "they told me something
	// new" from "they are referring to the interview already logged on Tuesday".
	current: async (target) => {
		const recent = await db.query.application_records.findMany({
			where: eq(application_records.application_id, target.id),
			columns: { id: true, record_type: true, title: true, event_date: true },
			orderBy: [desc(application_records.event_date), desc(application_records.date_created)],
			limit: RECENT_ENTRIES_SHOWN
		});
		return {
			recent_entries: recent.map(
				(r) => `${r.event_date ?? 'undated'} — ${getRecordTypeLabel(r.record_type)}: ${r.title}`
			)
		};
	},
	// Prefixed, because buildProposalSchema merges every live capability's fields
	// into one object for the provider and a collision would land one
	// capability's value in another's payload. `title` and `date_posted` are
	// already taken by the job.
	fields: {
		entry_content: 'string',
		entry_type: 'string',
		entry_title: 'string',
		entry_date: 'string'
	},
	contract: `The user sometimes tells you things about an application that are
nowhere in it yet — what a recruiter said on the phone, a number that came up, a
condition mentioned in passing. You may propose writing that down as an entry on
the activity log, which they review and apply.

This is how a fact reaches the rest of the application. An applied entry is
re-read by the summariser, so it updates "Where this stands", the details on the
overview page and the offer terms, all by itself. You do not need to — and
cannot — propose those separately.

Fields:
- "entry_content" is the entry itself and is REQUIRED — a proposal without it is
  discarded. Write what the user told you, in their terms, as a short factual
  note. Not your advice about it, not a summary of your own reply.
- "entry_type" is one of: ${recordTypeValues.join(', ')}. Pick "note" when the
  user is relaying something themselves, "message" or "feedback" when they are
  quoting the employer, "offer" only for actual offered terms.
- "entry_title" is a short scannable line naming what happened, well under 120
  characters ("Recruiter call — team and on-call"). Always give one. Omitting it
  is allowed but rarely right here: the fallback takes the content's first line,
  and an entry logged from a conversation is usually one short paragraph, so
  the fallback title comes out as the entry repeated back with an ellipsis. The
  derivation pass would rewrite it, except that it skips anything under 200
  characters — which is most of what this capability writes.
- "entry_date" is YYYY-MM-DD and means WHEN IT HAPPENED, not today. If they say
  "they called on Tuesday", resolve it and say in your reply which date you
  used, so a wrong guess is visible and correctable. Omit it for today.

When to propose one:
- They state a fact about this application that is not already in the chronology
  shown below.
- They confirm something you asked about.

When NOT to propose one:
- They are speculating, or thinking out loud, or asking what they should do.
  A possibility is not an event, and the log is for what happened.
- The fact is already in the chronology shown below.
- It is your own suggestion. You may write down what they told you; you may not
  write down what you told them.

One entry per thing that happened. Two unrelated facts in one message are two
proposals, not one entry with both in it — the user may want to keep one and
drop the other, and an entry is also the unit the chronology is read in.`,
	renderState: (current) => {
		const recent = (current.recent_entries as string[] | undefined) ?? [];
		return recent.length > 0
			? `Already logged, most recent first. Do not propose an entry that repeats one of these:\n\n${recent
					.map((line) => `  - ${line}`)
					.join('\n')}`
			: 'Nothing is logged on this application yet.';
	},
	validate: (fields) => {
		const content = fields.entry_content;
		if (typeof content !== 'string' || content.trim() === '') {
			return { ok: false, error: 'The entry has no content' };
		}
		const type = fields.entry_type;
		if (type !== undefined && type !== null && !recordTypeValues.includes(String(type))) {
			return { ok: false, error: `"${String(type)}" is not an entry type` };
		}
		const date = fields.entry_date;
		if (date !== undefined && date !== null && !/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
			return { ok: false, error: 'entry_date must be a YYYY-MM-DD date' };
		}
		return { ok: true };
	},
	apply: async (target, fields) => {
		// authorize() has already confirmed the row and its owner; this re-reads it
		// for the two values the insert needs and the proposal cannot carry.
		const app = await db.query.applications.findFirst({
			where: eq(applications.id, target.id),
			columns: { profile_id: true, status_step: true }
		});
		if (!app?.profile_id) throw new Error('Application has no profile');

		const content = String(fields.entry_content);
		const proposedTitle = typeof fields.entry_title === 'string' ? fields.entry_title.trim() : '';

		const [created] = await db
			.insert(application_records)
			.values({
				application_id: target.id,
				record_type: typeof fields.entry_type === 'string' ? fields.entry_type : 'note',
				title: proposedTitle ? clampRecordTitle(proposedTitle) : deriveRecordTitle(content),
				content,
				// The stage the application is in now, same as the composer: things are
				// logged as they happen, and this is free and right more often than a
				// guess would be.
				step: app.status_step,
				event_date: typeof fields.entry_date === 'string' ? fields.entry_date : today(),
				extraction_status: 'none',
				date_created: new Date()
			})
			.returning({ id: application_records.id });

		// The same two passes the composer runs, in the same order and for the same
		// reasons: derivation fills only what is still empty (here, essentially the
		// contacts — this proposal already carries a type and a title), and the
		// summariser runs after it so the digest reads the derived entry rather than
		// the write-time fallbacks. Both are best-effort by construction, so a
		// failure in either leaves the entry written and visible.
		await deriveRecordMetadata(created.id, app.profile_id);
		await summarizeApplication(target.id, app.profile_id);
	}
};

/**
 * The capability registry — the one place a write is taught to the assistant.
 * Add an entry here and every route scope that lists it can propose that edit.
 */
export const CAPABILITIES: Record<Capability, CapabilityDef> = {
	edit_job_details: editJobDetails,
	edit_job_description: editJobDescription,
	edit_job_skills: editJobSkills,
	edit_application_details: editApplicationDetails,
	add_activity_record: addActivityRecord,
	...PROFILE_CAPABILITIES
};

/** A capability that resolved and authorized for this turn. */
export interface LiveCapability {
	capability: Capability;
	/**
	 * The rows it may act on, every one already authorized.
	 *
	 * One on a page about a single row, which is the case the page bias exists
	 * to produce. Several on a list page, where the model names which by id.
	 */
	targets: CapabilityTarget[];
	/**
	 * The single target's current values, for the model to propose a diff
	 * against and the card to show one.
	 *
	 * Null when there are several. There is no one row to diff, and printing
	 * every row's values is precisely what the prompt budget cannot hold — the
	 * list shows labels, and the values are re-read for whichever row the model
	 * names.
	 */
	current: Record<string, unknown> | null;
}

/**
 * Narrow a scope's declared capabilities to the ones that actually apply right
 * now. A capability that can't resolve (no job attached) or won't authorize (a
 * scraped job, someone else's application) drops silently — the assistant is
 * simply never told it could do that, rather than offering an edit that fails.
 */
export async function resolveCapabilities(
	declared: Capability[],
	entity: ContextEntity | null,
	actor: CapabilityActor
): Promise<LiveCapability[]> {
	const live = await Promise.all(
		declared.map(async (capability): Promise<LiveCapability | null> => {
			const def = CAPABILITIES[capability];

			// The page's own row wins. Only a page that names none asks for a list,
			// which is what keeps "biased to the page" true rather than aspirational.
			const target = await def.resolve(entity, actor);
			if (target) {
				if (!(await def.authorize(target, actor))) return null;
				return { capability, targets: [target], current: await def.current(target, actor) };
			}

			if (!def.resolveMany) return null;

			const candidates = await def.resolveMany(entity, actor);
			const authorized = (
				await Promise.all(
					candidates.map(async (row) => ((await def.authorize(row, actor)) ? row : null))
				)
			).filter((row): row is CapabilityTarget => row !== null);
			if (authorized.length === 0) return null;

			// One authorized row is the single-row case however it was reached, so
			// it gets the values to diff against rather than a list of one.
			if (authorized.length === 1) {
				return {
					capability,
					targets: authorized,
					current: await def.current(authorized[0], actor)
				};
			}

			return { capability, targets: authorized, current: null };
		})
	);
	return live.filter((c): c is LiveCapability => c !== null);
}

/**
 * Keep only the keys that belong to this capability, coerced to real types.
 *
 * Two things at once because they are the same chokepoint — every path from a
 * model's output to a write goes through here, on the way in *and* again at
 * apply time:
 *
 *  - buildProposalSchema merges the live capabilities' fields into one object
 *    for the provider's benefit, so a model can put a job field in an
 *    application proposal and have it validate. This is where that is dropped.
 *  - the wire types are deliberately loose (see WIRE_TYPES), so "55,000" and a
 *    bare "remote" are turned into 55000 and ["remote"] here rather than
 *    reaching a column.
 */
export function pickCapabilityFields(
	capability: Capability,
	fields: Record<string, unknown>
): Record<string, unknown> {
	const kinds = CAPABILITIES[capability].fields;
	return Object.fromEntries(
		Object.entries(fields)
			.filter(([key]) => key in kinds)
			.map(([key, value]) => [key, coerceValue(kinds[key], value)])
	);
}

/**
 * One capability's fields as a single object schema — the shape a TOOL has.
 *
 * Distinct from `buildProposalSchema`, which flattens every live capability into
 * one change-list for a single structured-output turn. That shape suits the chat
 * and nothing else: it exists because the assistant answers and proposes in the
 * same breath, and because models under-fill wide optional objects. A caller
 * that already knows which capability it wants and is not also writing a reply —
 * a LangChain tool binding, an MCP server exposing one tool per capability —
 * wants this instead.
 *
 * zod rather than JSON Schema because `bindTools` and `DynamicStructuredTool`
 * take zod directly, and because a JSON Schema is one `zodToJsonSchema` away
 * while the reverse is not. Built from the same `fields` map as the prompt, the
 * coercion and the proposal card, so a capability cannot grow a field that only
 * some of its surfaces know about.
 */
export function capabilityFieldSchema(capability: Capability) {
	return z.object(
		Object.fromEntries(
			Object.entries(CAPABILITIES[capability].fields).map(([name, kind]) => [
				name,
				WIRE_TYPES[kind]
			])
		)
	);
}

/** Why a write was refused, for a caller to map onto its own error shape. */
export type CapabilityRefusal = 'unauthorized' | 'empty' | 'invalid';

export type CapabilityOutcome =
	/**
	 * `previous` is what the written fields held immediately before, read inside
	 * the same call rather than by the caller beforehand — a caller reading it
	 * first would record a before-image from before its own authorize/validate
	 * round trip, which is exactly the window in which it can go stale.
	 *
	 * Only the fields being written appear in it, so it pairs one-for-one with
	 * what was proposed and can be replayed as an undo.
	 */
	| { ok: true; previous: Record<string, unknown> }
	| { ok: false; reason: CapabilityRefusal; error: string };

/**
 * Authorize, re-read, coerce, validate, write — the whole of a capability's
 * write path, with nothing HTTP in it.
 *
 * Extracted so the proposal endpoint is not the only way to reach `apply`. It is
 * the only *caller* today; it should not also be the only place the order of
 * these five steps is written down. An MCP server exposing capabilities as tools
 * resolves a target through `CAPABILITIES[c].resolve` and then calls this, and
 * gets re-authorization and re-validation because they are here rather than in a
 * route it does not share.
 *
 * Everything is re-derived from the database on the way through. Whatever the
 * caller holds — a stored proposal, a tool call, a form post — came from a model
 * or a client and is treated as a request, not as fact. In particular
 * `authorize` runs again here even when the caller has already asked: a proposal
 * can sit in a resumable thread for twelve hours, and rights are lost inside
 * that window, not only outside it.
 */
export async function executeCapability(
	capability: Capability,
	target: CapabilityTarget,
	actor: CapabilityActor,
	rawFields: Record<string, unknown>
): Promise<CapabilityOutcome> {
	const def = CAPABILITIES[capability];

	if (!(await def.authorize(target, actor))) {
		return {
			ok: false,
			reason: 'unauthorized',
			error: 'You can no longer make this change.'
		};
	}

	// Current values re-read now, not as they were when this was proposed: a
	// partial edit is merged over whatever is there, and merging stale values
	// around the changed field would quietly revert anything that happened since.
	const current = await def.current(target, actor);
	const fields = pickCapabilityFields(capability, rawFields);
	// A verb whose whole content is *which row* legitimately carries no fields —
	// hiding an entry says everything it has to say by naming one. The refusal
	// is for a capability that asked for values and got none, which is a model
	// that produced nothing while its reply promised otherwise.
	if (Object.keys(def.fields).length > 0 && Object.keys(fields).length === 0) {
		return { ok: false, reason: 'empty', error: 'Nothing to change.' };
	}

	const valid = def.validate(fields, current);
	if (!valid.ok) return { ok: false, reason: 'invalid', error: valid.error };

	// Narrowed to the fields actually being written, before apply() runs. A
	// capability with no prior row for a field (add_activity_record has none at
	// all) simply contributes nothing here, which reads correctly as "there was
	// nothing there".
	const previous = Object.fromEntries(
		Object.keys(fields)
			.filter((key) => key in current)
			.map((key) => [key, current[key]])
	);

	await def.apply(target, fields, current, actor);
	return { ok: true, previous };
}

/** Every field name the live capabilities can address, for the `field` enum. */
function fieldNamesFor(capabilities: Capability[]): string[] {
	return capabilities.flatMap((c) => Object.keys(CAPABILITIES[c].fields));
}

/**
 * The structured reply schema for a turn, built from the live capabilities.
 *
 * Lists at both levels, and neither is a stylistic choice.
 *
 * The edits are a LIST of {field, value} pairs, not an object with one optional
 * key per field. The object shape was measured against the real writing model
 * and it under-fills: asked to correct a work arrangement and a salary range in
 * one message, three consecutive runs proposed `{work_location}`,
 * `{salary_min, salary_period, work_location}` and `{work_location}`. It said
 * in its reply that it was changing the salary each time, and then didn't.
 * Selectively populating thirteen optional keys is a shape these models are bad
 * at; enumerating what you changed is one they are good at, and it makes the
 * count visible in the output rather than implied by absence.
 *
 * The proposals are a LIST too, one per capability, because a single message
 * routinely asks for two kinds of change — fix the salary AND rewrite the
 * description. One-per-turn made the user ask twice for that. Each entry
 * becomes its own card with its own Apply button, so bundling them costs the
 * user nothing: they can still take one and leave the other, which a merged
 * capability would not allow.
 *
 * The obvious worry was that this reintroduces the under-fill above one level
 * up. Measured before it was built, same request, three runs: the model
 * returned two complete proposals every time. Selectively populating optional
 * keys is the failure mode, not nesting.
 *
 * `field` is an enum of the live capabilities' names, so the provider is
 * constrained at generation time rather than corrected afterwards.
 */
export function buildProposalSchema(capabilities: Capability[]) {
	const names = fieldNamesFor(capabilities);

	return z.object({
		reply: z.string().describe('The message shown to the user.'),
		proposals: z
			.array(
				z.object({
					capability: z.enum(capabilities as [Capability, ...Capability[]]),
					target_id: z
						.number()
						.nullish()
						.describe(
							'Which row, when the capability lists more than one. Copy the ' +
								'target_id exactly as shown; omit it when only one row is listed.'
						),
					rationale: z
						.string()
						.describe(
							'What you are changing and why, in proportion to the change: one ' +
								'sentence for a field correction, a short paragraph when you have ' +
								'replaced a long text. Cover every entry in `changes`.'
						),
					changes: z
						.array(
							z.object({
								field: z.enum(names as [string, ...string[]]),
								// Loose on purpose: the wire schema has to survive conversion to JSON
								// Schema, so it cannot coerce. coerceValue does that afterwards.
								value: z
									.union([z.string(), z.number(), z.array(z.string())])
									.nullable()
									.describe('The new value. null clears the field.')
							})
						)
						.describe('Every field being changed. One entry per field.')
				})
			)
			.nullish()
			.describe('One entry per kind of change. Omit or leave empty when proposing nothing.')
	});
}

/**
 * Fold the model's change list into the field object the rest of the system
 * deals in, dropping names outside the capability and coercing as it goes.
 *
 * A later entry for the same field wins, which is the only sane reading of a
 * model that listed one twice.
 */
export function fieldsFromChanges(
	capability: Capability,
	changes: { field: string; value: unknown }[]
): Record<string, unknown> {
	return pickCapabilityFields(
		capability,
		Object.fromEntries(changes.map((c) => [c.field, c.value]))
	);
}

/** One field of a proposal, paired with what it replaces. */
export interface ProposedChange {
	field: string;
	label: string;
	from: string;
	to: string;
}

const FIELD_LABELS: Record<string, string> = {
	job_poster: 'Posted by',
	office_location: 'Location',
	source_url: 'Job URL',
	date_posted: 'Date posted',
	work_location: 'Work arrangement',
	job_types: 'Employment type',
	experience_levels: 'Experience level',
	job_description: 'Description',
	skills_required: 'Required skills',
	skills_preferred: 'Preferred skills',
	cv_sent_through: 'Sent through',
	application_sent_date: 'Sent on',
	application_seen_date: 'Seen on',
	entry_content: 'Entry',
	entry_type: 'Kind',
	entry_title: 'Title',
	entry_date: 'Happened on',
	// The profile sections. Their wire names carry the section as a prefix, which
	// the card drops — it already names the row above these, so repeating "Work
	// experience" on every line says nothing.
	start_date: 'From',
	end_date: 'Until',
	graduation_year: 'Graduated',
	study_type: 'Qualification',
	repo_url: 'Repository',
	stars: 'GitHub stars',
	language_code: 'Language code',
	author_position: 'Their role',
	institution: 'School'
};

function labelFor(field: string): string {
	// `work_experience.summary` labels as "Summary": the section is context the
	// card gets from the row it names, not part of the field's name to a reader.
	const column = field.slice(field.indexOf('.') + 1);
	return FIELD_LABELS[column] ?? column.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
}

function renderValue(value: unknown): string {
	if (value === null || value === undefined || value === '') return '—';
	if (Array.isArray(value)) return value.join(', ');
	return String(value);
}

/**
 * Pair each proposed field with its current value, for the card.
 *
 * Fields whose proposed value matches what's already there are dropped: models
 * restate unchanged values despite being told not to, and a "change" that
 * changes nothing is noise the user has to read past to find the real one.
 */
export function describeProposalChanges(
	capability: Capability,
	fields: Record<string, unknown>,
	current: Record<string, unknown>
): ProposedChange[] {
	return Object.keys(CAPABILITIES[capability].fields)
		.filter((field) => field in fields)
		.map((field) => ({
			field,
			label: labelFor(field),
			from: renderValue(current[field]),
			to: renderValue(fields[field])
		}))
		.filter((change) => change.from !== change.to);
}

/**
 * One capability's section of the prompt: what it is, what its fields mean, and
 * what they hold right now.
 *
 * Composed here rather than by each capability so the three parts stay
 * separable. The header and the state are the target-dependent halves; the
 * contract is not, and a surface with no page behind it — an MCP `list_tools`
 * response, a tool description — takes `contract` on its own and never calls
 * this at all.
 */
export function renderCapabilityBlock(
	capability: Capability,
	targets: CapabilityTarget[],
	current: Record<string, unknown> | null
): string {
	const def = CAPABILITIES[capability];

	// One row: name it in the heading and show its values, which is what a diff
	// needs and what every capability did before lists existed.
	if (targets.length === 1 && current) {
		const state = (def.renderState ?? renderCurrent)(current);
		return `### Capability: ${capability} — ${targets[0].label}

${def.contract}

${state}`;
	}

	// Several: labels and ids, no values. The model picks one by id, and its
	// current values are re-read for whichever it picks — printing all of them
	// is what the budget cannot hold, and is also what would let a model diff
	// against the wrong row without noticing.
	const rows = targets.map((t) => `  - target_id ${t.id}: ${t.label}`).join('\n');

	return `### Capability: ${capability}

${def.contract}

Rows you can change with this. Name exactly one, as "target_id", in the same
proposal — and only one of these, since these are the only ones you can reach:

${rows}`;
}

/**
 * Said only where it can apply.
 *
 * A page about one row cannot use this rule, and every live capability's block
 * ships on every capable turn — so stating it unconditionally would spend the
 * budget on all of them to serve the few. Measured: it is ~450 characters, and
 * add_activity_record's block was already within 20 of the per-capability
 * ceiling.
 */
const TARGET_ID_RULE = `

Some capabilities below list several rows you could change — languages, say,
rather than one language. For those, add "target_id" to the proposal, copied
exactly from the list. Name one row per proposal; to change two rows, return two
proposals. A target_id that is not in the list is not a row you can reach, and
the proposal is discarded rather than applied to something else.`;

/** The capability block spliced into the system prompt, or "" when none are live. */
export function renderCapabilityPrompt(live: LiveCapability[]): string {
	if (live.length === 0) return '';

	const blocks = live.map((c) => renderCapabilityBlock(c.capability, c.targets, c.current));
	const choosing = live.some((c) => c.targets.length > 1);

	return `## Changes you can propose

The user is on a page where you can propose edits, which they then review and
apply themselves. You never change anything directly — proposing is the whole of
your power here, and a proposal the user does not apply changes nothing.

Answer with a JSON object with these keys:
- "reply": your message to the user, as you would normally write it. Always
  present, and it must read as a complete answer on its own.
- "proposals": a LIST of the changes you are proposing. Omit it, or leave it
  empty, when you are proposing nothing.

Each entry in "proposals" is one KIND of change, with "capability" (one of the
ids below), "rationale", and "changes".${choosing ? TARGET_ID_RULE : ''}

"rationale" is what the user reads to decide. Write what you are changing and
why, IN PROPORTION to the change — one sentence is right for a field
correction, and a short paragraph is right when you have replaced a long text,
because all they otherwise see of a rewrite is a character count and a few
excerpts to reconstruct your intent from.

Cover every entry in your "changes" list. Fields that belong together are one
idea and should read as one — a minimum and a maximum are a salary range, not
two separate edits — but an entry you never mention is a change the user is
asked to accept without being told about it.

Say what changed, not that something did. "Updated the description" tells them
nothing they can't see; "cut the required experience from 10 years to 3 and
replaced the unstated salary with the range you were given" is the thing they
are actually deciding about.

"changes" is a LIST, one entry per field you are changing, each
{"field": "...", "value": ...}. Fields you don't list keep their current value;
an entry with "value": null clears that field.

Before you write "changes", re-read the user's message and count the distinct
things they asked you to correct. Your list must have an entry for every one of
them. If your reply says you are changing the salary and the location, then
"changes" has an entry for the salary AND an entry for the location — a reply
that promises more than the list delivers leaves half the correction unmade, and
the user has to ask twice.

If the user asks for two different kinds of change in one message — a correction
to the structured fields AND a rewrite of the description, say — return TWO
entries in "proposals", one per capability. Do not do one and describe the other
in prose. Each entry becomes a separate card the user accepts or rejects on its
own, so there is no cost to listing both, and no reason to make them ask twice.

Count the kinds of change the same way you counted the fields: "proposals" has
exactly as many entries as there are kinds you were asked for.

These hold for every kind of change below:

- List only the fields you are changing. Don't restate a field whose value is
  already correct — an entry that changes nothing is noise the user reads past.
- Only propose a change the user actually asked for, or one they have clearly
  confirmed, never as an unrequested tidy-up. If they are asking a question
  rather than requesting an edit, answer it and propose nothing.
- Change what you were asked to change and nothing adjacent to it. If a
  correction seems to imply a second one, say so in your reply and let the user
  decide, rather than folding it into the same proposal.

${blocks.join('\n\n')}`;
}
