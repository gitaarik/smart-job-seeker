/**
 * The shape of an application's extracted offer terms, and the rules for
 * showing them.
 *
 * The terms are written by the summariser (`$lib/server/ai-chat/
 * application-summary.ts`) and read by the overview card, so the shape and its
 * formatting live here rather than on either side of that. The same shape is
 * also inlined on the `applications.offer_terms` column, which cannot import
 * it — drizzle-kit runs outside Vite and does not resolve `$lib`.
 *
 * Every field is nullable and every one of them arrived from a model reading
 * free text, so the rules below are mostly about not dressing up a shaky
 * extraction as a firm fact.
 */

export interface OfferTerms {
	base: number | null;
	bonus: string | null;
	equity: string | null;
	currency: string | null;
	period: string | null;
	start_date: string | null;
	respond_by: string | null;
	notes: string | null;
}

/**
 * ISO 4217 codes are three letters. `coerceOffer` upper-cases and truncates
 * whatever the model returned rather than validating it, so "dollars" reaches
 * here as "DOLLARS" — and `Intl.NumberFormat` THROWS on a code it does not
 * know, which would take the whole page down over one loose extraction.
 */
export function isCurrencyCode(value: string | null): value is string {
	return !!value && /^[A-Z]{3}$/.test(value);
}

/**
 * The headline figure, or null when no amount was stated.
 *
 * **No currency fallback, deliberately.** The summariser records a currency
 * only when the employer named one, so defaulting to EUR would print a figure
 * the employer never said. That is the bug the comparison spine shipped with —
 * a bare amount annualised as "~100 EUR/yr" as though it had been quoted that
 * way. An unrecognised code is appended verbatim instead: "92,000 DOLLARS" is
 * odd-looking and true, which beats tidy and invented.
 */
export function formatOfferAmount(offer: OfferTerms): string | null {
	if (offer.base == null || !isFinite(offer.base)) return null;

	let amount = isCurrencyCode(offer.currency)
		? new Intl.NumberFormat('en-US', {
				style: 'currency',
				currency: offer.currency,
				maximumFractionDigits: 0
			}).format(offer.base)
		: new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(offer.base);

	if (offer.currency && !isCurrencyCode(offer.currency)) {
		amount = `${amount} ${offer.currency}`;
	}

	return offer.period ? `${amount} / ${offer.period}` : amount;
}

/** How loudly the response deadline should be shown, if at all. */
export type DeadlineTone = 'passed' | 'urgent' | 'soon' | 'normal';

export interface DeadlineState {
	/** Whole days from today. Negative once the date has gone by. */
	days: number;
	tone: DeadlineTone;
	/** Relative phrase for the date, e.g. "in 16 days", "today", "2 days ago". */
	label: string;
}

/**
 * Where a `respond_by` date sits relative to today.
 *
 * Date-only arithmetic against the viewer's local day: `respond_by` is a
 * calendar date, so comparing it against a timestamp would make a deadline read
 * as passed for most of the day it is still open. `Math.round` rather than
 * `floor` because a DST change shifts a midnight-to-midnight span by an hour.
 *
 * `now` is injectable so the thresholds are testable without freezing a clock.
 */
export function deadlineState(
	respondBy: string | null,
	now: Date = new Date()
): DeadlineState | null {
	if (!respondBy || !/^\d{4}-\d{2}-\d{2}$/.test(respondBy)) return null;

	const target = new Date(`${respondBy}T00:00:00`);
	if (isNaN(target.getTime())) return null;

	const today = new Date(now);
	today.setHours(0, 0, 0, 0);
	const days = Math.round((target.getTime() - today.getTime()) / 86400000);

	if (days < 0) {
		const ago = -days;
		return {
			days,
			tone: 'passed',
			label: ago === 1 ? 'yesterday' : `${ago} days ago`
		};
	}
	if (days === 0) return { days, tone: 'urgent', label: 'today' };
	if (days === 1) return { days, tone: 'urgent', label: 'tomorrow' };

	const label = `in ${days} days`;
	if (days <= 3) return { days, tone: 'urgent', label };
	if (days <= 7) return { days, tone: 'soon', label };
	return { days, tone: 'normal', label };
}

/**
 * Whether there is anything to show at all.
 *
 * `coerceOffer` already refuses an offer carrying no substantive term, so this
 * is a second line rather than the main defence — but the column is nullable
 * jsonb written over months, and a card announcing OFFER above an empty box
 * would be worse than no card.
 */
export function hasOfferContent(offer: OfferTerms | null): offer is OfferTerms {
	if (!offer) return false;
	return (
		offer.base != null ||
		!!offer.bonus ||
		!!offer.equity ||
		!!offer.start_date ||
		!!offer.respond_by ||
		!!offer.notes
	);
}
