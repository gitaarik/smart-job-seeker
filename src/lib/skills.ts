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
