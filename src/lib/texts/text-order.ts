/**
 * The order of an application's texts: its letters and its questions, as one
 * list.
 *
 * Client-safe, because the texts page merges the two tables itself and the
 * reorder action has to see the list exactly as that page did. The same rule,
 * one table at a time, is SQL in $lib/server/texts/text-order.ts for the reads
 * that list a single kind; change the two together.
 *
 * Newest added first. The page used to sort by last edit, so every save, every
 * AI regenerate and every agent edit moved the text it touched to the top: the
 * list reshuffled under the applicant while they worked through it. When a text
 * was added does not change, so it gives each one a place it keeps.
 *
 * Texts added together keep the order they came in. A pasted set of questions
 * is written in one statement with one timestamp, so the id decides between
 * them and the recruiter's question 1 stays above question 2.
 *
 * Dragging puts the whole list in the applicant's order, with `sort` set on
 * every row. A text added after that has no `sort` yet and goes on top, where
 * the add form is and where it would have gone without the manual order, until
 * the next reorder places it. Clearing every `sort` is "Sort by date".
 */

export interface OrderedText {
	itemType: 'letter' | 'question';
	id: number;
	sort: number | null;
	date_created: Date | string | null;
}

/** When a text was added; one with no date (an import: exports do not carry it) sorts last. */
function addedAt(text: OrderedText): number {
	return text.date_created === null ? -Infinity : new Date(text.date_created).getTime();
}

export function compareTexts(a: OrderedText, b: OrderedText): number {
	if (a.sort === null || b.sort === null) {
		if (a.sort !== b.sort) return a.sort === null ? -1 : 1;
	} else if (a.sort !== b.sort) {
		return a.sort - b.sort;
	}
	const [addedA, addedB] = [addedAt(a), addedAt(b)];
	if (addedA !== addedB) return addedB - addedA;
	if (a.itemType !== b.itemType) return a.itemType === 'letter' ? -1 : 1;
	return a.id - b.id;
}

/** A text's name in a posted order. Letters and questions number their ids separately. */
export function textKey(text: Pick<OrderedText, 'itemType' | 'id'>): string {
	return `${text.itemType}:${text.id}`;
}

export function parseTextKey(key: string): Pick<OrderedText, 'itemType' | 'id'> | null {
	const match = /^(letter|question):(\d+)$/.exec(key);
	return match ? { itemType: match[1] as OrderedText['itemType'], id: Number(match[2]) } : null;
}

/**
 * The whole list after the applicant moved some of it: the moved texts take the
 * places they held between them, in their new order, and everything else stays
 * where it was.
 *
 * Usually the move is the whole list. The Letters and Questions tabs move half
 * of it, and a tab opened before a text was added posts an order without that
 * text; this way the other kind keeps its places and the new text keeps its
 * own. Keys the list does not have (a text deleted meanwhile, or another
 * application's) are dropped, as is a repeat.
 */
export function placeInOrder(current: string[], moved: string[]): string[] {
	const present = new Set(current);
	const sequence = [...new Set(moved)].filter((key) => present.has(key));
	const movedKeys = new Set(sequence);
	let next = 0;
	return current.map((key) => (movedKeys.has(key) ? sequence[next++] : key));
}
