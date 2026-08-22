/**
 * The client half of `/api/profile-section/[resource]` — one parent's child
 * rows, each saving itself.
 *
 * ## What this replaces
 *
 * A role's projects, achievements and technologies were each a local array
 * posted whole to a section endpoint behind a Save button. That reconciles on
 * the server by deleting every row the payload does not mention, which is the
 * one shape that must never be fired automatically: a debounce tick ships this
 * tab's whole idea of the section, so a second tab — or a stale one — silently
 * deletes rows it never knew about. Auto-saving a collection needs per-row
 * writes, and this is the store over them.
 *
 * It also removes the thing that prompted all of this. The Save button sat below
 * every row in the section, so editing the seventh project put it off-screen,
 * on a page whose top half had been saving itself for months. Nothing was
 * broken; the page just asked for a click it never showed you.
 *
 * ## Drafts
 *
 * A row the user has just added has no server id and must not be created yet —
 * every section requires something (a project needs a name), and a POST of an
 * empty row is either a validation error or a nameless entry on their CV. So a
 * draft stays local until `canCreate` says it holds enough, at which point the
 * first save is a POST and every save after it is a PATCH.
 *
 * The create is serialized per row through `creating`. `autoSaveField` runs a
 * newer save while an older one is still in flight and discards the older
 * result — right for a PATCH, and two rows for a POST.
 *
 * ## What still asks first
 *
 * Deleting. A work-experience project owns its technologies and any documents
 * attached to it through `ON DELETE CASCADE`, so "Deleted · Undo" would offer to
 * restore a row with the same text and none of the things that hung off it.
 * The caller confirms and this deletes for good. Reordering keeps its explicit
 * commit for a different reason: a drag is not finished until it is dropped, and
 * the section's order is one write, not one per row.
 */

import { autoSaveField, type AutoSaveField, type SaveStatus } from './auto-save.svelte';

/** One row, its server identity, and the save that keeps them in step. */
export interface SectionRow<T> {
	/** Stable across reorders and inserts, for `#each` keys. Never sent. */
	readonly key: number;
	/** The row's id on the server, or null while it is still a draft. */
	readonly id: number | null;
	/** The editable fields, as the caller shapes them. */
	readonly data: T;
	readonly field: AutoSaveField<T>;
}

export interface SectionRowsOptions<T, R extends { id: number }> {
	/** The section, as `PROFILE_RESOURCES` names it — the URL segment. */
	resource: string;
	/** The foreign key column naming this row's parent, e.g. `work_experience_id`. */
	parentKey: string;
	parentId: number;
	/** For the reorder call, which is authorised against the profile. */
	profileId: number;
	/**
	 * The rows the page loaded. Generic over their shape so a caller keeps the
	 * type its `+page.server.ts` produced — an `interface` has no implicit index
	 * signature, so a `Record<string, unknown>` here would reject every real load
	 * type and send callers reaching for `as`.
	 */
	initial: readonly R[];
	/** One loaded row as the fields this editor owns. */
	toData: (row: R) => T;
	/** A fresh, empty draft. */
	blank: () => T;
	/** The PATCH/POST body for a value. Diffed against the last saved one. */
	toBody: (value: T) => Record<string, unknown>;
	/** True once a draft holds enough to be worth creating (its required fields). */
	canCreate: (value: T) => boolean;
	/** Wait this long after a keystroke before saving. 700ms suits free text. */
	debounceMs?: number;
}

export interface SectionRows<T> {
	readonly rows: SectionRow<T>[];
	/** Append a draft and return it, so the caller can expand or focus it. */
	add: () => SectionRow<T>;
	/** Merge a partial change into a row and schedule its save. */
	update: (row: SectionRow<T>, patch: Partial<T>) => void;
	/** Delete for good — server-side too, once the row has been created. */
	remove: (row: SectionRow<T>) => Promise<void>;
	/** Commit a new order. Drafts have no id and are simply not sent. */
	reorder: (order: SectionRow<T>[]) => Promise<void>;
	/** True while any row is saving or has an edit pending. */
	readonly busy: boolean;
	/**
	 * The section's save state as one thing, for a pill in its heading.
	 *
	 * Rows report individually, which is right for a project — a card of its own,
	 * with its own status beside its name. It is no use at all for a list of
	 * one-word chips: there is nowhere to put twelve pills, and the question
	 * being asked is not "did THIS chip save" but "is this saving at all", which
	 * is the question a page that just lost its Save buttons has to keep
	 * answering. Shaped as a `SaveStatus` so the same indicator renders it.
	 */
	readonly summary: SaveStatus;
}

/** The message a failed request should show, preferring what the server said. */
async function failure(response: Response): Promise<Error> {
	const body = (await response.json().catch(() => ({}))) as { message?: string; error?: string };
	return new Error(body.message || body.error || `Save failed (${response.status})`);
}

/**
 * Only the entries that differ, so a PATCH writes what the user touched.
 *
 * Arrays are compared by element rather than by identity. A body is built fresh
 * on both sides of the diff, so an unchanged tag list is a new array every time
 * — under identity it would be "changed" on every keystroke in the name beside
 * it, and every one of those PATCHes would rewrite the row's version tags.
 */
function changedOnly(
	next: Record<string, unknown>,
	prev: Record<string, unknown>
): Record<string, unknown> {
	const same = (a: unknown, b: unknown) =>
		Array.isArray(a) && Array.isArray(b)
			? a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
			: Object.is(a, b);

	const out: Record<string, unknown> = {};
	for (const key of Object.keys(next)) {
		if (!same(next[key], prev[key])) out[key] = next[key];
	}
	return out;
}

/** Two field records holding the same values, arrays compared by element. */
function valuesEqual<T extends Record<string, unknown>>(a: T, b: T): boolean {
	const keys = Object.keys(a);
	if (keys.length !== Object.keys(b).length) return false;
	return keys.every((k) => {
		const [x, y] = [a[k], b[k]];
		if (Array.isArray(x) && Array.isArray(y)) {
			return x.length === y.length && x.every((v, i) => Object.is(v, y[i]));
		}
		return Object.is(x, y);
	});
}

export function sectionRows<T extends Record<string, unknown>, R extends { id: number }>(
	opts: SectionRowsOptions<T, R>
): SectionRows<T> {
	const base = `/api/profile-section/${opts.resource}`;
	let keySeq = 0;

	/** Mutable per-row bookkeeping the reactive `SectionRow` view reads from. */
	interface Entry {
		key: number;
		id: number | null;
		data: T;
		field: AutoSaveField<T>;
		/** In-flight POST, so a second keystroke waits for the id instead of racing it. */
		creating: Promise<number> | null;
	}

	const entries = $state<Entry[]>([]);

	async function create(entry: Entry, value: T): Promise<number> {
		const response = await fetch(base, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				...opts.toBody(value),
				[opts.parentKey]: opts.parentId,
				profile_id: opts.profileId
			})
		});
		if (!response.ok) throw await failure(response);
		const body = (await response.json()) as { id: number };
		entry.id = body.id;
		return body.id;
	}

	/** A row with nothing in it yet, which is not the same as a row with nothing to save. */
	function isUnwrittenDraft(entry: Entry): boolean {
		return entry.id === null && !entry.creating && !opts.canCreate(entry.data);
	}

	async function persist(entry: Entry, value: T, previous: T): Promise<void> {
		// Reached only by a `flush()` on a blank draft — `update` does not schedule
		// one. Kept because flush is public and a save path that is only correct
		// because of what its caller did is one refactor away from not being.
		if (entry.id === null && !entry.creating && !opts.canCreate(value)) return;

		if (entry.id === null) {
			// One POST per row, however many edits arrive while it is in flight.
			// Whoever gets here first owns the create; the rest await it and then
			// patch whatever they changed on top.
			entry.creating ??= create(entry, value).finally(() => {
				entry.creating = null;
			});
			await entry.creating;
			return;
		}

		// `expected` alongside the diff, so a row this store has not looked at since
		// the page loaded cannot be written over something it never saw. Built here
		// rather than inside changedOnly because only the caller knows which side is
		// the server's. See `patchBody` and `updateRow`'s `expected`.
		const before = opts.toBody(previous);
		const changed = changedOnly(opts.toBody(value), before);
		const fields = Object.keys(changed);
		if (fields.length === 0) return;

		const response = await fetch(`${base}/${entry.id}`, {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				...changed,
				expected: Object.fromEntries(fields.map((key) => [key, before[key]]))
			})
		});
		if (!response.ok) throw await failure(response);
	}

	/**
	 * Build a row and put it in the list, closing over the LIVE entry.
	 *
	 * The order matters and is the whole reason this is not two statements. A
	 * `$state` array hands out a proxy per element, and the per-property signals
	 * that make a template re-render live on that proxy — so writing to the plain
	 * object this function starts with updates the value and notifies nobody.
	 * That is not a hypothetical: `id` is assigned exactly once, from inside the
	 * save, and with the raw object the project's technologies and documents went
	 * on saying "give it a name" after it had one, having been given one.
	 *
	 * So the object goes into the array first and everything below binds to what
	 * comes back out.
	 */
	function makeEntry(id: number | null, data: T): Entry {
		entries.push({
			key: keySeq++,
			id,
			data,
			creating: null,
			// Assigned below: the field's save closes over the entry it belongs to.
			field: null as unknown as AutoSaveField<T>
		});
		const entry = entries[entries.length - 1];

		entry.field = autoSaveField<T>({
			initial: data,
			save: (value, previous) => persist(entry, value, previous),
			onSaved: (value) => {
				entry.data = value;
			},
			// Rebuilt on every keystroke, so identity would report a change even
			// when the user typed the same character back — and an array-valued
			// field (version tags) would never compare equal at all.
			equal: valuesEqual,
			debounceMs: opts.debounceMs ?? 700
		});

		return entry;
	}

	for (const row of opts.initial) makeEntry(row.id, opts.toData(row));

	const view = (entry: Entry): SectionRow<T> => ({
		get key() {
			return entry.key;
		},
		get id() {
			return entry.id;
		},
		get data() {
			return entry.data;
		},
		get field() {
			return entry.field;
		}
	});

	function entryFor(row: SectionRow<T>): Entry | undefined {
		return entries.find((e) => e.key === row.key);
	}

	/**
	 * The worst thing happening across the section, and the way out of it.
	 *
	 * Ordered by what the user needs to know first: a failure outranks work in
	 * progress, which outranks a recent success. No undo — the previous value is
	 * a property of one row, and a section-wide "Undo" would have to pick one.
	 */
	const summary: SaveStatus = {
		get status() {
			if (entries.some((e) => e.field.status === 'error')) return 'error';
			if (entries.some((e) => e.field.dirty || e.field.status === 'saving')) return 'saving';
			return entries.some((e) => e.field.status === 'saved') ? 'saved' : 'idle';
		},
		get error() {
			return entries.find((e) => e.field.status === 'error')?.field.error ?? null;
		},
		get canUndo() {
			return false;
		},
		undo() {},
		retry() {
			for (const entry of entries) {
				if (entry.field.status === 'error') entry.field.retry();
			}
		}
	};

	return {
		get rows() {
			return entries.map(view);
		},
		get busy() {
			return entries.some((e) => e.field.dirty || e.field.status === 'saving');
		},
		summary,
		add() {
			return view(makeEntry(null, opts.blank()));
		},
		update(row, patch) {
			const entry = entryFor(row);
			if (!entry) return;
			entry.data = { ...entry.data, ...patch };

			// A draft the user has opened and not yet written is left out of the
			// save machinery entirely, rather than scheduling a save that returns
			// having done nothing: the field would then report "Saved · Undo" for a
			// row that has never existed, which is a lie told on every keystroke
			// until the name arrives. The moment it IS worth creating, this passes
			// the whole current value through and the POST carries all of it.
			if (isUnwrittenDraft(entry)) return;

			entry.field.set(entry.data);
		},
		async remove(row) {
			const entry = entryFor(row);
			if (!entry) return;

			// Never created, so there is nothing to delete and nothing to fail.
			if (entry.id !== null) {
				const response = await fetch(`${base}/${entry.id}`, { method: 'DELETE' });
				if (!response.ok) throw await failure(response);
			}
			entry.field.destroy();
			const at = entries.indexOf(entry);
			if (at !== -1) entries.splice(at, 1);
		},
		async reorder(order) {
			// Local first, so the list settles where it was dropped whatever the
			// request does; a failure surfaces as a thrown error the caller reports.
			const byKey = new Map(entries.map((e) => [e.key, e]));
			const next = order.map((row) => byKey.get(row.key)).filter((e): e is Entry => !!e);
			entries.splice(0, entries.length, ...next);

			const ids = next.map((e) => e.id).filter((id): id is number => id !== null);
			if (ids.length === 0) return;

			const response = await fetch(`${base}/reorder`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ profile_id: opts.profileId, order: ids })
			});
			if (!response.ok) throw await failure(response);
		}
	};
}
