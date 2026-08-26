/**
 * What is currently emphasised in the whole-graph view, shared by every node.
 *
 * The obvious alternative is to rebuild the 116-element `nodes` array on each
 * hover so the dim flag rides along in `data`. That works, but it hands Svelte
 * Flow a new array identity for a purely visual change, and step 2's editing
 * state would then be fighting the same array for ownership. Here the array
 * stays stable and only the components that actually care re-render.
 */
import { getContext, setContext } from 'svelte';

const KEY = Symbol('skill-graph-highlight');

export class GraphHighlight {
	/** Island under the pointer or the focus ring, or null when nothing is. */
	hovered = $state<number | null>(null);
	/** Raw search box contents, as typed. */
	query = $state('');

	get needle(): string {
		return this.query.trim().toLowerCase();
	}

	matches(label: string): boolean {
		return this.needle !== '' && label.toLowerCase().includes(this.needle);
	}

	/**
	 * Search wins over hover rather than composing with it.
	 *
	 * Composing the two reads fine until you search for something and then hover
	 * an island containing no match, at which point every node on screen dims at
	 * once and the page looks broken. One rule that is occasionally less clever
	 * beats two rules that can cancel each other out.
	 */
	dimmed(island: number, label: string): boolean {
		if (this.needle !== '') return !this.matches(label);
		return this.hovered !== null && this.hovered !== island;
	}
}

export function setGraphHighlight(): GraphHighlight {
	return setContext(KEY, new GraphHighlight());
}

export function getGraphHighlight(): GraphHighlight {
	return getContext<GraphHighlight>(KEY);
}
