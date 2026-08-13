<script lang="ts">
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheck,
		faChevronDown,
		faChevronRight,
		faCircleNotch,
		faEyeSlash
	} from '@fortawesome/free-solid-svg-icons';
	import type { ItemGroup } from '$lib/tailoring';
	import type { DocType } from '$lib/utils/profile-doc-url';

	/**
	 * What is on this job's document, item by item, with a switch on each.
	 *
	 * The diff above it lists what tailoring changed. This lists everything —
	 * including what nothing decided about, which was unreachable: an item no
	 * pass surfaced and no pass dropped left no row anywhere on the page, so the
	 * only way to reach it was to edit the tags on your profile. That changes
	 * every job that uses the version, which is the one thing a per-job document
	 * exists to avoid.
	 *
	 * It works before a tailored version exists, too. Toggling anything on a
	 * library version creates one, extending that version — so "my CV has a
	 * bullet this version leaves out, and I want it here" is a click rather than
	 * a decision about whether to start a tailoring flow.
	 *
	 * The host page must expose `setItemState`.
	 */
	let {
		items,
		docType,
		baseSlug
	}: {
		items: ItemGroup[];
		docType: DocType;
		/** What to build on, if the first toggle here is what creates the version. */
		baseSlug: string;
	} = $props();

	let open = $state(false);
	/** The row a request is in flight for, so only it shows the spinner. */
	let pending = $state<string | null>(null);

	let docLabel = $derived(docType === 'cv' ? 'CV' : 'resume');
	let rows = $derived(items.flatMap((g) => g.rows));
	/** Counted against what actually prints: a row inside a hidden role does not. */
	let showing = $derived(
		items.reduce((n, g) => n + (g.on ? g.rows.filter((r) => r.on).length : 0), 0)
	);

	function track(key: string) {
		pending = key;
		return async ({ update }: { update: (opts?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			pending = null;
		};
	}

	const rowKey = (entityType: string, entityId: number) => `${entityType}:${entityId}`;
</script>

<div class="mt-5 border-t border-[var(--dash-border)] pt-4">
	<button
		type="button"
		onclick={() => (open = !open)}
		class="flex w-full items-center gap-2 text-left"
	>
		<FontAwesomeIcon
			icon={open ? faChevronDown : faChevronRight}
			class="h-3 w-3 text-[var(--dash-text-secondary)]"
		/>
		<span class="text-[10px] font-semibold tracking-wide text-[var(--dash-text)] uppercase">
			What's on it
		</span>
		<span class="text-[10px] text-[var(--dash-text-secondary)]">
			{showing} of {rows.length} items
		</span>
	</button>

	{#if open}
		<p class="mt-2 text-[10px] text-[var(--dash-text-secondary)]">
			Changes here apply to this job only — your versions and your profile stay as they are.
		</p>

		{#each items as group (group.key)}
			<div class="mt-4">
				<div class="flex flex-wrap items-baseline justify-between gap-2">
					<p class="min-w-0 text-xs font-medium text-[var(--dash-text)]">
						{group.title}
						{#if group.subtitle}
							<span class="font-normal text-[var(--dash-text-secondary)]">· {group.subtitle}</span>
						{/if}
					</p>
					{#if group.entityType && group.entityId !== null}
						<!-- A whole role can be turned on or off here. A run may bring one
						     back only when a version tag is the sole reason it is hidden
						     (see canBringBack); one held off this document on purpose is
						     the applicant's sentence about their own history, so it is
						     named in a strip above and turned on here. -->
						<form method="POST" action="?/setItemState" use:enhance={() => track(group.key)}>
							<input type="hidden" name="entity_type" value={group.entityType} />
							<input type="hidden" name="entity_id" value={group.entityId} />
							<input type="hidden" name="doc_type" value={docType} />
							<input type="hidden" name="base_slug" value={baseSlug} />
							<input type="hidden" name="on" value={group.on ? '0' : '1'} />
							<button
								type="submit"
								disabled={pending !== null}
								class="text-[10px] whitespace-nowrap {group.on
									? 'text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)]'
									: 'text-[var(--dash-primary)]'} hover:underline disabled:opacity-70"
							>
								{#if pending === group.key}
									<FontAwesomeIcon icon={faCircleNotch} spin class="h-2.5 w-2.5" />
								{/if}
								{group.on ? 'Leave this role off' : 'Put this role on'}
							</button>
						</form>
					{/if}
				</div>

				{#if !group.on}
					<p class="mt-1 flex items-center gap-1.5 text-[10px] text-amber-600">
						<FontAwesomeIcon icon={faEyeSlash} class="h-2.5 w-2.5" />
						Not on this {docLabel} — nothing under it prints until the role does.
					</p>
				{/if}

				<ul class="mt-1.5 space-y-1 {group.on ? '' : 'opacity-50'}">
					{#each group.rows as row (rowKey(row.entityType, row.entityId))}
						{@const key = rowKey(row.entityType, row.entityId)}
						<li class="flex items-start gap-2">
							<form
								method="POST"
								action="?/setItemState"
								use:enhance={() => track(key)}
								class="shrink-0 pt-0.5"
							>
								<input type="hidden" name="entity_type" value={row.entityType} />
								<input type="hidden" name="entity_id" value={row.entityId} />
								<input type="hidden" name="doc_type" value={docType} />
								<input type="hidden" name="base_slug" value={baseSlug} />
								<input type="hidden" name="on" value={row.on ? '0' : '1'} />
								<button
									type="submit"
									disabled={pending !== null}
									title={row.on ? 'Hide this for this job' : 'Show this for this job'}
									aria-label={row.on ? `Hide ${row.label}` : `Show ${row.label}`}
									class="flex h-4 w-4 items-center justify-center rounded border transition-colors disabled:opacity-70 {row.on
										? 'border-[var(--dash-primary)] bg-[var(--dash-primary)] text-white'
										: 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/60'}"
								>
									{#if pending === key}
										<FontAwesomeIcon icon={faCircleNotch} spin class="h-2 w-2" />
									{:else if row.on}
										<FontAwesomeIcon icon={faCheck} class="h-2 w-2" />
									{/if}
								</button>
							</form>
							<div class="min-w-0 flex-1">
								<p
									class="text-[11px] {row.on
										? 'text-[var(--dash-text)]'
										: 'text-[var(--dash-text-secondary)]'}"
								>
									{row.label}
								</p>
								{#if row.reason}
									<p class="text-[10px] text-[var(--dash-text-secondary)]">
										{row.reason}{#if row.source === 'user'}&nbsp;· yours{/if}
									</p>
								{/if}
							</div>
						</li>
					{/each}
				</ul>
			</div>
		{/each}
	{/if}
</div>
