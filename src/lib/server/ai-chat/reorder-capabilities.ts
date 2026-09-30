/**
 * `reorder_<section>` — a section's entries put in a new order by an agent,
 * with the applicant's approval.
 *
 * ## Why only over MCP
 *
 * In the app the order is set by dragging, on the page the list is on, which is
 * one gesture where a chat proposal is three: ask, read the card, apply. An
 * agent outside the app has no page to drag on. Before this, reordering a
 * profile from one meant a list of moves for the applicant to make by hand, or a
 * write straight to the database that the history never saw and nothing could
 * undo. The chat's capability block is also nearly spent on the pages these
 * lists live on (949 characters left on the busiest role page when this was
 * written), and a verb that has to name every row of a group would not fit
 * beside the ones already there.
 *
 * So these are in `CAPABILITIES`, where the approval page, the history and its
 * undo find them, and in `MCP_CAPABILITIES`, and in no route's scope: `verbsFor`
 * does not return them and the chat is never offered one.
 *
 * ## Whole groups
 *
 * Every section sorts on its own `sort` column first, and a child section sorts
 * within its parent: skills within their group, achievements within their role.
 * So an order names every entry of each group it touches, and leaves the other
 * groups alone. A partial group would be ambiguous rather than small: the rows
 * left out keep sort numbers counted against the old list, and land between the
 * new ones wherever those numbers happen to fall.
 *
 * ## Always a request
 *
 * `tiers.ts` makes every reorder Tier 2. Nothing is removed, but the order is
 * something the applicant arranged by hand, it decides what a reader sees
 * first, and one call rewrites every row of a group.
 */

import {
	PROFILE_RESOURCE_NAMES,
	PROFILE_RESOURCES,
	type ProfileResourceName
} from '$lib/server/profile/resources';
import { readOwnedRows, reorderRows } from '$lib/server/profile/write';
import type { OrderGroup } from '$lib/utils/change-analysis';
import type { CapabilityDef, ProposedChange } from './capabilities';

export type ReorderCapability = `reorder_${ProfileResourceName}`;

export const REORDER_CAPABILITY_NAMES = PROFILE_RESOURCE_NAMES.map(
	(name) => `reorder_${name}` as ReorderCapability
);

export function isReorderCapability(name: string): name is ReorderCapability {
	return (REORDER_CAPABILITY_NAMES as string[]).includes(name);
}

/** Where `current` carries the rows, beside the order itself. Not a field. */
const ROWS = 'rows';

/** How many missing entries a refusal names before it counts the rest. */
const MISSING_NAMED = 8;

interface OrderRow {
	id: number;
	/** The full label, which says which group the row is in. */
	label: string;
	/** The row's own name, for the card: its group is the same all the way down. */
	name: string;
	/** The parent row it sorts within, or null for a section owned by the profile. */
	parent: number | null;
	/** What that parent is called, for the heading over its list on the card. */
	group: string | null;
}

/**
 * One group's rows in the order they were in, as a request records them.
 *
 * Kept for the card: `reorderRows` numbers the whole call, but each role reads
 * only its own achievements, so a place counted across two roles is a place no
 * list ever had.
 */
interface RecordedGroup {
	name: string | null;
	ids: number[];
}

/** The section's rows in the order they read today, which is the order `sort` gives. */
async function orderRows(name: ProfileResourceName, profileId: number): Promise<OrderRow[]> {
	const resource = PROFILE_RESOURCES[name];
	const owner = resource.owner.via === 'parent' ? resource.owner : null;
	const rows = await readOwnedRows(name, { profileId });

	return rows.map((row) => ({
		id: Number(row.id),
		label: resource.rowLabel(row),
		name: resource.shortLabel?.(row) ?? resource.rowLabel(row),
		parent: owner ? Number(row[owner.key]) : null,
		// The parent's label, which the read attaches under this field.
		group: owner ? String(row[owner.nameField] ?? '') || null : null
	}));
}

/** Rows split by the parent they sort within, keeping the order they came in. */
function groupsOf(rows: OrderRow[]): RecordedGroup[] {
	const groups = new Map<number | null, RecordedGroup>();
	for (const row of rows) {
		const group = groups.get(row.parent) ?? { name: row.group, ids: [] };
		group.ids.push(row.id);
		groups.set(row.parent, group);
	}
	return [...groups.values()];
}

/**
 * The new order as the lists it will read as, each entry with the place it had.
 *
 * With no `groups` recorded it is one list. That is right for a section the
 * profile owns directly, and for the two requests dev recorded before `groups`
 * was kept, which each moved a single group; one that moved several would be
 * numbered across them.
 */
function orderGroups(
	next: unknown,
	previous: Record<string, unknown>,
	nameOf: (id: number) => string
): OrderGroup[] {
	const after = Array.isArray(next) ? (next as number[]) : [];
	const groups = Array.isArray(previous.groups)
		? (previous.groups as RecordedGroup[])
		: [{ name: null, ids: Array.isArray(previous.order) ? (previous.order as number[]) : [] }];

	return groups.map((group) => ({
		name: group.name,
		entries: after
			.filter((id) => group.ids.includes(id))
			.map((id) => ({ id, name: nameOf(id), was: group.ids.indexOf(id) + 1 }))
	}));
}

function reorderCapability(name: ProfileResourceName): CapabilityDef {
	const resource = PROFILE_RESOURCES[name];
	const field = `${name}.order`;
	const title = resource.title.toLowerCase();
	const parent = resource.owner.via === 'parent' ? PROFILE_RESOURCES[resource.owner.parent] : null;

	const groups = parent
		? `They sort within each ${parent.label}, so list every entry of each ${parent.label} you ` +
			`reorder, and leave out the ones you are not changing.`
		: 'List every entry, each once.';

	return {
		title: `Reorder ${title}`,

		// The section as a whole, on this profile: named the way a person's reorder
		// of the same list is logged, so the two read alike in the history and an
		// undo of either finds the other in its way.
		resolve: async (_entity, actor) => ({ id: actor.profileId, label: resource.title }),
		authorize: async (t, actor) => t.id === actor.profileId,
		singleton: true,

		current: async (_t, actor) => {
			const rows = await orderRows(name, actor.profileId);
			return { [field]: rows.map((row) => row.id), [ROWS]: rows };
		},

		fields: { [field]: 'intArray' },
		requiredFields: [field],

		contract: `Put their ${title} in a new order. Their documents and their profile list them in
this order, so it decides what a reader sees first.

"${field}" is the new order, as entry ids from read_profile_section, which lists
them in their current order. ${groups}

Propose it only when they have asked for it: the order is theirs, set by hand.
It always waits for their approval, and they can undo it afterwards.`,

		validate: (fields, current) => {
			const order = fields[field];
			if (!Array.isArray(order) || order.length === 0) {
				return { ok: false, error: `${field} is required: the entry ids, in the new order.` };
			}

			const rows = (current[ROWS] ?? []) as OrderRow[];
			const byId = new Map(rows.map((row) => [row.id, row]));
			const listed = new Set<number>();

			for (const id of order as number[]) {
				if (listed.has(id)) return { ok: false, error: `Entry ${id} is listed twice.` };
				if (!byId.has(id)) {
					return {
						ok: false,
						error:
							`There is no entry ${id} in ${name} on this profile. ` +
							`Call read_profile_section for the current ids.`
					};
				}
				listed.add(id);
			}

			const touched = new Set([...listed].map((id) => byId.get(id)?.parent ?? null));
			const missing = rows.filter((row) => touched.has(row.parent) && !listed.has(row.id));
			if (missing.length > 0) {
				const named = missing.slice(0, MISSING_NAMED).map((row) => `${row.id} (${row.label})`);
				const more = missing.length - named.length;
				return {
					ok: false,
					error: `${groups} Missing: ${named.join(', ')}${more > 0 ? `, and ${more} more` : ''}.`
				};
			}

			// Checked here rather than left to MCP's unchanged-narrowing, which
			// compares against the whole section and so cannot see that one group
			// sent back as it stands changes nothing.
			const before = rows.filter((row) => listed.has(row.id)).map((row) => row.id);
			if (before.every((id, i) => id === order[i])) {
				return {
					ok: false,
					error: 'They are already in that order, so there is nothing to change.'
				};
			}

			return { ok: true };
		},

		/**
		 * The order these rows were in, and what each is called.
		 *
		 * The order is what the undo writes back: only the rows this call moves,
		 * which is the same set a person's reorder records. The names are for the
		 * card, which is rendered from a stored request with no database to ask
		 * (see `CapabilityDef.describeChanges`), and a list of ids asks somebody to
		 * approve an order nobody showed them. So are the groups, in a section
		 * that sorts within a parent: the card numbers each list on its own and
		 * heads it with the parent's name.
		 */
		beforeImage: async (_t, current, _actor, fields) => {
			const listed = new Set((fields[field] ?? []) as number[]);
			const rows = ((current[ROWS] ?? []) as OrderRow[]).filter((row) => listed.has(row.id));
			return {
				order: rows.map((row) => row.id),
				names: Object.fromEntries(rows.map((row) => [row.id, row.name])),
				...(parent ? { groups: groupsOf(rows) } : {})
			};
		},

		describeChanges: (fields, previous): ProposedChange[] => {
			const names = (previous.names ?? {}) as Record<string, string>;
			const nameOf = (id: unknown) => names[String(id)] ?? `#${id}`;
			const named = (ids: unknown) => (Array.isArray(ids) ? ids : []).map(nameOf).join(', ');
			return [
				{
					field,
					label: 'Order',
					from: named(previous.order),
					to: named(fields[field]),
					order: orderGroups(fields[field], previous, nameOf)
				}
			];
		},

		apply: async (_t, fields, _current, actor) => {
			const result = await reorderRows(
				name,
				{ profileId: actor.profileId },
				fields[field] as number[]
			);
			if (!result.ok) throw new Error(`reorder_${name} refused at write time: ${result.error}`);
		},

		/**
		 * Put the order back. Also the undo for a person's own reorder of this
		 * section, which is logged under the same name with the same `order`.
		 */
		revert: async (_t, previous, actor) => {
			const order = Array.isArray(previous.order) ? (previous.order as number[]) : [];
			// An empty order is not a no-op worth attempting: `reorderRows` would
			// write nothing and report success, and the history would mark the entry
			// undone having done nothing.
			if (order.length === 0) throw new Error('That order was not recorded.');
			const result = await reorderRows(name, { profileId: actor.profileId }, order);
			if (!result.ok) throw new Error(`reorder_${name} could not be undone: ${result.error}`);
		}
	};
}

export const REORDER_CAPABILITIES = Object.fromEntries(
	PROFILE_RESOURCE_NAMES.map((name) => [`reorder_${name}`, reorderCapability(name)])
) as Record<ReorderCapability, CapabilityDef>;
