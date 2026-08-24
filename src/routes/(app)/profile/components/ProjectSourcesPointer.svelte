<!--
	Where a project's evidence goes, said on the tab that does not hold it.

	The Details tab shows the repository fetch and the code-reading proposals, so
	it reads as if GitHub were the only way in — and the upload, the repo scan and
	the notes sit one tab over under a name that does not say "documents". The
	person who built the feature went looking for it here and did not find it.
	A line that names the tab, says what belongs there and counts what is there
	already is the cheapest fix that actually fixes it.
-->
<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faFolderOpen } from '@fortawesome/free-solid-svg-icons';
	import type { ResolvedPathname } from '$app/types';

	let { count, href }: { count: number; href: ResolvedPathname } = $props();
</script>

<div
	class="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md border border-dashed border-[var(--dash-border)] px-3 py-2 text-sm"
>
	<FontAwesomeIcon icon={faFolderOpen} class="h-4 w-4 shrink-0 text-[var(--dash-text-muted)]" />
	{#if count > 0}
		<span class="text-[var(--dash-text)]">
			{count}
			{count === 1 ? 'source' : 'sources'} attached to this project.
		</span>
		<a {href} class="text-[var(--dash-primary)] hover:underline">
			Add files, code or notes on Files &amp; code
		</a>
	{:else}
		<span class="text-[var(--dash-text-secondary)]">
			Nothing attached yet. Task briefs, forms you filled in, emails, PDFs, code and notes all count
			as evidence for this project —
		</span>
		<a {href} class="text-[var(--dash-primary)] hover:underline">add them on Files &amp; code</a>
	{/if}
</div>
