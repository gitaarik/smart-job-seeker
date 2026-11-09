<script lang="ts">
	/**
	 * Entries listed briefly in the showcase: one line each, the rest behind a
	 * click. Native `<details>`, so it opens without script and a reader's
	 * keyboard and screen reader already know it. See brief-entries.ts for what
	 * each kind of entry keeps on its line.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faChevronDown } from '@fortawesome/free-solid-svg-icons';
	import ExternalLink from '$lib/components/ExternalLink.svelte';
	import { hasDetails, type BriefEntry } from '../brief-entries';
	import TechTags from './TechTags.svelte';

	let { entries, heading }: { entries: BriefEntry[]; heading?: string } = $props();
</script>

{#if entries.length}
	<div class="brief-list">
		{#if heading}
			<h4 class="mb-3 text-lg font-semibold print:text-base">{heading}</h4>
		{/if}
		<ul class="border-t border-(--pf-line)">
			{#each entries as entry (entry.key)}
				<li class="border-b border-(--pf-line)">
					{#if hasDetails(entry)}
						<details class="group">
							<summary
								class="flex cursor-pointer list-none items-baseline justify-between gap-4 py-3 hover:text-(--pf-accent-text)"
							>
								{@render line(entry)}
								<FontAwesomeIcon
									icon={faChevronDown}
									class="h-3 w-3 shrink-0 self-center opacity-60 transition-transform group-open:rotate-180"
								/>
							</summary>
							<div class="space-y-4 pb-6">
								{#each entry.paragraphs as text, i (i)}
									<p class="leading-relaxed whitespace-pre-line">{text}</p>
								{/each}
								{#if entry.bullets.length}
									<ul class="ml-5 list-disc space-y-1.5">
										{#each entry.bullets as bullet, i (i)}
											<li>{bullet}</li>
										{/each}
									</ul>
								{/if}
								{#if entry.link}
									<p class="text-sm">
										<ExternalLink
											href={entry.link}
											class="text-(--pf-accent-text) underline-offset-4 hover:underline"
											>{entry.link
												.replace(/^https?:\/\/(www\.)?/, '')
												.replace(/\/$/, '')}</ExternalLink
										>
									</p>
								{/if}
								<TechTags names={entry.technologies} />
							</div>
						</details>
					{:else}
						<div class="py-3">{@render line(entry)}</div>
					{/if}
				</li>
			{/each}
		</ul>
	</div>
{/if}

<!-- The separators sit inside expressions: Svelte drops the whitespace a block starts with. -->
{#snippet line(entry: BriefEntry)}
	<span>
		<span class="font-semibold">{entry.name}</span>{#if entry.meta.length}<span
				class="text-sm text-(--pf-muted)">{` · ${entry.meta.join(' · ')}`}</span
			>{/if}
	</span>
{/snippet}

<style>
	/* Safari draws its own triangle unless told not to; the chevron replaces it. */
	summary::-webkit-details-marker {
		display: none;
	}
</style>
