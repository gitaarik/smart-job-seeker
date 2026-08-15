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
	HIDEABLE_RESOURCES,
	PROFILE_RESOURCE_NAMES,
	PROFILE_RESOURCES,
	type FieldSpec,
	type HideableResourceName,
	type ProfileResource,
	type ProfileResourceName,
	type SectionRow
} from '$lib/server/profile/resources';
import {
	createRow,
	readOwnedRow,
	readOwnedRows,
	setRowTags,
	setRowVisible,
	updateRow,
	validatePatch
} from '$lib/server/profile/write';
import type { CapabilityActor, CapabilityDef, CapabilityTarget } from './capabilities';

/**
 * The three verbs, and why deletion is not one of them.
 *
 * `edit` and `add` are ordinary. Removal is not: nothing a capability writes is
 * recoverable from the before-image, and a work experience owns achievements,
 * technologies and projects across four tables that a delete takes with it. So
 * the assistant proposes `hide` — `status: 'draft'`, which every section's rows
 * already carry and which exports and CVs already respect. It is one click to
 * accept and one click to undo, on the same page the applicant would have
 * edited it from. Hard delete stays UI-only.
 */
export type ProfileCapability =
	`edit_${ProfileResourceName}` | `add_${ProfileResourceName}` | `hide_${HideableResourceName}`;

export const PROFILE_VERBS = ['edit', 'add', 'hide'] as const;

/**
 * Every verb this section actually has.
 *
 * `hide` is not universal: four of the seven sections are rendered on documents
 * with no filter between them and the page, so there is nothing to write that
 * would take an entry off one. See HIDEABLE_RESOURCES. Offering the verb anyway
 * is how the first version of this shipped a write that changed nothing while
 * the assistant reported the entry hidden.
 */
export function verbsFor(resource: ProfileResourceName): ProfileCapability[] {
	const verbs: ProfileCapability[] = [
		`edit_${resource}` as ProfileCapability,
		`add_${resource}` as ProfileCapability
	];
	if ((HIDEABLE_RESOURCES as readonly string[]).includes(resource)) {
		verbs.push(`hide_${resource as HideableResourceName}`);
	}
	return verbs;
}

export const PROFILE_CAPABILITY_NAMES = PROFILE_RESOURCE_NAMES.flatMap(verbsFor);

/** The section a generated capability acts on. */
export function resourceForCapability(capability: ProfileCapability): ProfileResourceName {
	return capability.slice(capability.indexOf('_') + 1) as ProfileResourceName;
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

function editCapability(name: ProfileResourceName): CapabilityDef {
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

		/**
		 * Write the old values back. Same path as the edit itself, so ownership,
		 * coercion and validation are all re-asked — a log row records what
		 * happened, it does not authorize anything.
		 */
		revert: async (t, previous, actor) => {
			const result = await updateRow(
				name,
				{ profileId: actor.profileId },
				t.id,
				toColumns(name, fields, previous)
			);
			if (!result.ok) {
				throw new Error(`edit_${name} could not be undone: ${result.error}`);
			}
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

/**
 * Add an entry to a section.
 *
 * The target is the PROFILE, not a row — there is no row yet. That is the same
 * shape `add_activity_record` uses for the same reason, and it is why an add is
 * live on a section's list page and on one entry's page alike: "add another
 * role" means the same thing from both.
 *
 * `current` is what the section already holds rather than a diff, so the model
 * can tell "they have told me something new" from "that is already the third
 * item on this list". Adding a language they already have is the failure this
 * exists to prevent.
 */
function addCapability(name: ProfileResourceName): CapabilityDef {
	const resource = PROFILE_RESOURCES[name];
	const fields = assistantFields(resource);

	return {
		title: `Add a ${resource.label}`,

		// The profile itself, on any page of this section. Nothing to resolve
		// from the URL: an add has no row to name.
		resolve: async (entity, actor) =>
			entity?.type === 'profile_section' && entity.resource !== name
				? null
				: { id: actor.profileId, label: `their ${resource.page.name.toLowerCase()}` },

		authorize: async (t, actor) => t.id === actor.profileId,

		current: async (_t, actor) => {
			const rows = await readOwnedRows(name, { profileId: actor.profileId });
			return { existing: rows.map((row) => resource.rowLabel(row)) };
		},

		fields: Object.fromEntries(
			Object.entries(fields).map(([column, spec]) => [wireName(name, column), spec.kind])
		),

		contract: `${contractFor(resource, name)}

This one ADDS a new ${resource.label} rather than changing an existing one, so
every field you send is the new entry's own. ${
			resource.required.length > 0
				? `You must give ${resource.required
						.map((column) => `"${wireName(name, column)}"`)
						.join(
							' and '
						)} — without ${resource.required.length > 1 ? 'them' : 'it'} there is nothing to show in the list, and the proposal is discarded.`
				: ''
		}

Check what they already have, listed below, before proposing one. Adding a
second copy of something already there is worse than not adding it: it is a
duplicate on every document, and they have to find and remove it.`,

		renderState: (current) => {
			const existing = Array.isArray(current.existing) ? (current.existing as string[]) : [];
			if (existing.length === 0) return `They have no ${resource.page.name.toLowerCase()} yet.`;
			return `Already there — do not propose a duplicate of any of these:\n\n${existing
				.map((label) => `  - ${label}`)
				.join('\n')}`;
		},

		// A create, so every required field must be present rather than merely
		// non-empty where mentioned.
		validate: (proposed) => {
			const checked = validatePatch(name, toColumns(name, fields, proposed), true);
			return checked.ok ? { ok: true } : { ok: false, error: checked.error };
		},

		apply: async (_t, proposed, _current, actor) => {
			const result = await createRow(
				name,
				{ profileId: actor.profileId },
				toColumns(name, fields, proposed)
			);
			if (!result.ok) {
				throw new Error(`add_${name} refused at write time: ${result.error}`);
			}
		}
	};
}

/**
 * Take an entry off every document, reversibly.
 *
 * No fields: naming the row is the whole of the proposal. That is why
 * `executeCapability` only refuses an empty payload for a capability that asked
 * for values — this one asked for none and is complete without them.
 *
 * `current` returns the row in full even though nothing is being written to it,
 * because that is what the card has to show. A hide card that said only
 * "Spanish" would be asking someone to accept the removal of something they
 * cannot see; the person deciding needs to read what goes.
 */
function hideCapability(name: HideableResourceName): CapabilityDef {
	const resource = PROFILE_RESOURCES[name];
	const editor = editCapability(name);

	return {
		title: `Hide this ${resource.label}`,

		// Same targeting as the edit verb: the page's row where there is one, and
		// otherwise every row for the model to name.
		resolve: editor.resolve,
		resolveMany: editor.resolveMany,
		authorize: editor.authorize,
		current: editor.current,

		fields: {},

		contract: `You may propose hiding one of their ${resource.page.name.toLowerCase()}.

Hiding takes it off every CV and every export. It is NOT deleted — they can put
it back from their ${resource.page.name} page — but it stops appearing
everywhere until they do, so propose it only when they have asked for it rather
than because it looks weak to you. A ${resource.label} they are not proud of is
still theirs to decide about.

This proposal carries no fields. Name the entry and say why in the rationale;
there is nothing to write.`,

		renderState: (current) => {
			const shown = Object.entries(current)
				.filter(([, value]) => value !== null && value !== undefined && value !== '')
				.map(([field, value]) => `  - ${field}: ${String(value).slice(0, INLINE_LIMIT)}`);
			return shown.length > 0 ? `What hiding this would take off:\n\n${shown.join('\n')}` : '';
		},

		validate: () => ({ ok: true }),

		/**
		 * The row's document tags, which is what hiding rewrites.
		 *
		 * The default before-image is the old values of the fields being written,
		 * and this capability writes no fields — so without this the log would
		 * record `{}` and an undo would have nothing to put back. Recording the
		 * whole array rather than "it was visible" is what lets the undo restore a
		 * per-version tag the applicant set by hand alongside it.
		 */
		beforeImage: async (t, _current, actor) => {
			const row = await readOwnedRow(name, { profileId: actor.profileId }, t.id);
			return { tags: (row?.tags as string[] | null) ?? null };
		},

		revert: async (t, previous, actor) => {
			const tags = Array.isArray(previous.tags) ? (previous.tags as string[]) : null;
			const result = await setRowTags(name, { profileId: actor.profileId }, t.id, tags);
			if (!result.ok) {
				throw new Error(`hide_${name} could not be undone: ${result.error}`);
			}
		},

		apply: async (t, _proposed, _current, actor) => {
			const result = await setRowVisible(name, { profileId: actor.profileId }, t.id, false);
			if (!result.ok) {
				throw new Error(`hide_${name} refused at write time: ${result.error}`);
			}
		}
	};
}

export const PROFILE_CAPABILITIES = Object.fromEntries([
	...PROFILE_RESOURCE_NAMES.flatMap((name) => [
		[`edit_${name}`, editCapability(name)],
		[`add_${name}`, addCapability(name)]
	]),
	...HIDEABLE_RESOURCES.map((name) => [`hide_${name}`, hideCapability(name)])
]) as Record<ProfileCapability, CapabilityDef>;
