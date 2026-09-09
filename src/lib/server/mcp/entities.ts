/**
 * How an MCP call names a job or an application, which is the whole of what
 * kept these capabilities off this server until now.
 *
 * The profile capabilities need none of this: their rows are owned outright,
 * `read_profile_section` lists them, and an entry id means one row on one
 * profile. Jobs and applications are page-bound in the chat — `resolve` takes
 * the entity the user is looking at — and over MCP there is no page. So the
 * agent has to name a row by id, and this file is the answer to "which ids may
 * it name".
 *
 * ## Two different answers for two different tables
 *
 * An **application** carries `profile_id`. Naming one is a WHERE clause, and
 * the row is either this profile's or it does not exist.
 *
 * A **job** does not. The row is shared between everyone the posting matched,
 * so "job 4213" is a global address and reading it by id is a table an agent
 * could walk. `jobs/profile-jobs.ts` is where that is answered: the profile's
 * own scope, with an id outside it indistinguishable from one that was never
 * there.
 *
 * ## Why this is not `resolveMany`
 *
 * `call.ts` targets a profile section by listing its rows and finding the id
 * among them, which is right for a section holding twelve roles and wrong for
 * a job list holding four thousand postings. It would also change the *chat*:
 * `resolveMany` is what makes a capability live on a list page, so adding one
 * to `edit_job_details` would start offering "edit any of your jobs" on /jobs.
 * A scoped lookup by id has the same property — an agent may name a row, never
 * reach one — without either cost.
 *
 * ## The editable pre-check
 *
 * `authorize` is still the gate and still runs inside `executeCapability`. This
 * refuses earlier only to say something the gate cannot: `canEditJob` answers
 * false for a scraped posting and for someone else's manual one alike, and
 * "you can no longer make this change" is a poor thing to tell an agent that
 * never could. Same shape as the skills capability's parent pre-check.
 */

import {
	applicationLabel,
	jobLabel,
	type Capability,
	type CapabilityActor,
	type CapabilityTarget
} from '$lib/server/ai-chat/capabilities';
import { readProfileApplication } from '$lib/server/applications/profile-applications';
import { readProfileJob } from '$lib/server/jobs/profile-jobs';
import { TEXT_KINDS, readOwnedText, type TextKind } from '$lib/server/texts/profile-texts';
import {
	TEXT_CAPABILITY_NAMES,
	kindForTextCapability,
	type TextCapability
} from '$lib/server/ai-chat/text-version-capabilities';
import {
	TEXT_COMMIT_CAPABILITY_NAMES,
	kindForTextCommitCapability,
	type TextCommitCapability
} from '$lib/server/ai-chat/text-commit-capabilities';
import {
	TEXT_CREATE_CAPABILITY_NAMES,
	kindForTextCreateCapability,
	textCreateOwner,
	type TextCreateCapability
} from '$lib/server/ai-chat/text-create-capabilities';

/** A resolved row, or the sentence to hand back to the agent instead. */
export type EntityResolution = { target: CapabilityTarget } | { error: string };

export interface EntityTargeting {
	entity: 'job' | 'application' | TextKind;
	/** The argument that names the row. Domain-named, because it is one. */
	arg: 'job_id' | 'application_id' | 'text_id';
	/** The schema description for that argument. */
	argDescription: string;
	/** The tool that hands out ids, named in every refusal that needs one. */
	listTool: 'list_jobs' | 'list_applications' | 'list_texts';
	resolve(id: number, actor: CapabilityActor): Promise<EntityResolution>;
	/**
	 * Where a person changes this by hand — for a result that has to say so.
	 *
	 * Takes the resolved target rather than its id, because for two of the four
	 * text kinds the id is not enough: a cover letter's page is under the
	 * application it belongs to, which only the row knows. Those resolvers put
	 * the path on the target (see `CapabilityTarget.path`); a job and an
	 * application still build theirs from the id and ignore the rest.
	 */
	page(target: CapabilityTarget): { name: string; path: string };
	/**
	 * The list the row lives on, named the way the sidebar names it.
	 *
	 * The per-row page needs an id; the feed showing "change it on your … page"
	 * has only a capability name, so it needs this one.
	 */
	collection: { name: string; path: string };
}

const jobTargeting: EntityTargeting = {
	entity: 'job',
	arg: 'job_id',
	argDescription:
		'Which job, by the id returned from list_jobs. Only jobs the applicant ' +
		'added by hand can be changed; call read_job first to see whether this one can.',
	listTool: 'list_jobs',
	page: (target) => ({ name: 'job', path: `/jobs/${target.id}` }),
	collection: { name: 'Jobs', path: '/jobs' },
	resolve: async (id, actor) => {
		const job = await readProfileJob(id, actor.profileId);
		if (!job) {
			return {
				error:
					`There is no job ${id} in this applicant's jobs. Call list_jobs for the ids ` +
					`you can use — this key reaches the jobs they imported or applied to, and ` +
					`nothing else.`
			};
		}
		if (!job.editable) {
			return {
				error:
					`Job ${id} ("${jobLabel(job)}") cannot be changed. Only jobs the applicant ` +
					`entered by hand are editable, because a scraped posting is a capture of ` +
					`someone else's page and the next re-scrape would overwrite whatever you ` +
					`wrote. Tell them what is wrong with it instead.`
			};
		}
		return { target: { id: job.id, label: jobLabel(job) } };
	}
};

/**
 * The applications list, named once.
 *
 * Shared with `add_application`, which is not in ENTITY_TARGETING — it makes a
 * row rather than naming one, so it has no targeting to ask where its result
 * lives, and the answer is the same list either way.
 */
export const APPLICATION_COLLECTION = { name: 'Applications', path: '/applications' };

const applicationTargeting: EntityTargeting = {
	entity: 'application',
	arg: 'application_id',
	argDescription: 'Which application, by the id returned from list_applications.',
	listTool: 'list_applications',
	page: (target) => ({ name: 'application', path: `/applications/${target.id}` }),
	collection: APPLICATION_COLLECTION,
	resolve: async (id, actor) => {
		const application = await readProfileApplication(id, actor.profileId);
		if (!application) {
			return {
				error:
					`There is no application ${id} on this profile. Call list_applications for ` +
					`the current ids.`
			};
		}
		return {
			target: {
				id: application.id,
				label: applicationLabel({
					title: application.job_title,
					company: application.job_company
				})
			}
		};
	}
};

/**
 * One kind of application text, named by an id that means nothing without it.
 *
 * The four kinds keep separate id spaces — letter 12, question 12 and story 12
 * all exist and are unrelated — so unlike a job or an application, the id alone
 * does not say what it names. The capability supplies the kind, which is the
 * same answer `ContextEntity` gives for profile sections and for the same
 * reason: seven of those share an id space too.
 *
 * Ownership is asked twice over, once per shape. A story and a cheat sheet
 * carry `profile_id`; a letter and a question hang off an application and reach
 * the profile through it. `readOwnedText` is where that split lives, and both
 * halves end the same way — a row outside this profile reads exactly like one
 * that was never there.
 */
function textTargeting(kind: TextKind): EntityTargeting {
	const def = TEXT_KINDS[kind];

	return {
		entity: kind,
		arg: 'text_id',
		argDescription:
			`Which ${def.noun}, by the id returned from list_texts for kind "${kind}". ` +
			`Ids are per kind: the ${def.noun} numbered 12 has nothing to do with any ` +
			`other kind's 12.`,
		listTool: 'list_texts',
		page: (target) => ({ name: def.noun, path: target.path ?? def.collection.path }),
		collection: def.collection,
		resolve: async (id, actor) => {
			const row = await readOwnedText(kind, id, actor.profileId);
			if (!row) {
				return {
					error:
						`There is no ${def.noun} ${id} on this profile. Call list_texts with kind ` +
						`"${kind}" for the ids you can use.`
				};
			}

			// A letter or an answer is named by what it belongs to as much as by
			// what it is: "Cover letter" alone names one of five on a profile, and
			// the label is what the applicant reads in the notification and on the
			// approval card. A story carries its own title and needs no help.
			let label = row.label;
			if (row.applicationId !== null) {
				const application = await readProfileApplication(row.applicationId, actor.profileId);
				if (application) {
					label = `${row.label} — ${applicationLabel({
						title: application.job_title,
						company: application.job_company
					})}`;
				}
			}

			return { target: { id: row.id, label, path: row.path } };
		}
	};
}

const TEXT_TARGETING = Object.fromEntries(
	TEXT_CAPABILITY_NAMES.map((capability) => [
		capability,
		textTargeting(kindForTextCapability(capability))
	])
) as Record<TextCapability, EntityTargeting>;

/**
 * The commit verbs name a row exactly as the version verbs do.
 *
 * Same kind, same id space, same `list_texts` — so the same targeting, built
 * from the same function rather than described a second time. What differs
 * between `add_<kind>_version` and `use_<kind>_version` is what they do to the
 * row they both reach, and none of that is targeting's business.
 */
const TEXT_COMMIT_TARGETING = Object.fromEntries(
	TEXT_COMMIT_CAPABILITY_NAMES.map((capability) => [
		capability,
		textTargeting(kindForTextCommitCapability(capability))
	])
) as Record<TextCommitCapability, EntityTargeting>;

/**
 * A create whose row hangs off an application, which names that application.
 *
 * `add_letter` is the only one today. It is an `add_` that still takes an id,
 * for exactly the reason `add_activity_record` does: the id is the application
 * the new row is filed under, not a row being changed. A story and a cheat
 * sheet hang off the profile instead, so they name nothing and are not here —
 * and that is read off the same declaration the capability itself branches on,
 * rather than listed a second time. Without targeting, an application-owned
 * create would ship a tool with no way to say which application it meant.
 */
const TEXT_CREATE_TARGETING = Object.fromEntries(
	TEXT_CREATE_CAPABILITY_NAMES.filter(
		(capability) => textCreateOwner(kindForTextCreateCapability(capability)) === 'application'
	).map((capability) => [capability, applicationTargeting])
) as Partial<Record<TextCreateCapability, EntityTargeting>>;

/**
 * The hand-written capabilities, and what each one's id argument names.
 *
 * `add_activity_record` is the odd one and worth reading twice: its argument
 * names the application the entry is FILED UNDER, not a row being changed.
 * Every other `add_*` on this server takes no id at all, because the profile is
 * implied by the key. An application is not.
 */
export const ENTITY_TARGETING: Partial<Record<Capability, EntityTargeting>> = {
	edit_job_details: jobTargeting,
	edit_job_description: jobTargeting,
	edit_job_skills: jobTargeting,
	edit_application_details: applicationTargeting,
	update_application_status: applicationTargeting,
	add_activity_record: applicationTargeting,
	// Generated, one per kind. They are `add_` verbs that still name a row —
	// the same shape as `add_activity_record`, whose argument names the
	// application an entry is filed under rather than a row being changed.
	...TEXT_TARGETING,
	// And one per kind again for the verb that commits one of those versions.
	...TEXT_COMMIT_TARGETING,
	// And the creates that name an application to be started under.
	...TEXT_CREATE_TARGETING
};

export const ENTITY_CAPABILITY_NAMES = Object.keys(ENTITY_TARGETING) as Capability[];

/**
 * The verbs that write a job — which is also the definition of what `read_job`
 * shows, since a read tool's promise is the current value of every field a
 * write tool could patch.
 */
export const JOB_CAPABILITIES = ENTITY_CAPABILITY_NAMES.filter(
	(capability) => ENTITY_TARGETING[capability]?.entity === 'job'
);

export function targetingFor(capability: Capability): EntityTargeting | null {
	return ENTITY_TARGETING[capability] ?? null;
}
