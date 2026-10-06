<script lang="ts">
	/**
	 * One assumption: a label, a number and what the number is in. Clearing the
	 * input changes nothing, and leaving it blank puts the number back, so a
	 * half-typed value never turns into a 0 the comparison then runs on.
	 */
	import { INPUT_CLASS, numberOrNull } from './salary-ui';

	interface Props {
		label: string;
		/** Under the label, small: what the number covers. */
		hint?: string;
		value: number;
		/** What the number is in, inside the input on the right: "%", "a year". */
		suffix?: string;
		min?: number;
		max?: number;
		step?: number;
		onchange: (value: number) => void;
	}

	let { label, hint, value, suffix, min = 0, max, step = 1, onchange }: Props = $props();
	const id = $props.id();
</script>

<div class="flex items-center justify-between gap-3">
	<label for={id} class="min-w-0 text-sm text-[var(--dash-text-secondary)]">
		{label}
		{#if hint}
			<span class="block text-xs text-[var(--dash-text-muted)]">{hint}</span>
		{/if}
	</label>
	<div class="relative w-32 flex-shrink-0">
		<input
			{id}
			type="number"
			{min}
			{max}
			{step}
			{value}
			oninput={(e) => {
				const n = numberOrNull(e.currentTarget.value);
				if (n != null) onchange(n);
			}}
			onblur={(e) => {
				if (numberOrNull(e.currentTarget.value) == null) e.currentTarget.value = String(value);
			}}
			class="{INPUT_CLASS} w-full text-right {suffix ? 'pr-14' : ''}"
		/>
		{#if suffix}
			<span
				class="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-[var(--dash-text-muted)]"
				>{suffix}</span
			>
		{/if}
	</div>
</div>
