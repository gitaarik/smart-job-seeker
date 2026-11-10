<script lang="ts">
	/** "Technologies used" under a role or project. */
	let { names, heading = 'Technologies Used:' }: { names: string[]; heading?: string } = $props();
</script>

{#if names.length}
	<div>
		<h4 class="mb-3 font-semibold print:mb-2 print:text-base">{heading}</h4>
		<ul class="flex flex-wrap gap-2 print:gap-[5px]">
			{#each names as name, i (i)}
				<li
					class="rounded-xs border border-(--pf-line) px-2.5 py-1 text-[0.8125rem] text-(--pf-muted) print:px-[6px] print:py-[4px]"
				>
					{name}
				</li>
			{/each}
		</ul>
	</div>
{/if}
