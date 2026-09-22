/**
 * `edit_match_config` — the preferences every imported job is scored against.
 *
 * ## Why this is hand-written and why it is not a profile section
 *
 * `PROFILE_CAPABILITIES` generates uniform CRUD over profile-owned *rows*: a
 * list you add to, edit one of, and hide one of. Match config is one row per
 * profile that always exists, so every verb except "edit" is meaningless and
 * "which row" has one answer. Generating it would mean describing the
 * exceptions, which is the same reason jobs and applications are hand-written.
 *
 * ## Why it exists at all
 *
 * Phase 0 of `planning/PROFILE-MEMORY.md`, run 2026-09-22. Asked *"I only want
 * senior contract roles now, and drop hybrid"* on the config page itself, the
 * assistant declined and named the page — correct, and useless, because the
 * user was already on it. Asked to remember a domain reservation it went
 * further and invented a control: *"add 'healthcare' and 'defence' as excluded
 * keywords or industries"*, which `match_config` has never had. A capability is
 * the answer to the first. The second is a hole this does NOT fill, and the
 * contract below says so in as many words, because a model that has just been
 * given a preferences tool is exactly the one that will reach for it.
 *
 * ## The singleton shape
 *
 * `resolve` ignores the page entity: this row hangs off the profile, not off
 * whatever the user is looking at. That makes it the first capability that
 * neither names a row by id nor creates one, which is `CapabilityDef.singleton`
 * — see `mcp/call.ts` for what that changes on the MCP side.
 */

import { and, eq } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { match_config } from '$lib/server/db/schema';
import type { CapabilityDef, CapabilityTarget } from './capabilities';
import {
	EXPERIENCE_LEVEL_OPTIONS,
	JOB_TYPE_OPTIONS,
	WORK_LOCATION_OPTIONS,
	readMatchPreferences,
	writeMatchPreferences,
	type MatchPreferenceValues
} from '$lib/server/job/match-preferences';

export type MatchConfigCapability = 'edit_match_config';

export const MATCH_CONFIG_CAPABILITY_NAMES: MatchConfigCapability[] = ['edit_match_config'];

/**
 * What the card and the prompt call it.
 *
 * Named as the sidebar names the page, so that "I can change your Match Config"
 * and "open Match Config" point at the same thing.
 */
const LABEL = 'your Match Config';

/** The wire names, prefixed. See `fields` for why. */
const FIELD = {
	jobTypes: 'match.job_types',
	experienceLevels: 'match.experience_levels',
	workLocation: 'match.work_location',
	locations: 'match.locations',
	remoteOnly: 'match.remote_only',
	communityJobs: 'match.match_community_jobs',
	communityMaxAge: 'match.community_max_age_days'
} as const;

/** `["Senior", "Lead"]`, for a contract that has to be exact about strings. */
function quoted(options: string[]): string {
	return options.map((option) => `"${option}"`).join(', ');
}

function listOf(value: unknown): string[] {
	return Array.isArray(value) ? (value as string[]) : [];
}

/**
 * Refuse a value the form does not offer, naming the ones it does.
 *
 * The three closed lists are stored as their display labels and compared as
 * such everywhere (see `job/match-preferences.ts`), so a model that proposes
 * "senior" or "full time" is proposing a preference no job will ever match —
 * silently, because nothing downstream errors on an unknown label. Checked here
 * rather than left to the write, for the same reason the skills capability
 * checks its parent name: a refusal the model can still act on beats an
 * exception at apply time.
 */
function offList(field: string, value: unknown, options: string[]): string | null {
	const bad = listOf(value).filter((item) => !options.includes(item));
	if (bad.length === 0) return null;
	return (
		`${field}: ${bad.map((b) => `"${b}"`).join(', ')} ` +
		`${bad.length === 1 ? 'is not an option' : 'are not options'}. Use exactly one of: ${quoted(options)}.`
	);
}

const editMatchConfig: CapabilityDef = {
	title: 'Change which jobs get imported and matched',
	singleton: true,

	/**
	 * The profile's own row, whatever page this is. Get-or-create, so a profile
	 * that has never opened the config page is editable rather than invisible.
	 */
	resolve: async (_entity, actor): Promise<CapabilityTarget | null> => {
		const config = await readMatchPreferences(actor.profileId);
		return { id: config.id, label: LABEL };
	},

	/**
	 * Re-asked at apply time, like every other capability's. `resolve` reads by
	 * profile so it cannot hand back someone else's row, but a proposal is
	 * applied long afterwards from a card carrying only an id.
	 */
	authorize: async (target, actor) => {
		const owned = await db.query.match_config.findFirst({
			where: and(eq(match_config.id, target.id), eq(match_config.profile_id, actor.profileId)),
			columns: { id: true }
		});
		return !!owned;
	},

	current: async (_target, actor) => {
		const config = await readMatchPreferences(actor.profileId);
		return {
			[FIELD.jobTypes]: config.job_types,
			[FIELD.experienceLevels]: config.experience_levels,
			[FIELD.workLocation]: config.work_location,
			[FIELD.locations]: config.locations,
			[FIELD.remoteOnly]: config.remote_only,
			[FIELD.communityJobs]: config.match_community_jobs,
			[FIELD.communityMaxAge]: config.community_max_age_days
		};
	},

	/**
	 * Prefixed, because `buildProposalSchema` merges every live capability's
	 * fields into one flat object for the provider. `job_types` and
	 * `work_location` are already taken by `edit_job_details`, where they mean
	 * what ONE posting says rather than what the applicant wants — the two would
	 * be indistinguishable on the wire, and a preference would land on a job.
	 */
	fields: {
		[FIELD.jobTypes]: 'stringArray',
		[FIELD.experienceLevels]: 'stringArray',
		[FIELD.workLocation]: 'stringArray',
		[FIELD.locations]: 'stringArray',
		[FIELD.remoteOnly]: 'boolean',
		[FIELD.communityJobs]: 'boolean',
		[FIELD.communityMaxAge]: 'int'
	},

	contract: `These are the applicant's standing preferences for which jobs get
imported and how every one of them is scored. They are not about any single job
or application, so propose a change here only when they state a preference that
holds from now on ("I only want contract work now"), never when they are talking
about one posting.

- "${FIELD.jobTypes}" — any of: ${quoted(JOB_TYPE_OPTIONS)}.
- "${FIELD.experienceLevels}" — any of: ${quoted(EXPERIENCE_LEVEL_OPTIONS)}.
- "${FIELD.workLocation}" — any of: ${quoted(WORK_LOCATION_OPTIONS)}.
- "${FIELD.locations}" — free text place names they will work in or from
  (countries, regions, cities). Empty means anywhere.
- "${FIELD.remoteOnly}" — true keeps only fully remote postings.
- "${FIELD.communityJobs}" — true also matches jobs other users imported, not
  just the ones their own searches found.
- "${FIELD.communityMaxAge}" — how many days old a community job may be. Only
  meaningful while the one above is true.

The three closed lists must use these exact strings, capitals included. A value
outside them is refused, and would match nothing if it were not.

Each of the four lists is REPLACED WHOLE, not added to. Send the complete list
you want them to end up with, including what they already had — "also add
freelance" means sending every existing type plus "Freelance". Omit a field
entirely to leave it alone.

There is nothing else in this config. It cannot exclude an industry, a domain,
a company or a keyword, and it has no salary floor. If they ask for one of
those, say plainly that this is not something the app can filter on yet. Do not
propose it as a location, do not fold it into another field, and do not tell
them to go and set it somewhere — there is nowhere.`,

	/**
	 * Every list is replaced whole, so the four move together as one state and a
	 * field narrowed away as "unchanged" would still be the field the write
	 * clears. See CapabilityDef.writesOneState.
	 */
	writesOneState: true,

	validate: (fields) => {
		const checks = [
			offList(FIELD.jobTypes, fields[FIELD.jobTypes], JOB_TYPE_OPTIONS),
			offList(FIELD.experienceLevels, fields[FIELD.experienceLevels], EXPERIENCE_LEVEL_OPTIONS),
			offList(FIELD.workLocation, fields[FIELD.workLocation], WORK_LOCATION_OPTIONS)
		].filter(Boolean);
		if (checks.length > 0) return { ok: false, error: checks.join(' ') };

		const age = fields[FIELD.communityMaxAge];
		if (age !== undefined && age !== null && (Number(age) < 1 || Number(age) > 365)) {
			return { ok: false, error: `${FIELD.communityMaxAge} must be between 1 and 365 days` };
		}

		return { ok: true };
	},

	apply: async (_target, fields, _current, actor) => {
		await writeMatchPreferences(actor.profileId, patchFrom(fields));
	},

	/**
	 * Put the replaced values back.
	 *
	 * `previous` holds every field the proposal carried, which is the whole of
	 * what this capability writes — the four lists move together, so a partial
	 * before-image is not a thing this can produce.
	 */
	revert: async (_target, previous, actor) => {
		if (Object.keys(previous).length === 0) {
			throw new Error('edit_match_config recorded no fields this can put back');
		}
		await writeMatchPreferences(actor.profileId, patchFrom(previous));
	}
};

/** Wire names back to column names, keeping "absent" and "null" apart. */
function patchFrom(fields: Record<string, unknown>): MatchPreferenceValues {
	const patch: MatchPreferenceValues = {};
	if (FIELD.jobTypes in fields) patch.job_types = listOf(fields[FIELD.jobTypes]);
	if (FIELD.experienceLevels in fields) {
		patch.experience_levels = listOf(fields[FIELD.experienceLevels]);
	}
	if (FIELD.workLocation in fields) patch.work_location = listOf(fields[FIELD.workLocation]);
	if (FIELD.locations in fields) patch.locations = listOf(fields[FIELD.locations]);
	// The two booleans are notNull columns: a coerced null means the model sent
	// something unreadable, which is "no opinion", not "turn it off".
	if (typeof fields[FIELD.remoteOnly] === 'boolean') {
		patch.remote_only = fields[FIELD.remoteOnly] as boolean;
	}
	if (typeof fields[FIELD.communityJobs] === 'boolean') {
		patch.match_community_jobs = fields[FIELD.communityJobs] as boolean;
	}
	if (FIELD.communityMaxAge in fields) {
		const age = fields[FIELD.communityMaxAge];
		patch.community_max_age_days = age === null || age === undefined ? null : Number(age);
	}
	return patch;
}

export const MATCH_CONFIG_CAPABILITIES: Record<MatchConfigCapability, CapabilityDef> = {
	edit_match_config: editMatchConfig
};
