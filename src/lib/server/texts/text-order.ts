import { asc, sql, type SQL } from 'drizzle-orm';
import { application_letters, application_questions } from '$lib/server/db/schema';

/**
 * `compareTexts` from $lib/texts/text-order.ts as SQL, one table at a time, for
 * the reads that list a single kind of text: the overview page's letters, and
 * an agent's list of one application's letters or questions. The reasons are
 * there; change the two together.
 *
 * Hoisted: an inline array in a relational query's `with` becomes a readonly
 * tuple and takes the query's inferred return type with it.
 */
function textOrder(table: typeof application_letters | typeof application_questions): SQL[] {
	return [
		sql`${table.sort} ASC NULLS FIRST`,
		sql`${table.date_created} DESC NULLS LAST`,
		asc(table.id)
	];
}

export const LETTER_ORDER = textOrder(application_letters);
export const QUESTION_ORDER = textOrder(application_questions);
