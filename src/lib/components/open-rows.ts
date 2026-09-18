import { SvelteSet } from 'svelte/reactivity';

/**
 * Which rows of an editable list are open.
 *
 * Keyed by the row itself, never by its position. Position is the obvious key
 * and the wrong one: these lists are edited in place, and `list.filter(...)`
 * leaves every entry after the removed row pointing one place too far. Delete
 * the second of three and the third silently collapses while the row after it
 * — or nothing at all, past the end — opens instead. Nothing throws, so it
 * reads as the form losing your place.
 *
 * The other half of the cost is that every collection keyed the same way needs
 * a shift pass on every delete, which somebody has to remember to write for
 * each one. SkillCategoriesEditor had five such collections and shifted three.
 * Keyed by the row, a delete needs no fixing up at all, because the state went
 * with the row.
 *
 * Rows replaced wholesale — a re-parse, a fresh load — drop out rather than
 * matching something else, which is the honest answer: an entry that matches
 * no row opens no row.
 *
 * The rows must be objects, since that is what carries identity, and the list
 * they come from has to live in `$state`. That is not a style preference:
 * Svelte proxies an object on its way INTO state, so a row read out of a plain
 * array and the same row read back after a `$bindable` write has passed through
 * the parent are two different references. Held in state the whole way, every
 * read is the same proxy and identity holds across `filter`, `splice` and a
 * reassignment of the array. Every caller here does that already — the wizard
 * keeps its draft in one `$state` object — and a component test pins it.
 */
export class OpenRows<T extends object> {
	#open: SvelteSet<T>;

	constructor(initial: Iterable<T> = []) {
		this.#open = new SvelteSet(initial);
	}

	has(row: T | undefined): boolean {
		return row !== undefined && this.#open.has(row);
	}

	open(row: T): void {
		this.#open.add(row);
	}

	close(row: T): void {
		this.#open.delete(row);
	}

	toggle(row: T): void {
		if (this.#open.has(row)) this.#open.delete(row);
		else this.#open.add(row);
	}
}
