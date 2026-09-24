<script lang="ts">
	import { enhance } from '$app/forms';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faCircleNotch, faPlus } from '@fortawesome/free-solid-svg-icons';
	import { clickOutside, keepInView } from '$lib/actions/popover';
	import type { DocType } from '$lib/utils/profile-doc-url';

	/**
	 * A word this job's match credits through a related skill, and the one-step
	 * way to put it on this job's document.
	 *
	 * It used to add a skill to the profile. The match had credited the word
	 * through something the profile already holds, so every one of those was a
	 * second name for an existing skill, and "show on CV" by default printed the
	 * job's vocabulary on every resume sent afterwards. The word belongs to the
	 * job, so it now goes on the version tailored for it and nowhere else (see
	 * server/profile/skill-words.ts).
	 *
	 * The group is asked, not assumed, but it opens on the answer: the group of
	 * the skill the match credited it through, where there is one.
	 *
	 * The host page must expose `addSkillWord`.
	 */
	let {
		skill,
		from = null,
		groups,
		suggested = null,
		docType,
		baseSlug
	}: {
		/** The word, spelled the way the job spells it. */
		skill: string;
		/** The applicant's own skill the match credited it through, if it named one. */
		from?: string | null;
		/** The skill groups it could print in on this document. */
		groups: { id: number; name: string }[];
		/** Where it would go by default. Ignored unless it is one of `groups`. */
		suggested?: number | null;
		docType: DocType;
		/** What to build on, if this add is what creates the tailored version. */
		baseSlug: string;
	} = $props();

	const uid = $props.id();
	let docLabel = $derived(docType === 'cv' ? 'CV' : 'resume');

	let open = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);
	let categoryId = $state('');

	function toggle() {
		open = !open;
		if (!open) return;
		error = null;
		categoryId = String(groups.find((g) => g.id === suggested)?.id ?? groups[0]?.id ?? '');
	}

	let credit = $derived(
		from
			? `Your match credits it through ${from}.`
			: 'Your match infers it from your profile as a whole, not from one skill.'
	);
</script>

<span class="relative inline-block">
	<button
		type="button"
		onclick={toggle}
		title={from
			? `Credited through ${from}. Click to put the word on this job's ${docLabel}`
			: `Credited by this match. Click to put the word on this job's ${docLabel}`}
		class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-[var(--dash-success)]/40 bg-[var(--dash-success-light)]/50 px-3 py-1 align-middle text-sm text-[var(--dash-success)]"
	>
		<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
		{skill}
		<FontAwesomeIcon icon={faPlus} class="h-2.5 w-2.5 opacity-60" />
	</button>

	{#if open}
		<!-- Mobile backdrop -->
		<div class="fixed inset-0 z-40 bg-black/30 sm:hidden"></div>
		<form
			method="POST"
			action="?/addSkillWord"
			use:clickOutside={() => (open = false)}
			use:keepInView
			use:enhance={() => {
				saving = true;
				error = null;
				return async ({ result, update }) => {
					saving = false;
					if (result.type === 'failure') {
						error =
							(result.data as { error?: string } | undefined)?.error ?? "Couldn't add the word.";
						return;
					}
					open = false;
					await update({ reset: false });
				};
			}}
			class="absolute top-full left-0 z-50 mt-1 w-64 space-y-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 text-left shadow-lg"
		>
			<input type="hidden" name="name" value={skill} />
			<input type="hidden" name="doc_type" value={docType} />
			<input type="hidden" name="base_slug" value={baseSlug} />

			<p class="text-sm font-medium text-[var(--dash-text)]">
				Add “{skill}” to this job's {docLabel}
			</p>
			<p class="text-[10px] leading-snug text-[var(--dash-text-muted)]">{credit}</p>

			{#if groups.length > 0}
				<div>
					<label
						for="word-group-{uid}"
						class="mb-1 block text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
						>Skill group</label
					>
					<select
						id="word-group-{uid}"
						name="category_id"
						bind:value={categoryId}
						class="w-full cursor-pointer rounded border border-[var(--dash-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
					>
						{#each groups as group (group.id)}
							<option value={String(group.id)}>{group.name}</option>
						{/each}
					</select>
				</div>
			{:else}
				<p class="text-[10px] text-[var(--dash-error)]">
					This {docLabel} prints no skill group to put it in.
				</p>
			{/if}

			<p class="text-[10px] leading-snug text-[var(--dash-text-muted)]">
				Only on the version tailored for this job. Your profile and your other documents stay as
				they are.
			</p>

			{#if error}
				<p class="text-[10px] text-[var(--dash-error)]">{error}</p>
			{/if}

			<div class="flex justify-end gap-1.5 pt-1">
				<button
					type="button"
					onclick={() => (open = false)}
					class="cursor-pointer rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
				>
					Cancel
				</button>
				<button
					type="submit"
					disabled={saving || groups.length === 0}
					class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-70"
				>
					{#if saving}
						<FontAwesomeIcon icon={faCircleNotch} spin class="h-3 w-3" />
					{/if}
					Add
				</button>
			</div>
		</form>
	{/if}
</span>
