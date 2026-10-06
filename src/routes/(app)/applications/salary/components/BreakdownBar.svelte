<script lang="ts" module>
	export type BarSegment = {
		kind: 'takeHome' | 'pension' | 'tax' | 'costs';
		label: string;
		value: number;
	};
</script>

<script lang="ts">
	/**
	 * Where a year's money goes, as one bar: what you keep on the left (take-home,
	 * then pension and benefits), what leaves on the right (tax, then costs). Two
	 * bars share `scale`, so their lengths compare and so do their coloured parts.
	 *
	 * Colours checked with the dataviz palette validator in both themes: the two
	 * kept hues are told apart under every colour-blindness simulation. Tax and
	 * costs are neutral on purpose, money that leaves, and costs are hatched rather
	 * than given a second grey. The panes list every figure as text.
	 *
	 * The colour classes are global so the legend beside the bars can use them;
	 * they only resolve inside `.salary-breakdown`, which carries the colours.
	 */
	import { formatCurrency } from '$lib/salary/conversion';

	interface Props {
		label: string;
		segments: BarSegment[];
		/** The longer bar's total, so both share one scale. */
		scale: number;
		currency: string;
		caption: string;
	}

	let { label, segments, scale, currency, caption }: Props = $props();

	const shown = $derived(segments.filter((s) => s.value > 0));
	const total = $derived(shown.reduce((sum, s) => sum + s.value, 0));
	const money = (n: number) => formatCurrency(Math.round(n), currency);
	const described = $derived(
		`${label}: ${shown.map((s) => `${s.label.toLowerCase()} ${money(s.value)}`).join(', ')}, a year`
	);
</script>

<div class="grid grid-cols-[5.5rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1">
	<span class="text-sm text-[var(--dash-text)]">{label}</span>
	<div
		class="salary-breakdown flex h-4 gap-[2px]"
		style:width="{scale > 0 ? (total / scale) * 100 : 0}%"
		role="img"
		aria-label={described}
	>
		{#each shown as segment (segment.kind)}
			<div
				class="salary-seg-{segment.kind} h-full min-w-[2px] first:rounded-l last:rounded-r"
				style:flex="{segment.value} 1 0"
				title="{segment.label}: {money(segment.value)} a year"
			></div>
		{/each}
	</div>
	<span></span>
	<span class="text-xs text-[var(--dash-text-muted)]">{caption}</span>
</div>

<style>
	:global(.salary-breakdown) {
		--seg-take-home: #4f46e5;
		--seg-pension: #0d9488;
		--seg-tax: #9ca3af;
	}
	:global(.theme-dark .salary-breakdown) {
		--seg-take-home: #6366f1;
		--seg-tax: #6b7280;
	}
	:global(.salary-seg-takeHome) {
		background: var(--seg-take-home);
	}
	:global(.salary-seg-pension) {
		background: var(--seg-pension);
	}
	:global(.salary-seg-tax) {
		background: var(--seg-tax);
	}
	:global(.salary-seg-costs) {
		background: repeating-linear-gradient(135deg, var(--seg-tax) 0 3px, transparent 3px 6px);
	}
</style>
