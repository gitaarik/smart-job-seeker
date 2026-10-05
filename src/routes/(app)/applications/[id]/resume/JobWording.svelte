<script lang="ts">
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faCircleNotch } from '@fortawesome/free-solid-svg-icons';
	import { sameWording, variantPreview, wordingText, type WordingState } from '$lib/field-variants';
	import type { DocType } from '$lib/utils/profile-doc-url';

	/**
	 * What this job's document says for one field that can be worded more than
	 * one way — its title, a role's position — with a way to change it for this
	 * job only.
	 *
	 * Three things to choose from, in one list: the profile's own value, the
	 * alternatives the profile already holds for the field, and something
	 * written here. The last is why this is on the job's page at all. A title an
	 * agency asks for belongs to the job it asked for, and getting it onto the
	 * document used to take the profile (to add it) and then the version (to pick
	 * it). Written here it is saved with the field's other wordings and used for
	 * this job in one step, so the next job that wants it finds it in the list.
	 *
	 * The switches beside it decide whether an item prints; this decides what a
	 * field that always prints says. It posts to the same page and makes the
	 * job's version the same way a switch does.
	 *
	 * The host page must expose `setWording`.
	 */
	let {
		wording,
		docType,
		baseSlug
	}: {
		wording: WordingState;
		docType: DocType;
		/** What to build on, if a change here is what creates the version. */
		baseSlug: string;
	} = $props();

	let open = $state(false);
	/** The choice a request is in flight for: 'own', 'new' or a wording's id. */
	let pending = $state<string | null>(null);
	let error = $state('');
	let draft = $state('');

	let docLabel = $derived(docType === 'cv' ? 'CV' : 'resume');
	let current = $derived(wordingText(wording));
	let what = $derived(wording.label.toLowerCase());
	// Short fields read whole; a summary is shown by its first lines.
	const shown = (value: string) => (wording.multiline ? variantPreview(value, 160) : value);

	function toggle() {
		open = !open;
		error = '';
		// Seeded with what the document says now: something else for this job is
		// nearly always an edit of that rather than a blank line.
		if (open) draft = current;
	}

	function submitting(choice: string) {
		pending = choice;
		error = '';
		return async ({
			result,
			update
		}: {
			result: { type: string; data?: Record<string, unknown> };
			update: (opts?: { reset?: boolean }) => Promise<void>;
		}) => {
			await update({ reset: false });
			pending = null;
			if (result.type === 'success') {
				open = false;
			} else {
				const message = result.data?.error;
				error = typeof message === 'string' ? message : 'Could not change that wording.';
			}
		};
	}
</script>

<!-- The fields every choice posts: which field of which item, and for which document. -->
{#snippet target(pick: string)}
	<input type="hidden" name="entity" value={wording.entity} />
	<input type="hidden" name="entity_id" value={wording.entityId} />
	<input type="hidden" name="field" value={wording.field} />
	<input type="hidden" name="pick" value={pick} />
	<input type="hidden" name="doc_type" value={docType} />
	<input type="hidden" name="base_slug" value={baseSlug} />
{/snippet}

<!-- One thing the field can say, as a button that makes it say that. -->
{#snippet choice(pick: string, text: string, detail: string, chosen: boolean)}
	<li>
		<form method="POST" action="?/setWording" use:enhance={() => submitting(pick)}>
			{@render target(pick)}
			<button
				type="submit"
				disabled={pending !== null || chosen}
				aria-pressed={chosen}
				class="flex w-full items-start gap-2 rounded border px-2 py-1 text-left transition-colors disabled:cursor-default {chosen
					? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10'
					: 'border-[var(--dash-border)] hover:border-[var(--dash-primary)]/60'}"
			>
				<span class="flex h-3.5 w-3.5 shrink-0 items-center justify-center pt-0.5">
					{#if pending === pick}
						<FontAwesomeIcon icon={faCircleNotch} spin class="h-2.5 w-2.5" />
					{:else if chosen}
						<FontAwesomeIcon icon={faCheck} class="h-2.5 w-2.5 text-[var(--dash-primary)]" />
					{/if}
				</span>
				<span class="min-w-0 flex-1">
					<span class="block text-[11px] text-[var(--dash-text)]">{shown(text) || 'Not set'}</span>
					{#if detail}
						<span class="block text-[10px] text-[var(--dash-text-secondary)]">{detail}</span>
					{/if}
				</span>
			</button>
		</form>
	</li>
{/snippet}

<div data-job-wording={wording.key}>
	<p class="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[11px]">
		<span class="text-[var(--dash-text-secondary)]">{wording.label}</span>
		<span class="min-w-0 text-[var(--dash-text)]">{shown(current) || 'Not set'}</span>
		{#if wording.pickedId !== null && wording.own}
			<span class="text-[10px] text-[var(--dash-text-secondary)]">
				instead of “{shown(wording.own)}”
			</span>
		{/if}
		<button
			type="button"
			onclick={toggle}
			aria-expanded={open}
			class="text-[10px] text-[var(--dash-primary)] hover:underline"
		>
			{open ? 'Close' : 'Change'}
		</button>
	</p>
	{#if wording.from === 'inherited'}
		<p class="text-[10px] text-[var(--dash-text-secondary)]">
			From {wording.inheritedFrom ? `“${wording.inheritedFrom}”` : 'the version'}, which this
			{docLabel} builds on.
		</p>
	{:else if wording.reason}
		<p class="text-[10px] text-[var(--dash-text-secondary)]">
			{wording.reason}{#if wording.source === 'user'}&nbsp;· yours{/if}
		</p>
	{/if}

	{#if open}
		<div class="mt-1.5 space-y-1.5 rounded-lg border border-[var(--dash-border)] p-2">
			<ul class="space-y-1">
				{@render choice('own', wording.own, `your own ${what}`, wording.pickedId === null)}
				{#each wording.options as option (option.id)}
					{@render choice(
						String(option.id),
						option.value,
						// A wording named after its own text needs no second line saying so.
						[
							sameWording(option.label, option.value) ? '' : option.label,
							option.note ? `use for: ${option.note}` : ''
						]
							.filter(Boolean)
							.join(' · '),
						wording.pickedId === option.id
					)}
				{/each}
			</ul>

			<form
				method="POST"
				action="?/setWording"
				use:enhance={() => submitting('new')}
				class="space-y-1"
			>
				{@render target('new')}
				<label
					class="block text-[10px] text-[var(--dash-text-secondary)]"
					for="wording-new-{wording.key}"
				>
					Something else for this job
				</label>
				<div class="flex items-start gap-1.5">
					{#if wording.multiline}
						<textarea
							id="wording-new-{wording.key}"
							name="text"
							rows={wording.rows}
							bind:value={draft}
							class="min-w-0 flex-1 rounded border border-[var(--dash-border)] px-2 py-1 text-[11px] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						></textarea>
					{:else}
						<input
							id="wording-new-{wording.key}"
							type="text"
							name="text"
							autocomplete="off"
							bind:value={draft}
							class="min-w-0 flex-1 rounded border border-[var(--dash-border)] px-2 py-1 text-[11px] focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
						/>
					{/if}
					<button
						type="submit"
						disabled={pending !== null || !draft.trim() || sameWording(draft, current)}
						class="shrink-0 rounded bg-[var(--dash-primary)] px-2 py-1 text-[11px] font-medium text-white hover:opacity-90 disabled:opacity-50"
					>
						{#if pending === 'new'}
							<FontAwesomeIcon icon={faCircleNotch} spin class="h-2.5 w-2.5" />
						{/if}
						Use this
					</button>
				</div>
				<p class="text-[10px] text-[var(--dash-text-secondary)]">
					It goes on this job's {docLabel} and is kept with your other wordings for this {what}, so
					another job can use it. Your profile's own {what} stays as it is.
				</p>
			</form>

			{#if error}
				<p class="text-[10px] text-[var(--dash-error)]">{error}</p>
			{/if}
		</div>
	{/if}
</div>
