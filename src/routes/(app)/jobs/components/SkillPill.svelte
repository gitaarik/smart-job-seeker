<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck } from '@fortawesome/free-solid-svg-icons';
	import { adjacencyExplanation, matchExplanation, type MatchVia } from '$lib/match-provenance';

	/**
	 * - "strong": skill matched + the user is proficient/expert
	 * - "weak": skill matched + the user is beginner/intermediate
	 * - null: not matched
	 */
	type Strength = 'strong' | 'weak' | null;
	/** Affects only the unmatched-pill colour */
	type Variant = 'required' | 'preferred';
	type Size = 'sm' | 'md';

	interface Props {
		skill: string;
		strength?: Strength;
		variant?: Variant;
		size?: Size;
		/**
		 * HOW the skill matched, which is a different axis from `strength`.
		 * `strength` says how good the applicant is at it; this says why it counted
		 * at all. Colour is already spent on the first axis, so this one gets a
		 * dotted underline and the title text — deliberately quiet, because it
		 * explains a match rather than announcing one.
		 */
		via?: MatchVia | null;
		/** The applicant's own skill that reached it, for `alias` and `ontology`. */
		from?: string | null;
		/**
		 * For an UNMATCHED skill: one the applicant holds that is `related` to it.
		 *
		 * Never renders a check and never changes the colour — this pill is still a
		 * gap, and Docker does not mean the applicant knows Kubernetes. It only
		 * stops the gap being a dead end.
		 */
		relatedFrom?: string | null;
	}

	let {
		skill,
		strength = null,
		variant = 'required',
		size = 'sm',
		via = null,
		from = null,
		relatedFrom = null
	}: Props = $props();

	const why = $derived(
		matchExplanation(via, from) ?? (strength === null ? adjacencyExplanation(relatedFrom) : null)
	);

	const sizeClasses = $derived(
		size === 'md' ? 'px-3 py-1 text-sm rounded-lg' : 'px-2 py-1 text-xs rounded'
	);
	const iconSize = $derived(size === 'md' ? 'w-3 h-3' : 'w-2.5 h-2.5');

	const colorClasses = $derived(
		strength === 'strong'
			? 'bg-[var(--dash-success-light)] text-[var(--dash-success)] border-[var(--dash-success)]/30'
			: strength === 'weak'
				? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-500/30'
				: variant === 'preferred'
					? 'bg-[var(--dash-primary-light)] text-[var(--dash-primary)] border-[var(--dash-primary)]/30'
					: 'bg-[var(--dash-bg)] text-[var(--dash-text)] border-[var(--dash-border)]'
	);

	const showCheck = $derived(strength === 'strong' || strength === 'weak');
</script>

<span
	class="{sizeClasses} {colorClasses} inline-flex items-center gap-1 border"
	class:decoration-dotted={!!why}
	class:underline={!!why}
	class:underline-offset-2={!!why}
	title={why}
>
	{#if showCheck}
		<FontAwesomeIcon icon={faCheck} class={iconSize} />
	{/if}
	{skill}
</span>
