<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck } from '@fortawesome/free-solid-svg-icons';

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
	}

	let { skill, strength = null, variant = 'required', size = 'sm' }: Props = $props();

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

<span class="{sizeClasses} {colorClasses} inline-flex items-center gap-1 border">
	{#if showCheck}
		<FontAwesomeIcon icon={faCheck} class={iconSize} />
	{/if}
	{skill}
</span>
