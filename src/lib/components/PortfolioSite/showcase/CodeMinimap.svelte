<script lang="ts">
	/**
	 * The code review beside the showcase header (`headerArt: 'code'`): see
	 * `code-minimap.ts` for the picture, and the layout's `--pf-art-*`
	 * properties for its colours, which follow the palette and the scheme.
	 */
	import { codeMinimap } from './code-minimap';

	const map = codeMinimap();
</script>

<svg
	class="header-art"
	width={map.width}
	height={map.height}
	viewBox="0 0 {map.width} {map.height}"
	aria-hidden="true"
	focusable="false"
>
	<rect class="divider" x={map.divider} y="0" width="1" height={map.height} />
	{#each map.bands as band (band.y)}
		<rect
			class="band"
			class:comment={band.comment}
			x={map.pane.x}
			y={band.y}
			width={map.pane.width}
			height={map.lineHeight}
		/>
	{/each}
	{#each map.bars as bar, i (i)}
		<rect
			class="bar tone-{bar.tone}"
			class:changed={bar.changed}
			x={bar.x}
			y={bar.y}
			width={bar.width}
			height={map.barHeight}
			rx="3"
		/>
	{/each}
	<circle class="marker" cx={map.marker.x} cy={map.marker.y} r="5" />
</svg>

<style>
	.header-art {
		display: block;
	}

	.divider {
		fill: var(--pf-art-rule);
		opacity: 0.1;
	}

	.band {
		fill: var(--pf-art-rule);
		opacity: var(--pf-art-band-opacity, 0.085);
	}

	.band.comment {
		fill: var(--pf-marker);
		opacity: 0.15;
	}

	.bar {
		opacity: var(--pf-art-opacity, 0.52);
	}

	.bar.changed {
		opacity: 0.9;
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

	.marker {
		fill: var(--pf-marker);
	}
</style>
