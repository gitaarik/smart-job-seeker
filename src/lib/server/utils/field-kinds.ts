/**
 * One vocabulary for "what type is this field", shared by the two places that
 * had grown their own.
 *
 * The assistant's capability registry declared `FieldKind`
 * (`string | int | stringArray`) to drive both its wire schema and the coercion
 * behind it. The REST routes declared `FieldType` (`string | date | number`)
 * inside `buildUpdateData` to do the same job for a PATCH body. Neither knew
 * about the other, and they disagreed on the two columns they both touch:
 * `buildUpdateData` turned a date into a `Date` object while the form actions
 * wrote the `YYYY-MM-DD` string that a Drizzle `date()` column actually holds,
 * so the same field landed as two different values depending on which door the
 * edit came through.
 *
 * Merging them means one kind list that covers both — `date` from the REST
 * side, arrays from the chat side — and one coercion that every writer runs.
 *
 * Two functions, because the two callers want opposite things from a value they
 * cannot make sense of:
 *
 *  - `coerceField` is strict and reports the failure. A person filling in a form
 *    should be told their date is unreadable, not have it silently cleared.
 *  - `coerceValue` swallows it to null. That is the older, model-facing
 *    behaviour and it stays: a model that writes "sometime in 2019" into a date
 *    field is proposing nothing, and the proposal card showing the field
 *    unchanged beats the whole turn failing.
 */

import { z } from 'zod';

export type FieldKind = 'string' | 'int' | 'date' | 'stringArray';

/**
 * The types sent to an LLM provider.
 *
 * Unions and nullish survive conversion to JSON Schema; transforms do not —
 * LangChain throws "Transforms cannot be represented in JSON Schema", which is
 * how the first version of the proposal system failed every capable turn. So
 * these stay plain, and permissive where models are known to wander (a bare
 * "remote" instead of `["remote"]`, a quoted "55,000" instead of 55000).
 * Getting those back to real types is `coerceValue`'s job, on our side of the
 * boundary.
 */
export const WIRE_TYPES: Record<FieldKind, z.ZodTypeAny> = {
	string: z.union([z.string(), z.number()]).nullish(),
	int: z.union([z.number(), z.string()]).nullish(),
	date: z.string().nullish(),
	stringArray: z.union([z.array(z.string()), z.string()]).nullish()
};

export type CoerceResult = { ok: true; value: unknown } | { ok: false; error: string };

/** `YYYY-MM-DD`, which is both what `<input type="date">` posts and what a Drizzle `date()` column stores. */
const DATE_ONLY = /^(\d{4}-\d{2}-\d{2})/;

/**
 * Normalize one field to the type the database expects, or say why it can't be.
 *
 * Empty is not a failure: null, undefined and "" all mean "clear this column",
 * which is the only reading under which removing a wrong value works.
 */
export function coerceField(kind: FieldKind, value: unknown): CoerceResult {
	if (value === null || value === undefined || value === '') return { ok: true, value: null };

	if (kind === 'int') {
		// Models quote their numbers and add separators despite being told not to,
		// and an HTML number input posts a string regardless.
		const n = typeof value === 'string' ? Number.parseFloat(value.replace(/[,\s]/g, '')) : value;
		if (typeof n !== 'number' || !Number.isFinite(n)) {
			return { ok: false, error: `"${String(value)}" is not a number` };
		}
		return { ok: true, value: Math.round(n) };
	}

	if (kind === 'date') {
		// These columns are Drizzle `date()`, which is string mode: they hold
		// "YYYY-MM-DD" and nothing else. Passing a Date instead leaves the driver
		// to serialize it in the server's local timezone, which moves the stored
		// day by one either side of UTC — a birthday that drifts is worse than one
		// that fails.
		if (value instanceof Date) {
			if (Number.isNaN(value.getTime())) return { ok: false, error: 'Invalid date' };
			return { ok: true, value: value.toISOString().slice(0, 10) };
		}
		const text = String(value).trim();
		const match = DATE_ONLY.exec(text);
		if (!match) return { ok: false, error: `"${text}" is not a date (expected YYYY-MM-DD)` };
		return { ok: true, value: match[1] };
	}

	if (kind === 'stringArray') {
		// gpt-oss returns a bare value where a list belongs, and sometimes a
		// comma-joined string instead of a list.
		const list = Array.isArray(value) ? value : String(value).split(',');
		const cleaned = list.map((item) => String(item).trim()).filter(Boolean);
		return { ok: true, value: cleaned.length > 0 ? cleaned : null };
	}

	const trimmed = String(value).trim();
	return { ok: true, value: trimmed === '' ? null : trimmed };
}

/**
 * `coerceField` for callers with no one to report a failure to. An
 * uncoercible value becomes null — "the model didn't say" rather than an error.
 */
export function coerceValue(kind: FieldKind, value: unknown): unknown {
	const result = coerceField(kind, value);
	return result.ok ? result.value : null;
}

/**
 * Coerce a whole partial patch, keeping only the fields the caller actually
 * sent. An absent key means "leave this column alone"; a present null means
 * "clear it", and the two must not collapse into each other — a proposal that
 * mentions one field would otherwise wipe the other twelve.
 */
export function coerceFields(
	kinds: Record<string, FieldKind>,
	input: Record<string, unknown>
): { ok: true; values: Record<string, unknown> } | { ok: false; field: string; error: string } {
	const values: Record<string, unknown> = {};

	for (const [field, kind] of Object.entries(kinds)) {
		if (!(field in input) || input[field] === undefined) continue;
		const result = coerceField(kind, input[field]);
		if (!result.ok) return { ok: false, field, error: result.error };
		values[field] = result.value;
	}

	return { ok: true, values };
}
