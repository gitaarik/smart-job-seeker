/**
 * Accept the envelope a model actually returns, not the one it was asked for.
 *
 * A structured-output schema is a contract the model did not sign. Asked for
 * `{"verdicts":[…]}` — with the shape spelled out in the prompt and an explicit
 * "do NOT return an object keyed by index" — the configured model has been
 * observed returning exactly that:
 *
 *   {"0": {…}, "1": {…}}
 *
 * which is a reasonable reading of "one answer per numbered input" and useless
 * to a caller expecting an array. Retrying costs a round trip to fix something
 * that is not wrong, only differently shaped, so both readings are accepted
 * here and normalised to one positional list.
 *
 * Shared rather than copied because the quirk is a property of the model, not
 * of any one caller: the next batching script will meet it in the same form,
 * and a duplicated workaround is one that drifts.
 */
import { z } from 'zod';

/**
 * Normalise either envelope into a positional list.
 *
 * `index` is the position the item answers — its array position when the model
 * returned an array, and the numeric key when it returned an object. Items that
 * do not parse are dropped rather than failing the batch; a model that gets one
 * of twelve wrong should cost one answer, not twelve.
 *
 * Throws only when neither reading yields anything, which means the response is
 * a shape nobody anticipated and the caller should see it.
 */
export function coerceIndexedEnvelope<S extends z.ZodTypeAny>(
	raw: unknown,
	key: string,
	item: S
): { index: number; value: z.infer<S> }[] {
	const wrapped = z.object({ [key]: z.array(item) }).safeParse(raw);
	if (wrapped.success) {
		const list = wrapped.data[key] as z.infer<S>[];
		return list.map((value, index) => ({ index, value }));
	}

	if (raw && typeof raw === 'object') {
		const out: { index: number; value: z.infer<S> }[] = [];
		for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
			const index = Number(k);
			if (!Number.isInteger(index)) continue;
			const parsed = item.safeParse(v);
			if (parsed.success) out.push({ index, value: parsed.data });
		}
		if (out.length > 0) return out;
	}

	throw new Error(`unrecognised ${key} envelope: ${JSON.stringify(raw).slice(0, 200)}`);
}
