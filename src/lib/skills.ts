/**
 * Skill-name normalization, shared by anything that has to decide whether two
 * differently-written skills are the same one.
 *
 * Client-safe on purpose: it lives here rather than beside its first caller so
 * a Svelte component can dedupe technology chips by the *same* rule the
 * matching pipeline uses. Deduping by a looser rule would let a profile collect
 * "claude-code" next to "Claude Code", which matching then treats as one skill
 * and the CV shows as two.
 */

/**
 * Normalize a skill for use as a vocabulary/dedupe key.
 *
 * Kept in sync with normalizeSkill() in cloud/src/server/job/match-utils.ts —
 * expanded skills are matched downstream by that exact-match logic, so the
 * normalization must agree.
 */
export function normalizeSkill(skill: string): string {
	return skill
		.toLowerCase()
		.replace(/[^a-z0-9+#]/g, '')
		.trim();
}

/**
 * Separators that plausibly join several skills into one entry.
 *
 * `+` is deliberately absent. `normalizeSkill` keeps `+` and `#` precisely
 * because C++ and C# need them, and any rule that splits on `+` destroys both.
 * `and` is matched on word boundaries so "Brandenburg" and "Hand-off" survive.
 */
const COMPOUND_SEPARATOR = /\s*(?:[/|&,]|\band\b)\s*/;

/** Beyond this it is prose, not a skill entry. */
const MAX_PARTS = 4;

/**
 * One way of reading a compound entry. `literal` is the text between
 * separators; the other two restore a word the writer shared across the parts
 * rather than repeating it.
 */
export interface CompoundReading {
	kind: 'literal' | 'shared-tail' | 'shared-head';
	parts: string[];
}

/**
 * Restore a word the writer factored out.
 *
 * "Unit / Integration Testing" is two skills, but the literal split yields
 * "Unit" — a word that names nothing. The head noun was written once and meant
 * twice, so the shorter part borrows the donor's spare words: "Unit Testing".
 * `head` is the mirror image, for "GitLab CI/CD" → "GitLab CD".
 *
 * Returns null when nothing was shared, so a caller can tell "no such reading"
 * from "the same list again".
 */
function shareWords(parts: string[], where: 'tail' | 'head'): string[] | null {
	const donorAt = where === 'tail' ? parts.length - 1 : 0;
	const donor = parts[donorAt].split(/\s+/);
	let changed = false;

	const out = parts.map((part, i) => {
		if (i === donorAt) return part;
		const words = part.split(/\s+/);
		const spare = donor.length - words.length;
		if (spare <= 0) return part;
		changed = true;
		return where === 'tail'
			? `${part} ${donor.slice(donor.length - spare).join(' ')}`
			: `${donor.slice(0, spare).join(' ')} ${part}`;
	});

	return changed ? out : null;
}

/**
 * Read a skill entry that may name more than one skill.
 *
 * People write "Vitest / Jest" to say they have used both without spending two
 * rows on it, and "Agile/Scrum" because that is how the industry writes it.
 * Normalization then flattens the whole string to one opaque token —
 * `vitestjest` — which matches nothing and, worse, keeps its parts out of the
 * vocabulary entirely: measured on dev, "SvelteKit" and "Vitest" existed
 * nowhere except inside a compound.
 *
 * This returns CANDIDATE readings, not an answer. Every one of them is a guess
 * that has to be checked against the vocabulary before it is believed — "R&D"
 * splits as cleanly as "HTML/CSS" and means nothing of the kind. The caller
 * resolves the parts and keeps the reading that survives; see
 * `scripts/propose-skill-splits.ts`.
 *
 * Returns an empty array when the entry names one skill.
 */
export function splitCompoundSkill(label: string): CompoundReading[] {
	const literal = label
		.split(COMPOUND_SEPARATOR)
		.map((p) => p.trim())
		.filter(Boolean);
	if (literal.length < 2 || literal.length > MAX_PARTS) return [];
	// A part that normalizes away ("React / -") is punctuation, not a skill, and
	// its presence means the split misread the string.
	if (literal.some((p) => !normalizeSkill(p))) return [];

	const readings: CompoundReading[] = [{ kind: 'literal', parts: literal }];
	const tail = shareWords(literal, 'tail');
	if (tail) readings.push({ kind: 'shared-tail', parts: tail });
	const head = shareWords(literal, 'head');
	if (head) readings.push({ kind: 'shared-head', parts: head });
	return readings;
}
