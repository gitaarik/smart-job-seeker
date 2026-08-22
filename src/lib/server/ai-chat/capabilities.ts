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
import { rowsNamedInMessage } from './profile-matching';
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
import {
	actionsByPhase,
	getStatusLabel,
	isFinishedStatus,
	stepsByPhase
} from '$lib/application-status';
import {
	actionsFor,
	applicationStatusError,
	revertApplicationStatus,
	settableStatuses,
	stepsFor,
	writeApplicationStatus
} from '$lib/server/applications/status';
import type { EditSource } from './edit-log';
import type { TierDecision } from '$lib/server/mcp/tiers';
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
	| 'update_application_status'
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
	/**
	 * The row's own name, when its label carries context as well.
	 *
	 * Only used to decide whether a message named this row (see `fitTargets`),
	 * and only a skill has one: its label is "Python — Backend (Python /
	 * Django)", where everything after the dash belongs to the group. Matching on
	 * the whole of that makes every skill in the group answer to the words in its
	 * group's note — measured, once the note went into the label: asking about
	 * Python matched all 33 rows of Backend, which is not narrowing at all.
	 */
	match?: string;
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
	current(
		target: CapabilityTarget,
		actor: CapabilityActor,
		/**
		 * The row the page is about, where there is one and the caller knows it.
		 *
		 * Only `resolveCapabilities` passes it, and only a child collection reads
		 * it: what a role's page has to say about its projects is *its* projects,
		 * not every project on the profile. The apply paths deliberately do not
		 * pass it — a proposal is applied from a card, long after any page, and
		 * the wider list is both the honest answer there and the permissive one.
		 */
		entity?: ContextEntity | null
	): Promise<Record<string, unknown>>;
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
	/**
	 * Whether a field may be dropped on its way to `apply` because its value
	 * already matches the row.
	 *
	 * Absent for everything that patches columns independently, which is the
	 * common case and the reason MCP narrows a call to what it actually changes:
	 * re-stating a value writes nothing, and an approval card that says nothing
	 * is worse than no card.
	 *
	 * Set where the fields are ONE state rather than a patch, so that dropping
	 * one changes the meaning of the others. `update_application_status` clears
	 * the stage when the status moves and no stage was sent — so a stage that was
	 * sent and happened to equal the current one, narrowed away as "unchanged",
	 * came out the far end as a clear the agent never asked for and the card
	 * never showed. The two labels that make it reachable are real: "Awaiting
	 * response" belongs to both applying and negotiating, "Provide references" to
	 * both interviewing and negotiating.
	 *
	 * Only the MCP path narrows. A chat proposal already stores every field it
	 * was given, and drops the unchanged ones from the CARD rather than from the
	 * write.
	 */
	writesOneState?: boolean;
	/**
	 * How much friction one write of this capability earns, where the generic
	 * grading gets it wrong. Return null to fall through to it.
	 *
	 * `tierForWrite` grades a call by what it replaces: filling a blank is
	 * additive, writing over a value someone chose is not. That is the right
	 * question for a column holding prose, and the wrong one for a column holding
	 * a *state*. `applications.status` is notNull with a default, so it is never
	 * blank and every move through the pipeline scored as an overwrite — which
	 * put "they invited me to a second interview" behind the same approval as
	 * rewriting a summary. The generic rule was not wrong about the mechanics; it
	 * had no way to know that one of those is undone with a click and visible the
	 * moment it happens, and the other is not.
	 *
	 * Only MCP asks. The chat proposes everything regardless of what this says.
	 *
	 * The burst ceiling is checked BEFORE this and cannot be overridden — a
	 * capability may say its own write is cheap; it may not say that the
	 * twenty-first one in an hour still is.
	 */
	tierFor?(fields: Record<string, unknown>, current: Record<string, unknown>): TierDecision | null;
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
	 *
	 * ## An add returns the row it made
	 *
	 * Everything else returns nothing, and the `target` it was called with is
	 * both what it wrote to and what the history names. An `add_*` has no row
	 * when it starts — its target is the profile, or the application the entry
	 * is filed under — so without this the created row has no id anywhere: the
	 * log named "their role projects", and nothing downstream could say which
	 * entry an accepted proposal had produced.
	 *
	 * That is not a cosmetic gap. `write.ts` logs a person's add against the row
	 * it created, so the same action recorded through a proposal and through the
	 * form disagreed about what it had touched — against a module whose premise
	 * is that the two are the same write. And a thread cannot tell the model
	 * "that one exists now, edit it rather than adding it again" without an id
	 * to point at, which is the duplicate this and `checkDuplicate` were added
	 * together to stop.
	 */
	apply(
		target: CapabilityTarget,
		fields: Record<string, unknown>,
		current: Record<string, unknown>,
		actor: CapabilityActor
	): Promise<CapabilityTarget | void>;
	/**
	 * What an undo of this write would need to know, when that isn't "the old
	 * values of the fields being written".
	 *
	 * `executeCapability` records the fields it is about to overwrite, which is
	 * the right before-image for every capability that patches columns. It is the
	 * wrong one for a write whose content is not a field patch: `hide_*` carries
	 * no fields at all — naming the row is the whole proposal — so the default
	 * narrows to `{}` and there is nothing to put back.
	 *
	 * Declared here rather than special-cased in `executeCapability` because the
	 * question is the capability's own: only it knows what its write disturbed.
	 */
	beforeImage?(
		target: CapabilityTarget,
		current: Record<string, unknown>,
		actor: CapabilityActor
	): Promise<Record<string, unknown>>;
	/**
	 * Put back what this capability's write replaced, from the log's before-image.
	 *
	 * Optional, and its absence is a real answer rather than a gap. Undo exists
	 * for writes **nothing else can reverse** — a rewritten summary is gone, and
	 * only the before-image has it. An `add_*` is not that: the row is sitting on
	 * its own page with a delete button, and giving the registry a delete is the
	 * one thing the whole hide-not-delete design refused. So adds have no revert,
	 * and the feed says where to go instead.
	 *
	 * Whatever this writes goes through the same ownership check as any other
	 * write — a log row is a record, not a licence.
	 */
	revert?(
		target: CapabilityTarget,
		previous: Record<string, unknown>,
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
 * What a job and an application are called, wherever one is named.
 *
 * Exported because MCP resolves the same two rows a different way — by an id
 * the agent supplies, against the profile's own scope — and a target's label is
 * shown to the applicant on the approval card. Two spellings of the same row
 * would read as two different rows on the one surface where it matters that
 * they do not.
 */
export function jobLabel(job: { title: string | null; company: string | null }): string {
	return [job.title ?? 'Untitled job', job.company].filter(Boolean).join(' at ');
}

export function applicationLabel(
	job: { title: string | null; company: string | null } | null | undefined
): string {
	return [job?.title ?? 'Application', job?.company].filter(Boolean).join(' at ');
}

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

	return { id: job.id, label: jobLabel(job) };
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
	},

	/**
	 * Put the replaced values back, through the same authoritative write.
	 *
	 * Merged over a fresh read for exactly the reason `apply` is: the before-image
	 * holds only the fields that changed, and applyJobFields writes all thirteen.
	 * Passing it through alone would undo one correction by clearing twelve
	 * columns nobody touched.
	 *
	 * Ownership is not re-checked here because `revertEdit` has already asked
	 * this capability's own `authorize` — `canEditJob`, against a fresh read. A
	 * job that stopped being this profile's to edit cannot be reverted either,
	 * which is the same answer as for any other write.
	 */
	revert: async (target, previous) => {
		// An empty before-image is a log row this capability cannot read, not a
		// change with nothing in it. Writing the current values back over
		// themselves would report a successful undo and undo nothing.
		if (Object.keys(previous).length === 0) {
			throw new Error('edit_job_details recorded no fields this can put back');
		}
		const merged = { ...(await currentJobFields(target)), ...previous };
		await applyJobFields(target.id, {
			...(merged as unknown as JobFieldValues),
			title: typeof merged.title === 'string' ? merged.title : ''
		});
	}
};

/* ------------------------------------------------------------------ *
 * edit_job_description
 * ------------------------------------------------------------------ */

/**
 * How much of the two long texts the capability block will carry inline before
 * it gives up and points at the job section instead. See `renderState`.
 *
 * 8,000 because the page's own capabilities are never dropped and so have to
 * fit on their own merits: an application page's five measure 11,390, and
 * 19,390 leaves the 22,000 budget a margin rather than spending it. A posting
 * longer than this is rare — the longest on dev is 4,069 — and the fallback is
 * exactly what every turn did before.
 */
const INLINE_TEXT_CHARS = 8000;

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
fragment or a diff. Change one or both in the same proposal. Light markdown
renders on the page — bold, lists, headings — so use it where the posting has
structure, and keep the shape of a posting rather than of a report.

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
material you have been given. Reordering, re-heading and fixing the wording are
in scope; condensing is not. Every fact the old text carried is in the new one
unless the user asked you to take it out.

When they give you MORE material about the same job — a second posting, what a
recruiter told them — what you send back is the union of the two, not a digest
of them. The character count below is a floor: a merged posting is longer than
the one it replaces. Where the two sources disagree, keep the specific reading,
and say in your reply which one you took and what the other said.

The structured fields — skills, salary, location — were extracted from the OLD
text, so anything your rewrite changes is now stale in them. Correct the ones
you have a capability for, in the same answer; check each one against the new
text rather than only the ones that caught your eye. For the ones you do not
have, say so in your reply: they stay wrong until the job is re-parsed, and the
user is the only one who can decide to do that.`,
	// The texts themselves, next to the instruction that rewrites them — and yes,
	// a second time, because the `job` context source already carries them.
	//
	// This used to be the lengths and a pointer at that block, on the reasoning
	// that paying twice for the same characters is waste. It is waste, and it was
	// still the wrong trade: on a job page the pointer is ~55,000 characters away
	// from the capability, and a model asked to re-emit 4,000 characters it read
	// that long ago reconstructs them instead of copying them. Measured over
	// eleven replays of one real turn — merge a stored posting with a second one
	// pasted into the chat — the pointer form kept the pasted material's facts in
	// 2 of 7 runs and this form in 6 of 7, and only this form ever produced the
	// salary correction the new posting implied.
	//
	// It does not make the rewrite lossless; nothing here does (see
	// ProposalCard's `dropped`, which exists because of that). It moves the
	// median.
	//
	// Above the cap it falls back to the pointer. That is the honest failure: a
	// 10,000-character posting inlined beside an application page's five
	// capabilities is most of `CAPABILITY_PROMPT_BUDGET_CHARS`, and the block
	// that would give way to it is a section the user asked about.
	renderState: (current) => {
		const job = String(current.job_description ?? '');
		const company = String(current.company_description ?? '');
		const lengths = `${job.length} characters of job_description and ${company.length} of company_description`;

		if (job.length + company.length > INLINE_TEXT_CHARS) {
			return `Both are shown in full in the job section above — currently ${lengths}.`;
		}

		return `The two texts as they stand — ${lengths}. Build your replacement from
THESE characters. They are the same ones in the job section above; work from the
copy here, because it is the one you are editing.

--- job_description ---
${job || '(not set)'}
--- end job_description ---

--- company_description ---
${company || '(not set)'}
--- end company_description ---`;
	},
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
	},

	/**
	 * The undo this capability exists to have.
	 *
	 * A rewritten posting is the one change on a job that nothing else can put
	 * back: the old text is gone from the row and lives only in the before-image.
	 * Same partial semantics as `apply` — restore the text that was replaced and
	 * leave the other alone.
	 */
	revert: async (target, previous) => {
		const texts = {
			...('job_description' in previous
				? { job_description: previous.job_description as string | null }
				: {}),
			...('company_description' in previous
				? { company_description: previous.company_description as string | null }
				: {})
		};
		if (Object.keys(texts).length === 0) {
			throw new Error('edit_job_description recorded no text this can put back');
		}
		await applyJobTexts(target.id, texts);
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
	},

	/**
	 * Put the replaced list back — and with it the match score, since writing
	 * these columns is what re-scores the job.
	 */
	revert: async (target, previous) => {
		const lists = {
			...('skills_required' in previous
				? { skills_required: previous.skills_required as string[] | null }
				: {}),
			...('skills_preferred' in previous
				? { skills_preferred: previous.skills_preferred as string[] | null }
				: {})
		};
		if (Object.keys(lists).length === 0) {
			throw new Error('edit_job_skills recorded no list this can put back');
		}
		await applyJobSkills(target.id, lists);
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
	return { id: app.id, label: applicationLabel(app.job) };
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
 * The one write for an application's three sent-through fields, so the edit and
 * its undo cannot disagree about what "unchanged" means.
 *
 * Authoritative for all three columns, which is why both callers merge over a
 * current read before getting here. Scoped by profile as well as by id: the
 * caller has authorized already, and a write that carries its own scope cannot
 * be reached by a caller that forgot to.
 */
async function writeApplicationDetails(
	applicationId: number,
	profileId: number,
	values: Record<string, unknown>
): Promise<void> {
	await db
		.update(applications)
		.set({
			cv_sent_through: (values.cv_sent_through as string | null) ?? null,
			application_sent_date: (values.application_sent_date as string | null) ?? null,
			application_seen_date: (values.application_seen_date as string | null) ?? null,
			date_updated: new Date()
		})
		.where(and(eq(applications.id, applicationId), eq(applications.profile_id, profileId)));
}

/**
 * Deliberately the three fields the page's own `?/updateDetails` action covers.
 * Status is not one of them: it writes an `application_status_log` row and
 * drives the pipeline view, so it has its own capability with its own contract
 * rather than riding along in a details edit — see `update_application_status`.
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
	apply: async (target, fields, current, actor) => {
		await writeApplicationDetails(target.id, actor.profileId, { ...current, ...fields });
	},

	/**
	 * Put the replaced values back.
	 *
	 * Merged over a fresh read, like the write it undoes: all three columns are
	 * written together, so a before-image of one would clear the other two.
	 */
	revert: async (target, previous, actor) => {
		if (Object.keys(previous).length === 0) {
			throw new Error('edit_application_details recorded no fields this can put back');
		}
		const current = await editApplicationDetails.current(target, actor);
		await writeApplicationDetails(target.id, actor.profileId, { ...current, ...previous });
	}
};

/* ------------------------------------------------------------------ *
 * update_application_status
 * ------------------------------------------------------------------ */

/**
 * The vocabulary, rendered from the same tables the editor's dropdowns use.
 *
 * Written out rather than described, because "pick a sensible stage" produces a
 * new label every time and the pipeline groups on this column — one invented
 * stage is a stage of one. Built from `stepsByPhase` and `actionsByPhase` so
 * that the list a model is held to and the list a person is offered cannot
 * drift apart.
 */
const STATUS_VOCABULARY = `Stages, by status:
${Object.entries(stepsByPhase)
	.map(([status, steps]) => `  ${status}: ${steps.join(', ')}`)
	.join('\n')}

Next actions, by status:
${Object.entries(actionsByPhase)
	.map(([status, actions]) => `  ${status}: ${actions.join(', ')}`)
	.join('\n')}`;

/** The four columns this capability writes, as `current` reports them. */
interface StatusFields {
	status: string;
	status_step: string | null;
	status_action: string | null;
	status_action_date: string | null;
}

/** The three that hang off the status and are cleared with it. */
type StatusStageField = 'status_step' | 'status_action' | 'status_action_date';

const STAGE_FIELDS: StatusStageField[] = ['status_step', 'status_action', 'status_action_date'];

function statusFieldsOf(values: Record<string, unknown>): StatusFields {
	return {
		status: String(values.status ?? ''),
		status_step: (values.status_step as string | null) ?? null,
		status_action: (values.status_action as string | null) ?? null,
		status_action_date: (values.status_action_date as string | null) ?? null
	};
}

/**
 * What the application will say once this proposal is applied.
 *
 * The rule that makes it more than a merge: **a stage belongs to the status it
 * was reached in.** Moving to "rejected" while keeping "Offer received" under
 * it describes an application nobody has, so an unproposed stage and next
 * action are dropped whenever the status itself moves, and always for a status
 * that has no stages at all. The editor does the same — its phase buttons clear
 * both.
 *
 * Shared by `validate` and `apply`, so the combination that is checked is the
 * one that gets written. Deriving it twice is how a capability comes to refuse
 * something it would have written differently anyway.
 */
function nextStatusFields(
	fields: Record<string, unknown>,
	current: Record<string, unknown>
): StatusFields {
	const before = statusFieldsOf(current);
	const status = 'status' in fields ? String(fields.status ?? '') : before.status;
	const moved = status !== before.status;

	const carry = (field: StatusStageField): string | null => {
		// Null for a finished application whatever was proposed. `validate`
		// refuses a stage sent with one, so this only ever drops a stale one.
		if (isFinishedStatus(status)) return null;
		if (field in fields) return (fields[field] as string | null) ?? null;
		return moved ? null : before[field];
	};

	return {
		status,
		status_step: carry('status_step'),
		status_action: carry('status_action'),
		status_action_date: carry('status_action_date')
	};
}

/** One line on the timeline beside the move, not an account of what happened. */
const MAX_STATUS_NOTE = 300;

/**
 * Move the application through the pipeline, and record the move.
 *
 * ## Why this is not part of `edit_application_details`
 *
 * That one patches three columns nobody reads but the details card. This writes
 * the column every list filters on, the board groups by and the comparison
 * spine sorts by — and it appends to `application_status_log`, which the
 * activity tab reads as a chronology of what happened. Two writes with the same
 * shape and nothing else in common: one is a correction, the other is an
 * assertion that the world moved.
 *
 * ## Which moves need a person, and which do not
 *
 * `tierForWrite` would grade every one of them Tier 2, because `status` is
 * `notNull` with a default and so is never blank. That is the overwrite rule
 * doing its job on a column it was not written for: a status is a state, not
 * authored content, and moving one is undone with a click and visible the
 * moment it happens — which is precisely what Tier 1 says its protection is.
 *
 * So `tierFor` splits it. A move that leaves the application live —
 * applying → interviewing → negotiating, or back again — is Tier 1: written
 * directly on a `write` key, logged, notified, undoable. The three statuses
 * that FINISH it are not, because they take it off the board the applicant
 * works from and each one is a claim about a decision somebody else made.
 * "You were rejected" is worth a person reading before it lands; "they booked
 * a second interview" is worth a notification.
 */
const updateApplicationStatus: CapabilityDef = {
	title: "Update the application's status",
	resolve: resolveApplicationTarget,
	authorize: ownsApplication,
	current: async (target) => {
		const app = await db.query.applications.findFirst({
			where: eq(applications.id, target.id),
			columns: {
				status: true,
				status_step: true,
				status_action: true,
				status_action_date: true
			}
		});
		return {
			status: app?.status ?? null,
			status_step: app?.status_step ?? null,
			status_action: app?.status_action ?? null,
			status_action_date: app?.status_action_date ?? null
		};
	},
	fields: {
		status: 'string',
		status_step: 'string',
		status_action: 'string',
		status_action_date: 'string',
		status_note: 'string'
	},
	// The stage is cleared by a status move that does not name one, so a stage
	// that WAS named must reach `apply` even when it matches the row.
	writesOneState: true,
	tierFor: (fields, current) => {
		const next = nextStatusFields(fields, current);
		return isFinishedStatus(next.status)
			? {
					tier: 2,
					reason:
						`Marking an application "${getStatusLabel(next.status)}" closes it and takes ` +
						`it off their active list.`
				}
			: {
					tier: 1,
					reason: 'Moving an application through the pipeline is undone with one click.'
				};
	},
	contract: `Where this application stands. It is what moves it between the user's
lists, so propose it when they say something HAPPENED — not when they say what
they are hoping for or about to do.

- "status" is exactly one of: ${settableStatuses.join(', ')}.
  "rejected" is the employer saying no; "withdrawn" is the applicant stopping.
  Never guess between those two — ask which it was.
- "status_step" is the stage within that status, and must be one of the labels
  listed for it below. accepted, rejected and withdrawn have no stages; a step
  sent with one of them is refused.
- "status_action" is what has to happen NEXT, from the same lists.
- "status_action_date" is YYYY-MM-DD, and is when that next thing is due or
  booked. Not the date of what already happened — that belongs on an activity
  entry.
- "status_note" is at most one short line saying why it moved, shown on the
  timeline beside it ("recruiter called after the technical"). It goes WITH a
  move — on its own, with nothing else changing, it is refused. Anything longer
  than a line is an activity entry instead.

Changing the status clears the stage and the next action unless you send new
ones with it, because a stage belongs to the status it was reached in. A move to
"interviewing" that names no stage leaves it blank, which is honest; naming one
you were not told about is not.

${STATUS_VOCABULARY}

If they describe a stage that is not in these lists, use the closest one and say
in your reply which you picked. Do not invent a label — the pipeline groups on
these, and a new one makes a group of one.`,
	validate: (fields, current) => {
		const next = nextStatusFields(fields, current);

		if ('status' in fields) {
			const problem = applicationStatusError(next.status);
			if (problem) return { ok: false, error: problem };
		}

		if (isFinishedStatus(next.status)) {
			const sent = STAGE_FIELDS.find((field) => fields[field]);
			if (sent) {
				return {
					ok: false,
					error:
						`"${next.status}" finishes the application, so it has no stage or next ` +
						`action. Leave ${sent} out, or send it as null.`
				};
			}
		}

		// Only what this proposal SENT is checked against the vocabulary. A stage
		// carried over from the row may be one the applicant typed themselves —
		// the editor offers "Custom…" — and refusing a proposal about the next
		// action because of a label nobody proposed would make this capability
		// stricter than the form it mirrors.
		const steps = stepsFor(next.status);
		if (fields.status_step && !steps.includes(String(fields.status_step))) {
			return {
				ok: false,
				error: steps.length
					? `"${String(fields.status_step)}" is not a stage of "${next.status}". Use one of: ${steps.join(', ')}.`
					: `"${next.status}" has no stages. Leave status_step out, or send it as null.`
			};
		}

		const actions = actionsFor(next.status, next.status_step);
		if (fields.status_action && !actions.includes(String(fields.status_action))) {
			return {
				ok: false,
				error: actions.length
					? `"${String(fields.status_action)}" is not a next action here. Use one of: ${actions.join(', ')}.`
					: `"${next.status}" has no next actions. Leave status_action out, or send it as null.`
			};
		}

		const date = fields.status_action_date;
		if (typeof date === 'string' && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
			return { ok: false, error: 'status_action_date must be a YYYY-MM-DD date' };
		}

		const note = fields.status_note;
		if (typeof note === 'string' && note.length > MAX_STATUS_NOTE) {
			return {
				ok: false,
				error:
					`status_note is one line on the timeline, not the account of what happened ` +
					`(${note.length} characters, limit ${MAX_STATUS_NOTE}). The rest belongs in ` +
					`an activity entry.`
			};
		}

		// A note annotates a move; it is not a thing of its own. Without this, a
		// proposal carrying only `status_note` writes a timeline row saying the
		// application went from "applying" to "applying" — and it does so at Tier
		// 1, because a note has no current value to be replacing. Something worth
		// recording on its own is an activity entry.
		const before = statusFieldsOf(current);
		if (
			next.status === before.status &&
			STAGE_FIELDS.every((field) => next[field] === before[field])
		) {
			return {
				ok: false,
				error:
					'Nothing about the status is changing, so there is no move for a note to ' +
					'go on. Something worth recording on its own is an activity entry — use ' +
					'add_activity_record.'
			};
		}

		return { ok: true };
	},
	apply: async (target, fields, current, actor) => {
		const next = nextStatusFields(fields, current);
		const note = typeof fields.status_note === 'string' ? fields.status_note.trim() : '';
		const written = await writeApplicationStatus(target.id, actor.profileId, {
			status: next.status,
			step: next.status_step,
			action: next.status_action,
			actionDate: next.status_action_date,
			description: note || null
		});
		if (!written) throw new Error('That application no longer exists.');
	},

	/**
	 * All four columns, not only the ones proposed.
	 *
	 * `apply` writes more than it was asked to — an unproposed stage is cleared
	 * when the status moves — so the default before-image would record the status
	 * alone, and an undo would put that back with the stage still missing. The
	 * rule that makes this capability more than a patch is the same rule that
	 * makes it need its own before-image.
	 */
	beforeImage: async (_target, current) => ({ ...current }),

	revert: async (target, previous, actor) => {
		if (typeof previous?.status !== 'string' || previous.status === '') {
			throw new Error('update_application_status recorded no status this can put back');
		}
		const before = statusFieldsOf(previous);
		const restored = await revertApplicationStatus(target.id, actor.profileId, {
			status: before.status,
			step: before.status_step,
			action: before.status_action,
			actionDate: before.status_action_date,
			description: null
		});
		if (!restored) throw new Error('That application no longer exists.');
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
			// The id leads, because it is the handle: an MCP caller reads this list
			// and then asks for one entry's text by number. It costs a few characters
			// in the chat's prompt, where nothing addresses an entry by id — worth it
			// against rendering the same chronology twice in two formats.
			recent_entries: recent.map(
				(r) =>
					`[${r.id}] ${r.event_date ?? 'undated'} — ${getRecordTypeLabel(r.record_type)}: ${r.title}`
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
		const title = proposedTitle ? clampRecordTitle(proposedTitle) : deriveRecordTitle(content);

		const [created] = await db
			.insert(application_records)
			.values({
				application_id: target.id,
				record_type: typeof fields.entry_type === 'string' ? fields.entry_type : 'note',
				title,
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

		// The entry, not the application it was filed under. The target this was
		// called with names the application, which is the right thing to authorize
		// against and the wrong thing to call the change.
		return { id: created.id, label: title };
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
	update_application_status: updateApplicationStatus,
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
	/**
	 * Rows this capability can reach that are not in `targets`, when the list was
	 * too long to print. Absent for every section that fits, which is all of them
	 * but skills on an ordinary profile.
	 *
	 * Carried rather than left implicit because the block has to SAY so. A
	 * truncated list that reads like the whole list is a model confidently
	 * telling someone they have no such skill.
	 */
	omitted?: number;
}

/**
 * How many rows a capability will list before it narrows to what the message
 * named.
 *
 * Every other section prints its whole list, and should: twelve roles or
 * twenty-four languages cost a line each and buy the model the ability to name
 * any of them. Skills do not fit that shape — a working applicant has a hundred,
 * measured at 93 on the profile this was built against — and two verbs listing
 * them is most of the turn's capability budget spent on rows nobody asked about.
 *
 * Above the cap the list becomes: the rows this message names, or the head of
 * the list when it names none. Both are stated in the block, and a row outside
 * it is reachable the moment the user says its name — which is how someone asks
 * about a specific skill anyway.
 *
 * Twenty-five rather than a round fifty because a skill's label carries its
 * group to stay unique ("PostgreSQL — Tooling & Methodology"), so a row is ~35
 * characters and the list is the part of the block that scales with the
 * applicant. What the list is FOR is naming one row; the inventory the add verb
 * prints — every skill, grouped, at a third of the cost per name — is what
 * answers "what do they already have".
 */
export const TARGET_LIST_CAP = 25;

/**
 * Narrow a scope's declared capabilities to the ones that actually apply right
 * now. A capability that can't resolve (no job attached) or won't authorize (a
 * scraped job, someone else's application) drops silently — the assistant is
 * simply never told it could do that, rather than offering an edit that fails.
 */
export async function resolveCapabilities(
	declared: Capability[],
	entity: ContextEntity | null,
	actor: CapabilityActor,
	opts: { message?: string } = {}
): Promise<LiveCapability[]> {
	const live = await Promise.all(
		declared.map(async (capability): Promise<LiveCapability | null> => {
			const def = CAPABILITIES[capability];

			// The page's own row wins. Only a page that names none asks for a list,
			// which is what keeps "biased to the page" true rather than aspirational.
			const target = await def.resolve(entity, actor);
			if (target) {
				if (!(await def.authorize(target, actor))) return null;
				return {
					capability,
					targets: [target],
					current: await def.current(target, actor, entity)
				};
			}

			if (!def.resolveMany) return null;

			const candidates = await def.resolveMany(entity, actor);
			const authorized = (
				await Promise.all(
					candidates.map(async (row) => ((await def.authorize(row, actor)) ? row : null))
				)
			).filter((row): row is CapabilityTarget => row !== null);
			if (authorized.length === 0) return null;

			const { targets, omitted } = fitTargets(authorized, opts.message ?? '');

			// One row is the single-row case however it was reached — by URL, by
			// being the only one, or by being the only one the message named — so it
			// gets the values to diff against rather than a list of one.
			if (targets.length === 1) {
				return {
					capability,
					targets,
					current: await def.current(targets[0], actor, entity),
					...(omitted > 0 ? { omitted } : {})
				};
			}

			return { capability, targets, current: null, ...(omitted > 0 ? { omitted } : {}) };
		})
	);
	return live.filter((c): c is LiveCapability => c !== null);
}

/**
 * The rows worth printing, out of every row the capability could reach.
 *
 * Under the cap this is everything, unchanged, which is every section but one.
 * Over it, the message decides: the rows it names, or the head of the list when
 * it names none. The head rather than nothing, because a list is also how the
 * model learns what is THERE — asked what to add, it needs to see enough of the
 * section not to propose a duplicate, and the add verb's own state carries the
 * full set of labels for exactly that.
 */
function fitTargets(
	authorized: CapabilityTarget[],
	message: string
): { targets: CapabilityTarget[]; omitted: number } {
	if (authorized.length <= TARGET_LIST_CAP) return { targets: authorized, omitted: 0 };

	const named = rowsNamedInMessage(message, authorized);
	const targets = (named.length > 0 ? named : authorized).slice(0, TARGET_LIST_CAP);

	return { targets, omitted: authorized.length - targets.length };
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
 * The escaping set, and deliberately not any `&word;`.
 *
 * This must never refuse a sentence someone wrote, so it matches only the
 * characters an HTML escaper produces, named and numeric. Measured zero matches
 * across every profile text column in the database when it was added.
 */
const HTML_ENTITY =
	/&(?:amp|lt|gt|quot|apos|nbsp|#0*(?:34|38|39|60|62)|#[xX]0*(?:22|26|27|3[cCeE]));/;

/**
 * An HTML entity in a value that is going onto a CV.
 *
 * Nothing downstream renders markup — the resume components have no `{@html}`,
 * so Svelte escapes on output and a stored `&amp;` reaches the page as those
 * five characters. The applicant reads `Lit &amp; Web Components` on a document
 * they are about to send to someone.
 *
 * It gets in when a model copies text out of its own rendered output instead of
 * composing it, and every later stage is blind to it: the value is a valid
 * string, `validate` has no opinion about it, and the diff renders it
 * faithfully — so the proposal a person reads looks exactly like what they
 * meant. The one place it currently fails loudly is by accident, when the text
 * happens to be a name something else has to match: a category called
 * "AI &amp; LLM engineering" resolves to nothing. Free text has no such luck.
 *
 * Returns the message rather than throwing, because both call sites already
 * have a refusal shape and the agent that sent it can fix it and retry.
 */
export function htmlEntityError(fields: Record<string, unknown>): string | null {
	for (const [name, value] of Object.entries(fields)) {
		for (const text of Array.isArray(value) ? value : [value]) {
			if (typeof text !== 'string') continue;
			const found = text.match(HTML_ENTITY)?.[0];
			if (found) {
				return (
					`${name} contains the HTML entity "${found}", which would be stored and ` +
					`shown literally on the document. Send the character itself instead.`
				);
			}
		}
	}
	return null;
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
	| {
			ok: true;
			previous: Record<string, unknown>;
			/**
			 * The `capability_edits` row this write produced — the handle an undo is
			 * addressed by, and null when the log write itself failed.
			 *
			 * Nullable rather than absent because the write succeeded either way, and
			 * a caller must not be able to mistake "not logged" for "not written".
			 */
			editId: number | null;
			/**
			 * The row this write created, for the capabilities that create one.
			 *
			 * Null for every edit, and that is the honest answer rather than a
			 * missing case: an edit changed a row that already existed, and the
			 * target it was called with already names it.
			 */
			created: CapabilityTarget | null;
	  }
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
	rawFields: Record<string, unknown>,
	source: EditSource
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

	// Before validate, not inside it: no capability has an opinion about this and
	// every one of them would need the same one.
	const escaped = htmlEntityError(fields);
	if (escaped) return { ok: false, reason: 'invalid', error: escaped };

	const valid = def.validate(fields, current);
	if (!valid.ok) return { ok: false, reason: 'invalid', error: valid.error };

	// Narrowed to the fields actually being written, before apply() runs. A
	// capability with no prior row for a field (add_activity_record has none at
	// all) simply contributes nothing here, which reads correctly as "there was
	// nothing there".
	//
	// A capability whose write is not a field patch overrides this: `hide_*`
	// carries no fields, so the narrowing would give `{}` and an undo would have
	// nothing to put back. See CapabilityDef.beforeImage.
	const previous = def.beforeImage
		? await def.beforeImage(target, current, actor)
		: Object.fromEntries(
				Object.keys(fields)
					.filter((key) => key in current)
					.map((key) => [key, current[key]])
			);

	// An add hands back the row it made; everything else writes to the target it
	// was given and returns nothing. See CapabilityDef.apply.
	const created = (await def.apply(target, fields, current, actor)) ?? null;

	// After the write, and never able to undo it. The change already happened;
	// throwing here would report a failure for something that succeeded and
	// invite the caller to retry it, and a double-applied edit is worse than a
	// missing log row. Imported lazily so that every test touching the registry
	// does not also have to mock the log's table — the same fix the profile_edits
	// context source needed, for the same reason.
	let editId: number | null = null;
	try {
		const { recordEdit } = await import('./edit-log');
		editId = await recordEdit({
			profileId: actor.profileId,
			source,
			capability,
			// The created row where there is one, not the profile the add was
			// addressed to. `write.ts` logs a person's add the same way, and the
			// whole premise of that log is that one action name means one change
			// whoever made it — an entry reading "their role projects" said only
			// which list had grown.
			target: created ?? target,
			fields,
			previous
		});
	} catch (e) {
		console.error(`[capabilities] ${capability} applied but was not logged`, e);
	}

	return { ok: true, previous, editId, created };
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
	status_step: 'Stage',
	status_action: 'Next action',
	status_action_date: 'Due on',
	status_note: 'Timeline note',
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
	// Filtered on what the proposal actually WROTE, not on the union below: a
	// proposal's `previous` holds the old value of every written field, so the
	// two are the same set here — and `hide_*` writes none at all, where a union
	// would start describing the tag array it recorded as a change nobody made.
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
 * The same diff over a field list the caller names.
 *
 * For the history entries that are not capabilities and so have no `fields` map
 * to walk — a deletion is the section's own columns, and what it has to show is
 * a value on the left and nothing on the right. Sides are unioned rather than
 * taken from `next`, because that is the case: a deletion writes no fields, and
 * filtering on the ones it wrote would describe it as nothing having happened.
 */
export function describeFieldChanges(
	names: string[],
	next: Record<string, unknown>,
	previous: Record<string, unknown>
): ProposedChange[] {
	return names
		.filter((field) => field in next || field in previous)
		.map((field) => ({
			field,
			label: labelFor(field),
			from: renderValue(previous[field]),
			to: renderValue(next[field])
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
	current: Record<string, unknown> | null,
	omitted = 0,
	/**
	 * The capability that already printed this exact list, when one has.
	 *
	 * A section's verbs share their targeting by construction — `hide_*` reuses
	 * the editor's `resolve` and `resolveMany` — so printing the rows again is
	 * the same hundred lines a second time. Naming where they are is not a
	 * shorthand the model has to unpack: it is one list, and it was already
	 * established a few hundred characters earlier.
	 */
	listedBy?: string
): string {
	const def = CAPABILITIES[capability];

	// One row: name it in the heading and show its values, which is what a diff
	// needs and what every capability did before lists existed.
	if (targets.length === 1 && current) {
		const state = (def.renderState ?? renderCurrent)(current);
		return `### Capability: ${capability} — ${targets[0].label}

${def.contract}${omitted > 0 ? `\n\n${narrowedNote(omitted, true)}` : ''}

${state}`;
	}

	// Several: labels and ids, no values. The model picks one by id, and its
	// current values are re-read for whichever it picks — printing all of them
	// is what the budget cannot hold, and is also what would let a model diff
	// against the wrong row without noticing.
	if (listedBy) {
		return `### Capability: ${capability}

${def.contract}

This one acts on exactly the rows listed under ${listedBy} above — the same list,
not a shorter one. Name one of them as "target_id", copied from there.`;
	}

	const rows = targets.map((t) => `  - target_id ${t.id}: ${t.label}`).join('\n');

	return `### Capability: ${capability}

${def.contract}

Rows you can change with this. Name exactly one, as "target_id", in the same
proposal — and only one of these, since these are the only ones you can reach:

${rows}${omitted > 0 ? `\n\n${narrowedNote(omitted, false)}` : ''}`;
}

/**
 * Said whenever the list above is not the whole list.
 *
 * The alternative — printing 40 of 93 rows and letting the model assume it has
 * them all — is how an assistant tells someone they have no PostgreSQL on their
 * profile because it happened to sort 41st. What replaces the missing rows is a
 * sentence saying they exist and how to reach one.
 */
function narrowedNote(omitted: number, narrowedToOne: boolean): string {
	return narrowedToOne
		? `This is the entry their message named. They have ${omitted} more in this ` +
				`section that are not shown; if they meant a different one, ask which rather ` +
				`than proposing a change to this one.`
		: `${omitted} more exist and are not listed — this section is too long to print in ` +
				`full. They are reachable, just not from here: if the user means one that is ` +
				`not above, say so and ask them to name it, and it will be listed next turn. ` +
				`Never guess a target_id.`;
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

/**
 * What the whole "Changes you can propose" block may cost, in characters.
 *
 * A ratchet in the style of CI's svelte-check baseline: it may go down freely
 * and up only deliberately. Every live capability's contract ships on every
 * capable turn, because one structured-output call has to carry the rules for
 * anything it might propose — so this is paid per turn, not once.
 *
 * It was 11,500 when a page could only grant what its route declared. Message
 * matching is what raised it: the total became a sum of two independent things —
 * what the route offers and what the message reached for — rather than one
 * table's worth.
 *
 * The number is the worst arrangement a page can reach, rounded up. Note what
 * that means — a target list grows with the profile, so this is the size of an
 * ordinary busy applicant's turn and not a hard bound on one. A profile past it
 * loses the *matched* section, never the page's own (see
 * `fitMatchedCapabilities`), and the manifest still says where that section
 * lives.
 *
 * Raised from 18,000 to 19,000 when skills became a section. Measured, on the
 * profile this was built against:
 *
 *  - **18,300** — an application page's five capabilities beside a matched
 *    skills section: 93 skills, 25 of them listed, three verbs. This is the new
 *    worst arrangement and it displaced the old one (17,828, the same page
 *    beside twelve roles of work history).
 *  - **14,350** — /profile/skills itself, measured on the real profile, where
 *    six capabilities are live because two sections share that page. Nothing
 *    drops a page's own capabilities, so this one has to fit on its own merits
 *    rather than by degrading.
 *
 * Three things paid for most of what skills would otherwise have cost, and they
 * are why this is 1,000 higher rather than 8,000: `TARGET_LIST_CAP` bounds the
 * list at 25 rows of the 93, a list is printed once per section rather than once
 * per verb (see `renderCapabilityPrompt`), and the add verb's inventory is
 * grouped rather than one row per line. Without them the same turn measured
 * 19,740 with a target list that was still not the whole section.
 *
 * Raised again to 22,000 when the child collections became sections — a role's
 * projects, achievements and technologies. Measured with
 * `scripts/measure-capability-budget.ts` against profile 1's heaviest role
 * (8 projects, 13 achievements, 22 technologies, 38 project technologies):
 *
 *  - **8,572** — the role's own three verbs. Never dropped.
 *  - **4,469** — its projects (2 verbs, 8 rows).
 *  - **6,015** — its achievements (3 verbs, 13 rows).
 *  - **5,227** — its technologies, **6,137** — its project technologies.
 *  - **30,420** — all five together, which is what settled the number: this is
 *    not a page that can be admitted whole, so it isn't. 22,000 holds the role,
 *    its projects and its achievements, and `tieredCapabilities` gives up the
 *    two technology sections rather than half of everything. A role with less
 *    hanging off it keeps more; the lightest of the eight keeps all of it.
 *
 * The per-section numbers are incremental, not standalone — a section's rows are
 * printed once for all its verbs, so measuring a verb alone counts a list its
 * siblings are already paying for. They are also ~10% below what the same
 * arrangement cost before `current` learned the page's row: a child's inventory
 * used to list every role's projects to answer a question about one.
 *
 * Held at 22,000 through the 2026-08-19 rewrite, which moved the numbers in
 * both directions. The preamble lost 326 characters that every capability was
 * paying; `edit_job_description` spent 427 on the rules that stop a rewrite
 * eating the text it replaces, and then ~4,900 more inlining the two texts it
 * edits (see its `renderState` for the measurement that bought it). On the
 * profile this was built against:
 *
 *  - **13,034** — a job page, with the real 4,069-character posting inline.
 *  - **16,289** — an application page's five, same posting. The most a page can
 *    reach today, and the margin is what a matched section spends.
 *  - **11,383** — the same page once a posting passes `INLINE_TEXT_CHARS` and
 *    the state falls back to pointing at the job block.
 *
 * Note which way that last one runs: the heaviest posting costs the LEAST here,
 * because the fallback is the cheap form. The number to watch is a page whose
 * posting sits just under the cap.
 *
 * Held at 22,000 again when `update_application_status` made the application
 * page six capabilities rather than five. It costs 2,360 characters of block,
 * 2,148 of which is the contract, and most of that is the stage and next-action
 * vocabulary — which is written out rather than described because the pipeline
 * groups on those labels and a model asked to pick a sensible one invents a new
 * one every turn. Measured at **16,984** on application 49, with the six live
 * and the posting inline. The arrangement that binds is still that page beside
 * a matched section, which the test above holds to the budget.
 */
export const CAPABILITY_PROMPT_BUDGET_CHARS = 22000;

/**
 * Admit matched capabilities while they fit, in the order given.
 *
 * The route's own capabilities are never dropped: they are what the page
 * promised, and a page that silently stops offering its own edit is the failure
 * this whole layer exists to avoid. Matched ones are the additions, so they are
 * what gives way — and giving way is cheap, because the manifest still names
 * the section and its page, which is the answer the user got before matching
 * existed.
 *
 * Groups are admitted whole. A section's three verbs are one offer; loading the
 * edit without the add would leave the model able to correct a language and not
 * to add one, for a reason no prompt states.
 */
export function fitMatchedCapabilities(
	granted: LiveCapability[],
	matched: LiveCapability[][],
	budgetChars = CAPABILITY_PROMPT_BUDGET_CHARS
): LiveCapability[] {
	const admitted = [...granted];

	for (const group of matched) {
		if (group.length === 0) continue;
		const candidate = [...admitted, ...group];
		if (renderCapabilityPrompt(candidate).length > budgetChars) continue;
		admitted.push(...group);
	}

	return admitted;
}

/** The capability block spliced into the system prompt, or "" when none are live. */
export function renderCapabilityPrompt(live: LiveCapability[]): string {
	if (live.length === 0) return '';

	// A list printed once. Two verbs over one section resolve the same rows, and
	// a hundred skills rendered twice is most of what a busy profile's turn used
	// to spend here — measured at 1,040 characters of pure repetition per
	// hideable section, before this.
	const listedBy = new Map<string, string>();
	const blocks = live.map((c) => {
		const key = c.targets.length > 1 ? c.targets.map((t) => t.id).join(',') : null;
		const first = key ? listedBy.get(key) : undefined;
		if (key && !first) listedBy.set(key, c.capability);

		return renderCapabilityBlock(c.capability, c.targets, c.current, c.omitted, first);
	});
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

"changes" is a LIST, one entry per field you are changing, each
{"field": "...", "value": ...}. Fields you don't list keep their current value;
an entry with "value": null clears that field.

A value you send REPLACES what the field holds — it is never merged with it, so
a field you are adding to comes back whole: everything it already says, plus
what you are adding. Whatever you leave out is deleted, and nothing warns either
of you that it went. Rewriting is not condensing: unless the user asked you to
cut something, every fact in the old value is in the new one.

Before you write "changes", re-read the message and count the distinct things
they asked you to correct — there is an entry for each. And if they asked for
two different KINDS of change, a correction to the structured fields AND a
rewrite of a long text, that is TWO entries in "proposals", one per capability.
Never do one and describe the other in prose: each entry becomes a separate card
they accept or reject on its own, so listing both costs them nothing, while a
reply promising more than the list delivers leaves half the correction unmade.

"rationale" is what the user reads to decide, and for a replaced text it is all
they get besides a character count and a few excerpts. Cover every entry in
"changes", in proportion — one sentence for a field correction, a short
paragraph for a rewritten text. Say what the change IS, not that there is one:
"cuts the required experience from 10 years to 3 and fills in the salary you
gave me", not "updates the description". Fields that belong together are one
idea and read as one; a minimum and a maximum are a salary range, not two edits.

These hold for every kind of change below:

- List only the fields you are changing. A field whose value is already right is
  noise the user reads past.
- Only propose what they asked for or have confirmed. A question is not an edit
  request — answer it and propose nothing. Never tidy up unasked, and when a
  correction merely suggests a second one, say so in your reply and let them
  decide instead of folding it in.
- The exception is a field your OWN change makes wrong. If what you are
  proposing contradicts a value you can also reach, correct that one too, in the
  same answer, and say so. Leaving it is not restraint — it is a row that now
  disagrees with itself.

${blocks.join('\n\n')}`;
}
