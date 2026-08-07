<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faClock, faTimesCircle } from '@fortawesome/free-regular-svg-icons';
	import { getScoreGradient } from '$lib/score-colors';

	interface Props {
		score: number | null;
		matched?: boolean;
		size?: 'sm' | 'lg' | 'xl';
	}

	let { score = null, matched = false, size = 'lg' }: Props = $props();

	const hasScore = $derived(score !== null && score > 0);
	const colors = $derived(hasScore ? getScoreGradient(score!) : null);

	const sizeMap = {
		sm: { box: 'w-10 h-10', score: 'text-lg', label: 'text-[7px]', icon: 'w-3.5 h-3.5' },
		lg: { box: 'w-15 h-15', score: 'text-2xl', label: 'text-xs', icon: 'w-5 h-5' },
		xl: { box: 'w-18 h-18', score: 'text-3xl', label: 'text-xs', icon: 'w-6 h-6' }
	};
	const sizeClasses = $derived(sizeMap[size]);
</script>

{#if hasScore && colors}
	<!-- Matched with score -->
	<div
		class="{sizeClasses.box} flex flex-col items-center justify-center rounded-lg"
		style="background-color: {colors.bg}; color: {colors.text};{colors.glow
			? ` box-shadow: ${colors.glow};`
			: ''}"
	>
		<span class="font-bold {sizeClasses.score} leading-none">{score}%</span>
		<span class="{sizeClasses.label} whitespace-nowrap opacity-60">Match</span>
	</div>
{:else if matched}
	<!-- Matcher ran but no match -->
	<div
		class="{sizeClasses.box} flex flex-col items-center justify-center rounded-lg bg-red-50 text-red-400 dark:bg-red-950/30 dark:text-red-400/70"
	>
		<FontAwesomeIcon icon={faTimesCircle} class={sizeClasses.icon} />
		<span class="{sizeClasses.label} mt-0.5 whitespace-nowrap">No Match</span>
	</div>
{:else}
	<!-- Not yet matched -->
	<div
		class="{sizeClasses.box} flex flex-col items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-950/30 dark:text-amber-400/70"
	>
		<FontAwesomeIcon icon={faClock} class={sizeClasses.icon} />
		<span class="{sizeClasses.label} mt-0.5 whitespace-nowrap">New</span>
	</div>
{/if}
