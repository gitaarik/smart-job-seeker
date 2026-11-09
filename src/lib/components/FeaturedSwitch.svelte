<script lang="ts">
	/**
	 * The Featured switch on a project's or a role's page: whether the public
	 * site shows it under Selected work.
	 *
	 * Drawn like the Site switch it sits under, and written by the caller the
	 * same way. Featuring is relative: once anything is featured, the site
	 * lists every project not featured as a line, which the note under the
	 * switch says, because that is the part nobody would guess from the word.
	 * A role says one thing more: it stays in the career as well.
	 */
	interface Props {
		featured: boolean;
		/** Whether the entry is on the site at all; off it, featuring shows nothing. */
		onSite: boolean;
		ontoggle: (featured: boolean) => void;
		/** What the switch is on, for the note under it. */
		entry?: 'project' | 'role';
	}

	let { featured, onSite, ontoggle, entry = 'project' }: Props = $props();
</script>

<div class="mt-3">
	<!-- Still switchable off while off the site, so an old pick can be cleared. -->
	<button
		type="button"
		onclick={() => ontoggle(!featured)}
		aria-pressed={featured}
		disabled={!onSite && !featured}
		class="flex w-full items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-50"
	>
		<span class="text-xs text-[var(--dash-text)]">Featured on the site</span>
		<span
			class="relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors {featured
				? 'bg-amber-500'
				: 'bg-[var(--dash-border)]'}"
		>
			<span
				class="absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all {featured
					? 'left-3.5'
					: 'left-0.5'}"
			></span>
		</span>
	</button>
	<p class="mt-1 text-[10px] leading-snug text-[var(--dash-text-muted)]">
		{#if !onSite}
			Not on your site, so featuring it shows nothing.
		{:else if entry === 'role'}
			{#if featured}
				Shown under Selected work, near the top of your site, and in your career as well. Projects
				you have not featured are listed as one line each.
			{:else}
				For work that is the role itself rather than a project in it: it joins Selected work near
				the top of your site, and stays in your career too.
			{/if}
		{:else if featured}
			Printed in full under Selected work, near the top of your site. Projects you have not featured
			are listed as one line each.
		{:else}
			Feature your best few: they open your site under Selected work, and the others are listed as
			one line each.
		{/if}
	</p>
</div>
