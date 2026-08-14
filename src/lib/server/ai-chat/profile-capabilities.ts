/**
 * The assistant's profile capabilities, generated from `PROFILE_RESOURCES`.
 *
 * Jobs and applications are hand-written in `capabilities.ts` because their
 * semantics are bespoke — who may edit a shared job, the summariser side
 * effects, two long texts that are one editing job. Profile sections are not:
 * they are uniform CRUD over profile-owned rows, which is exactly why their
 * nine `+page.server.ts` files read like copies of each other before the write
 * layer replaced them. Generating these is the same argument one level up, and
 * it is what stops a capability becoming a *fourth* convention beside the
 * declaration, the write layer and the form actions.
 *
 * Two things the generator does that a hand-written capability would have to
 * remember:
 *
 * **Namespaced field names.** The proposal schema puts every live capability's
 * field names into one flat enum, so the model sees `summary` once no matter how
 * many sections offer one — and `summary` exists on the profile, on every work
 * experience and on every side project. The wire name is
 * `work_experience.summary`, resolved back to the column only at the point of
 * writing. That does not tell the model which row it meant, which is a separate
 * problem this does not solve; it does mean a field naming the wrong section is
 * a name that fails rather than a value that lands somewhere plausible.
 *
 * **Fields the model may not touch.** `notForAssistant` is not the same question
 * as whether a person may edit a column. It marks the ones whose wrong value is
 * *silent*: a version slug matching no version drops the item from every
 * document without erroring, and a Font Awesome name that does not exist renders
 * a gap. A person editing those sees the result immediately; a proposal card
 * shows the string and looks fine.
 */

import {
	assistantFields,
	PROFILE_RESOURCE_NAMES,
	PROFILE_RESOURCES,
	type FieldSpec,
	type ProfileResource,
	type ProfileResourceName,
	type SectionRow
} from '$lib/server/profile/resources';
import { readOwnedRow, readOwnedRows, updateRow, validatePatch } from '$lib/server/profile/write';
import type { CapabilityActor, CapabilityDef, CapabilityTarget } from './capabilities';

export type ProfileCapability = `edit_${ProfileResourceName}`;

export const PROFILE_CAPABILITY_NAMES = PROFILE_RESOURCE_NAMES.map(
	(resource) => `edit_${resource}` as ProfileCapability
);

/** The section a generated capability edits. */
export function resourceForCapability(capability: ProfileCapability): ProfileResourceName {
	return capability.slice('edit_'.length) as ProfileResourceName;
}

/**
 * The wire name for a column: the section, then the column.
 *
 * A dot rather than an underscore so the boundary survives a column name that
 * already has underscores in it — `work_experience_start_date` is ambiguous
 * about where the section ends, and every date column here would hit that.
 */
function wireName(resource: ProfileResourceName, column: string): string {
	return `${resource}.${column}`;
}

/** The column a wire name refers to, or null when it names another section's. */
function columnName(resource: ProfileResourceName, field: string): string | null {
	const prefix = `${resource}.`;
	return field.startsWith(prefix) ? field.slice(prefix.length) : null;
}

/**
 * Turn a namespaced patch back into column names, keeping only this section's
 * columns and only the ones the assistant may write.
 *
 * The allow-list is repeated here rather than trusted from upstream on purpose.
 * `pickCapabilityFields` already drops anything outside `fields` before
 * `executeCapability` calls `apply`, so in the real flow this is the second
 * check — but `apply` is what actually writes, and a write path that is only
 * safe because of what its caller did is one refactor away from not being. The
 * columns this drops are the ones whose wrong value is silent.
 */
function toColumns(
	resource: ProfileResourceName,
	allowed: Record<string, FieldSpec>,
	fields: Record<string, unknown>
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(fields)
			.map(([field, value]) => [columnName(resource, field), value] as const)
			.filter(
				(entry): entry is readonly [string, unknown] => entry[0] !== null && entry[0] in allowed
			)
	);
}

/** One line of the contract's field list. */
function describeField(name: string, spec: FieldSpec): string {
	const parts: string[] = [];
	if (spec.note) parts.push(spec.note);
	if (spec.allowed) parts.push(`one of: ${spec.allowed.join(', ')}`);
	if (spec.kind === 'date') parts.push('YYYY-MM-DD');
	if (spec.kind === 'int') parts.push('a whole number, no separators');

	return parts.length > 0 ? `- "${name}" — ${parts.join('. ')}.` : `- "${name}"`;
}

/**
 * The prose contract for a section.
 *
 * Prose and not just a schema, for the reason recorded on `CapabilityDef`:
 * passing a schema is not enough with either provider, and spelling the contract
 * out in words is what makes structured output hold. What is generated here is
 * the part that varies — which fields exist and what each holds. Rules that are
 * true of every capability live once in `renderCapabilityPrompt`'s preamble.
 */
function contractFor(resource: ProfileResource, name: ProfileResourceName): string {
	const fields = assistantFields(resource);
	const lines = Object.entries(fields).map(([column, spec]) =>
		describeField(wireName(name, column), spec)
	);

	const withheld = Object.entries(resource.fields).filter(([, spec]) => spec.notForAssistant);

	return `You may propose corrections to this ${resource.label}.

Every field name here begins with "${name}." — that prefix says which part of the
profile the field belongs to, and several parts have a field with the same short
name. Use the full name exactly as written:

${lines.join('\n')}

Each field is replaced outright, so send the complete new value, not a fragment
or a diff. A field you do not list keeps what it holds; a field with a null value
is cleared.${
		withheld.length > 0
			? `

You cannot change ${withheld.map(([column]) => `"${column}"`).join(' or ')} here. If the user asks you to,
say so plainly and tell them where in the profile to do it themselves — do not
work around it by writing the value into another field.`
			: ''
	}

Do not invent history. Tightening how something is worded is in scope; adding a
responsibility, a date or an employer the applicant has not told you about is
not.`;
}

/**
 * What the model sees of a row's current values.
 *
 * Long texts are shown as a length rather than in full, the same way the job
 * long-text capability does it and for the same reason: the texts themselves
 * already reach the model through the `profile` context source, which is built
 * from the profile and its work experiences. Printing them again here would
 * spend the budget twice to say the same thing, next to a profile blob that is
 * already the largest block in the prompt.
 */
const INLINE_LIMIT = 160;

function renderState(current: Record<string, unknown>): string {
	const lines = Object.entries(current).map(([field, value]) => {
		if (value === null || value === undefined || value === '') return `  - ${field}: (not set)`;
		if (Array.isArray(value)) return `  - ${field}: ${value.join(', ')}`;

		const text = String(value);
		return text.length > INLINE_LIMIT
			? `  - ${field}: ${text.length} characters, shown in full in their profile above`
			: `  - ${field}: ${text}`;
	});

	return `Current values:\n\n${lines.join('\n')}`;
}

/** Read the row this capability is about, or null if it is gone or not theirs. */
async function target(
	name: ProfileResourceName,
	id: number,
	actor: CapabilityActor
): Promise<{ row: SectionRow; target: CapabilityTarget } | null> {
	const row = await readOwnedRow(name, { profileId: actor.profileId }, id);
	if (!row) return null;
	return { row, target: { id: row.id, label: PROFILE_RESOURCES[name].rowLabel(row) } };
}

function profileCapability(name: ProfileResourceName): CapabilityDef {
	const resource = PROFILE_RESOURCES[name];
	const fields = assistantFields(resource);

	return {
		title: `Correct this ${resource.label}`,

		/**
		 * The row the page is about. Nothing else resolves: a section page shows
		 * one row, and a capability for a different section on the same page has
		 * no target and drops out of the turn.
		 */
		resolve: async (entity, actor) => {
			if (entity?.type !== 'profile_section' || entity.resource !== name) return null;
			return (await target(name, entity.id, actor))?.target ?? null;
		},

		/**
		 * Every row of this section, for a page that is about the list rather than
		 * one entry — the languages page, not one language. Tried only when
		 * `resolve` came back empty, so a detail page still keeps its own row and
		 * the model is never offered a choice it did not need.
		 */
		resolveMany: async (_entity, actor) => {
			const rows = await readOwnedRows(name, { profileId: actor.profileId });
			return rows.map((row) => ({ id: row.id, label: PROFILE_RESOURCES[name].rowLabel(row) }));
		},

		/**
		 * Asked again against a fresh read, never against the resolved target.
		 * A proposal can sit in a resumable thread for twelve hours, and a row
		 * can be deleted or a profile switched inside that window.
		 */
		authorize: async (t, actor) =>
			(await readOwnedRow(name, { profileId: actor.profileId }, t.id)) !== null,

		/**
		 * Read against the actor, not by id alone. A job is readable by anyone
		 * signed in, so the hand-written capabilities can look one up bare; a
		 * profile row read that way would put another applicant's history into
		 * this one's prompt.
		 */
		current: async (t, actor) => {
			const row = await readOwnedRow(name, { profileId: actor.profileId }, t.id);
			return Object.fromEntries(
				Object.keys(fields).map((column) => [wireName(name, column), row?.[column] ?? null])
			);
		},

		fields: Object.fromEntries(
			Object.entries(fields).map(([column, spec]) => [wireName(name, column), spec.kind])
		),

		contract: contractFor(resource, name),

		renderState,

		validate: (proposed) => {
			const checked = validatePatch(name, toColumns(name, fields, proposed));
			return checked.ok ? { ok: true } : { ok: false, error: checked.error };
		},

		apply: async (t, proposed, _current, actor) => {
			const result = await updateRow(
				name,
				{ profileId: actor.profileId },
				t.id,
				toColumns(name, fields, proposed)
			);

			// authorize and validate both passed moments ago, so a refusal here is
			// a race — the row deleted, the profile switched — not a bad proposal.
			if (!result.ok) {
				throw new Error(`edit_${name} refused at write time: ${result.error}`);
			}
		}
	};
}

export const PROFILE_CAPABILITIES = Object.fromEntries(
	PROFILE_RESOURCE_NAMES.map((name) => [`edit_${name}`, profileCapability(name)])
) as Record<ProfileCapability, CapabilityDef>;
