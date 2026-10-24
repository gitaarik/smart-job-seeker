<script lang="ts">
	/** "Technologies used" under a role or project. */
	let { names, heading = 'Technologies Used:' }: { names: string[]; heading?: string } = $props();
</script>

{#if names.length}
	<div>
		<h4 class="mb-3 text-lg font-semibold print:mb-2 print:text-base">{heading}</h4>
		<ul class="flex flex-wrap gap-2 print:gap-[5px]">
			{#each names as name, i (i)}
				<li
					class="rounded border border-(--pf-bright-hover) bg-(--pf-shade) px-2 py-1 text-sm hover:bg-(--pf-surface) print:px-[6px] print:py-[4px]"
				>
					{name}
				</li>
			{/each}
		</ul>
	</div>
{/if}
