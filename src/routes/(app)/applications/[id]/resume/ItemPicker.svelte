<script lang="ts">
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import {
		faCheck,
		faChevronDown,
		faChevronRight,
		faCircleNotch,
		faEyeSlash,
		faTriangleExclamation
	} from '@fortawesome/free-solid-svg-icons';
	import type { ItemGroup, ItemRow, ItemSection } from '$lib/tailoring';
	import { OVERRIDE_ENTITIES } from '$lib/version-overrides';
	import type { DocType } from '$lib/utils/profile-doc-url';

	/**
	 * What is on this job's document, item by item, with a switch on each.
	 *
	 * The diff lists what tailoring changed. This lists everything —
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
	 * Laid out in the document's own parts. Roles start folded, because a career's
	 * worth of bullets and tech lines is most of the page, and a role's header
	 * already says what it holds; skills stay open, because a group of names reads
	 * at a glance.
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

	/** The row a request is in flight for, so only it shows the spinner. */
	let pending = $state<string | null>(null);
	let docLabel = $derived(docType === 'cv' ? 'CV' : 'resume');

	const SECTIONS: { key: ItemSection; title: string }[] = [
		{ key: 'experience', title: 'Experience' },
		{ key: 'projects', title: 'Side projects' },
		{ key: 'skills', title: 'Skills' },
		{ key: 'education', title: 'Education' }
	];
	let sections = $derived(
		SECTIONS.map((section) => ({
			...section,
			groups: items.filter((group) => group.section === section.key)
		})).filter((section) => section.groups.length > 0)
	);

	/** Roles unfolded this visit. */
	let openRoles = $state<string[]>([]);
	/** Skill groups showing the skills kept off every document. */
	let openKeptOff = $state<string[]>([]);
	const flip = (list: string[], key: string) =>
		list.includes(key) ? list.filter((k) => k !== key) : [...list, key];

	/**
	 * A technology or a skill is one word, and a column of one-word rows buries
	 * the prose around it, so both are laid out as the document lays them out:
	 * one wrapped line of names.
	 */
	const isName = (row: ItemRow) =>
		row.entityType === OVERRIDE_ENTITIES.technology || row.entityType === OVERRIDE_ENTITIES.skill;
	const prose = (group: ItemGroup): ItemRow[] => group.rows.filter((r) => !isName(r));
	const names = (group: ItemGroup): ItemRow[] => group.rows.filter(isName);
	/**
	 * Kept off every document by the applicant's own tags, and not put on this
	 * one. A skills block carries dozens, and listing them beside the ones that
	 * print hides the ones that print.
	 */
	const keptOff = (row: ItemRow) => !!row.profileOnly && !row.on;
	const countOn = (rows: ItemRow[]) => rows.filter((r) => r.on).length;

	/**
	 * Skill group titles that print more than once.
	 *
	 * A profile can hold two groups under one name on purpose, one per version —
	 * a full Backend list and a short one — and the tags make sure only one prints
	 * on any document. A switch here can put the other one on as well, and the
	 * page then has the same heading twice. Said rather than prevented: swapping
	 * one for the other is a legitimate thing to do for one job, and it takes a
	 * moment where both are on.
	 */
	let repeatedTitles = $derived.by(() => {
		const printing = items
			.filter((group) => group.section === 'skills' && group.on)
			.map((group) => group.title.trim().toLowerCase());
		return printing.filter((title, i) => printing.indexOf(title) !== i);
	});

	function track(key: string) {
		pending = key;
		return async ({ update }: { update: (opts?: { reset?: boolean }) => Promise<void> }) => {
			await update({ reset: false });
			pending = null;
		};
	}

	const rowKey = (entityType: string, entityId: number) => `${entityType}:${entityId}`;
</script>

<!-- The fields every switch posts: which item, and the state it is asking for. -->
{#snippet itemFields(entityType: string, entityId: number, turnOn: boolean)}
	<input type="hidden" name="entity_type" value={entityType} />
	<input type="hidden" name="entity_id" value={entityId} />
	<input type="hidden" name="doc_type" value={docType} />
	<input type="hidden" name="base_slug" value={baseSlug} />
	<input type="hidden" name="on" value={turnOn ? '1' : '0'} />
{/snippet}

{#snippet proseRow(row: ItemRow)}
	{@const key = rowKey(row.entityType, row.entityId)}
	<li class="flex items-start gap-2">
		<form
			method="POST"
			action="?/setItemState"
			use:enhance={() => track(key)}
			class="shrink-0 pt-0.5"
		>
			{@render itemFields(row.entityType, row.entityId, !row.on)}
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
{/snippet}

{#snippet nameChip(row: ItemRow)}
	{@const key = rowKey(row.entityType, row.entityId)}
	<form method="POST" action="?/setItemState" use:enhance={() => track(key)}>
		{@render itemFields(row.entityType, row.entityId, !row.on)}
		<button
			type="submit"
			disabled={pending !== null}
			title={row.reason || (row.on ? 'Hide this for this job' : 'Show this for this job')}
			aria-label={row.on ? `Hide ${row.label}` : `Show ${row.label}`}
			aria-pressed={row.on}
			class="rounded border px-1.5 py-0.5 text-[10px] transition-colors disabled:opacity-70 {row.on
				? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-text)]'
				: 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] line-through hover:border-[var(--dash-primary)]/60'}"
		>
			{#if pending === key}
				<FontAwesomeIcon icon={faCircleNotch} spin class="h-2 w-2" />
			{/if}
			{row.label}
		</button>
	</form>
{/snippet}

<!-- A switch for a whole role or skill group: nothing under it prints while it is off. -->
{#snippet groupSwitch(group: ItemGroup, noun: string)}
	{#if group.entityType && group.entityId !== null}
		<form method="POST" action="?/setItemState" use:enhance={() => track(group.key)}>
			{@render itemFields(group.entityType, group.entityId, !group.on)}
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
				{group.on ? `Leave this ${noun} off` : `Put this ${noun} on`}
			</button>
		</form>
	{/if}
{/snippet}

<div class="space-y-6">
	{#each sections as section (section.key)}
		<section>
			<h4 class="mb-2 text-[10px] font-semibold tracking-wide text-[var(--dash-text)] uppercase">
				{section.title}
			</h4>

			{#if section.key === 'experience'}
				<div class="space-y-2">
					{#each section.groups as group (group.key)}
						{@const bullets = prose(group)}
						{@const tech = names(group)}
						{@const open = openRoles.includes(group.key)}
						<div class="rounded-lg border border-[var(--dash-border)] px-3 py-2">
							<div class="flex flex-wrap items-center gap-x-3 gap-y-1">
								<button
									type="button"
									onclick={() => (openRoles = flip(openRoles, group.key))}
									aria-expanded={open}
									class="flex min-w-0 grow basis-60 items-center gap-2 text-left"
								>
									<FontAwesomeIcon
										icon={open ? faChevronDown : faChevronRight}
										class="h-2.5 w-2.5 shrink-0 text-[var(--dash-text-secondary)]"
									/>
									<span class="min-w-0 text-xs font-medium text-[var(--dash-text)]">
										{group.title}
										{#if group.subtitle}
											<span class="font-normal text-[var(--dash-text-secondary)]"
												>· {group.subtitle}</span
											>
										{/if}
									</span>
								</button>
								<span class="text-[10px] text-[var(--dash-text-secondary)]">
									{countOn(bullets)} of {bullets.length}
									{bullets.length === 1 ? 'bullet' : 'bullets'}{#if tech.length > 0}
										· {countOn(tech)} of {tech.length} tech{/if}
								</span>
								<!-- A whole role can be turned on or off here. A run may bring one
								     back only when a version tag is the sole reason it is hidden
								     (see canBringBack); one held off this document on purpose is
								     the applicant's sentence about their own history, so it is
								     named in the checks above and turned on here. -->
								{@render groupSwitch(group, 'role')}
							</div>

							{#if !group.on}
								<p class="mt-1 flex items-center gap-1.5 text-[10px] text-amber-600">
									<FontAwesomeIcon icon={faEyeSlash} class="h-2.5 w-2.5" />
									Not on this {docLabel} — nothing under it prints until the role does.
								</p>
							{/if}

							{#if open}
								<ul class="mt-2 space-y-1 {group.on ? '' : 'opacity-50'}">
									{#each bullets as row (rowKey(row.entityType, row.entityId))}
										{@render proseRow(row)}
									{/each}
								</ul>
								{#if tech.length > 0}
									<div
										class="mt-1.5 flex flex-wrap items-center gap-1 {group.on ? '' : 'opacity-50'}"
									>
										<span
											class="text-[10px] tracking-wide text-[var(--dash-text-secondary)] uppercase"
										>
											Tech
										</span>
										{#each tech as row (rowKey(row.entityType, row.entityId))}
											{@render nameChip(row)}
										{/each}
									</div>
								{/if}
							{/if}
						</div>
					{/each}
				</div>
			{:else if section.key === 'skills'}
				<div class="space-y-3">
					{#each section.groups as group (group.key)}
						{@const shown = group.rows.filter((r) => !keptOff(r))}
						{@const folded = group.rows.filter(keptOff)}
						{@const unfolded = openKeptOff.includes(group.key)}
						<div>
							<div class="flex flex-wrap items-baseline justify-between gap-2">
								<p class="min-w-0 text-xs font-medium text-[var(--dash-text)]">
									{group.title}
									<span class="font-normal text-[var(--dash-text-secondary)]"
										>· {countOn(group.rows)} of {group.rows.length}</span
									>
								</p>
								{@render groupSwitch(group, 'group')}
							</div>

							{#if !group.on}
								<p class="mt-1 flex items-center gap-1.5 text-[10px] text-amber-600">
									<FontAwesomeIcon icon={faEyeSlash} class="h-2.5 w-2.5" />
									Not on this {docLabel}. None of these print until the group does.
								</p>
							{:else if repeatedTitles.includes(group.title.trim().toLowerCase())}
								<p class="mt-1 flex items-center gap-1.5 text-[10px] text-amber-600">
									<FontAwesomeIcon icon={faTriangleExclamation} class="h-2.5 w-2.5" />
									Another “{group.title}” group prints too, so this heading appears twice.
								</p>
							{/if}

							<div class="mt-1.5 flex flex-wrap items-center gap-1 {group.on ? '' : 'opacity-50'}">
								{#each shown as row (rowKey(row.entityType, row.entityId))}
									{@render nameChip(row)}
								{/each}
								{#if unfolded}
									{#each folded as row (rowKey(row.entityType, row.entityId))}
										{@render nameChip(row)}
									{/each}
								{/if}
								{#if folded.length > 0}
									<button
										type="button"
										onclick={() => (openKeptOff = flip(openKeptOff, group.key))}
										aria-expanded={unfolded}
										class="px-1 text-[10px] text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] hover:underline"
									>
										{unfolded ? 'Fold away' : `+${folded.length}`} kept off your documents
									</button>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{:else}
				{#each section.groups as group (group.key)}
					{#if group.note}
						<p class="mb-1.5 text-[10px] text-[var(--dash-text-secondary)]">{group.note}</p>
					{/if}
					<ul class="space-y-1">
						{#each group.rows as row (rowKey(row.entityType, row.entityId))}
							{@render proseRow(row)}
						{/each}
					</ul>
				{/each}
			{/if}
		</section>
	{/each}
</div>
