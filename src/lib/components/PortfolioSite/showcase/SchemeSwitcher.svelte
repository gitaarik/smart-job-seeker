<script lang="ts">
	/**
	 * The visitor's light / dark / system switch, ported from the standalone
	 * site's ThemeSwitcher: one round button whose icon slides between a sun, a
	 * moon and a half circle, and a label that shows for two seconds after a
	 * click.
	 *
	 * From "system" the first click goes to the scheme the visitor is NOT
	 * seeing, so every click but the last changes what is on screen.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCircleHalfStroke, faMoon, faSun } from '@fortawesome/free-solid-svg-icons';
	import type { SchemePreference } from './scheme';

	interface Props {
		preference: SchemePreference;
		/** What "auto" resolves to right now. */
		system: 'light' | 'dark';
		onchange: (next: SchemePreference) => void;
	}

	let { preference, system, onchange }: Props = $props();

	let showLabel = $state(false);
	let fadeTimeout: ReturnType<typeof setTimeout> | undefined;

	const other = $derived(system === 'light' ? 'dark' : 'light');
	const actual = $derived(preference === 'auto' ? system : preference);

	function next(): SchemePreference {
		if (preference === 'auto') return other;
		if (preference === other) return system;
		return 'auto';
	}

	function toggle() {
		onchange(next());
		clearTimeout(fadeTimeout);
		showLabel = true;
		fadeTimeout = setTimeout(() => (showLabel = false), 2000);
	}

	// Which icon is in the window: the three are stacked and the stack slides.
	const OFFSET = { light: '0', dark: '-2.5rem', auto: '-5rem' } as const;
	const LABEL_OFFSET = { light: '0', dark: '-1rem', auto: '-2rem' } as const;

	const label = $derived(
		preference === 'auto' ? `Auto (${actual})` : preference === 'light' ? 'Light' : 'Dark'
	);
	const ariaLabel = $derived(
		preference === 'light'
			? 'Theme: Light (click to switch)'
			: preference === 'dark'
				? 'Theme: Dark (click to switch)'
				: `Theme: Auto (currently ${actual}, click to switch)`
	);
</script>

<div class="fixed top-4 right-4 z-50 print:hidden">
	<div
		class="absolute top-1/2 right-14 flex -translate-y-1/2 items-center gap-2 overflow-hidden rounded-lg border border-(--pf-glass) bg-(--pf-glass-light) px-3 py-2 shadow-lg backdrop-blur-md transition-all duration-300 ease-out"
		class:opacity-0={!showLabel}
		aria-hidden="true"
	>
		<div class="relative h-4 w-4 overflow-hidden">
			<span
				class="absolute block transition-[top] duration-250"
				style:top={LABEL_OFFSET[preference]}
			>
				<span class="flex h-4 w-4 items-center justify-center"
					><FontAwesomeIcon icon={faSun} class="h-3 w-3" /></span
				>
				<span class="flex h-4 w-4 items-center justify-center"
					><FontAwesomeIcon icon={faMoon} class="h-3 w-3" /></span
				>
				<span class="flex h-4 w-4 items-center justify-center"
					><FontAwesomeIcon icon={faCircleHalfStroke} class="h-3 w-3" /></span
				>
			</span>
		</div>
		<span class="text-sm font-medium whitespace-nowrap">{label}</span>
	</div>

	<button
		type="button"
		class="relative block h-[42px] w-[42px] cursor-pointer overflow-hidden rounded-3xl border border-(--pf-glass) bg-(--pf-glass-light) shadow transition-all duration-200 hover:scale-105 focus:outline-none active:scale-95"
		aria-label={ariaLabel}
		title={ariaLabel}
		onclick={toggle}
	>
		<span class="absolute block transition-[top] duration-250" style:top={OFFSET[preference]}>
			<span class="flex h-10 w-10 items-center justify-center"
				><FontAwesomeIcon icon={faSun} class="w-4" /></span
			>
			<span class="flex h-10 w-10 items-center justify-center"
				><FontAwesomeIcon icon={faMoon} class="w-4" /></span
			>
			<span class="flex h-10 w-10 items-center justify-center"
				><FontAwesomeIcon icon={faCircleHalfStroke} class="w-4" /></span
			>
		</span>
	</button>
</div>
