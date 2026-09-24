/**
 * Presentation helpers for the retrieval record's staff view.
 *
 * Here rather than beside the record in `$lib/server/documents/retrieval-record`
 * because RetrievalSources.svelte renders in the browser, and a value import
 * from `$lib/server` is refused there. Types only come from the server side.
 */
import type { RetrievalItem } from '$lib/server/documents/retrieval-record';

/** Whether an item's score is a fused score rather than its ranker's own. */
export function isFusedItem(item: RetrievalItem): boolean {
	return item.semanticRank !== undefined || item.keywordRank !== undefined;
}

/**
 * How an item was found, for the staff view. Fused picks say which list found
 * them, in words; everything else keeps its `via` as recorded, old rows
 * included.
 */
export function describeVia(item: RetrievalItem): string {
	if (!isFusedItem(item)) return item.via;
	const ranks = [
		item.semanticRank === undefined ? '' : `meaning #${item.semanticRank}`,
		item.keywordRank === undefined ? '' : `keywords #${item.keywordRank}`
	]
		.filter(Boolean)
		.join(', ');
	const found =
		item.via === 'both'
			? 'found by both'
			: item.via === 'keyword'
				? 'found by keywords'
				: 'found by meaning';
	return `${found} (${ranks})`;
}

/**
 * An item's score, formatted for the scale it is on. A cosine, a keyword count
 * and a fused score are three different quantities, and printing them alike
 * would invite comparing them — see withGraphPick on why they never are.
 */
export function formatRetrievalScore(item: RetrievalItem): string {
	if (isFusedItem(item)) return `rrf ${item.score.toFixed(4)}`;
	return item.via === 'semantic' ? item.score.toFixed(2) : String(item.score);
}
