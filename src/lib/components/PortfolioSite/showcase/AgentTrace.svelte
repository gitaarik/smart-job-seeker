<script lang="ts">
	/**
	 * The agent trace beside the showcase header (`headerArt: 'trace'`): see
	 * `agent-trace.ts` for the picture, and the layout's `--pf-art-*`
	 * properties for its colours, which follow the palette and the scheme.
	 */
	import { agentTrace } from './agent-trace';

	const trace = agentTrace();
</script>

<svg
	class="header-art"
	width={trace.width}
	height={trace.height}
	viewBox="0 0 {trace.width} {trace.height}"
	aria-hidden="true"
	focusable="false"
>
	{#each trace.grid as x (x)}
		<rect class="grid" {x} y="0" width="1" height={trace.height} />
	{/each}
	<rect class="divider" x={trace.divider} y="0" width="1" height={trace.height} />
	{#each trace.bands as band (band.y)}
		<rect
			class="band"
			class:flagged={band.flagged}
			x={band.x}
			y={band.y}
			width={band.width}
			height={trace.lineHeight}
			rx="1.5"
		/>
	{/each}
	{#each trace.rows as row (row.y)}
		<rect
			class="icon tone-{row.tone}"
			x={row.iconX}
			y={row.y}
			width={trace.iconSize}
			height={trace.barHeight}
			rx="1.5"
		/>
		<rect
			class="name"
			x={row.nameX}
			y={row.y}
			width={row.nameWidth}
			height={trace.barHeight}
			rx="1.5"
		/>
		<rect
			class="bar tone-{row.tone}"
			class:flagged={row.flagged}
			x={row.x}
			y={row.y}
			width={row.width}
			height={trace.barHeight}
			rx="1.5"
		/>
	{/each}
</svg>

<style>
	.header-art {
		display: block;
	}

	.grid {
		fill: var(--pf-art-rule);
		opacity: 0.07;
	}

	.divider {
		fill: var(--pf-art-rule);
		opacity: 0.12;
	}

	.band {
		fill: var(--pf-art-rule);
		opacity: 0.12;
	}

	.band.flagged {
		fill: var(--pf-marker);
		opacity: 0.15;
	}

	.name {
		fill: var(--pf-art-3);
		opacity: 0.55;
	}

	.icon {
		opacity: 0.75;
	}

	.bar {
		opacity: 0.52;
	}

	.bar.flagged {
		fill: var(--pf-marker);
		opacity: 0.95;
	}

	.tone-0 {
		fill: var(--pf-art-0);
	}
	.tone-1 {
		fill: var(--pf-art-1);
	}
	.tone-2 {
		fill: var(--pf-art-2);
	}
	.tone-3 {
		fill: var(--pf-art-3);
	}
	.tone-4 {
		fill: var(--pf-art-4);
	}
</style>
