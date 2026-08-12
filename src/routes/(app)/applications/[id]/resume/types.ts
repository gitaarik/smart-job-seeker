/**
 * One recorded tailoring decision, as the page reads it.
 *
 * Shared because the card that lists them and the card that hosts it both name
 * the type, and `describeOverrides` on the server is what actually produces the
 * shape — the two components agreeing with each other is not the point, both
 * agreeing with the loader is.
 */
export interface Decision {
	id: number;
	entityType: string;
	entityId: number;
	action: string;
	reason: string | null;
	sort: number | null;
	source: string;
	label: string;
	/** Which role a bullet came from; null for things that name themselves. */
	context: string | null;
}

/** What one run reported about itself, shown only while it is still the news. */
export interface LastRun {
	/** Which ranker produced the scores — 'lexical' means the embeddings failed. */
	ranker: string;
	/** Pages it was aimed at. */
	targetPages: number;
	/** Pages it renders to, or null when the renderer could not answer. */
	pages: number | null;
}
