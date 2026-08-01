<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faCircleNotch, faEyeSlash, faPlus } from '@fortawesome/free-solid-svg-icons';
	import SkillPill from './SkillPill.svelte';
	import { SKILL_LEVELS } from '$lib/data/field-labels';
	import { clickOutside, keepInView } from '$lib/actions/popover';

	/**
	 * A job skill pill that, when it doesn't match the profile, doubles as an
	 * "I actually have this" affordance.
	 *
	 * The point of capture matters: a skill you'd defend in an interview but
	 * wouldn't headline on your CV is exactly what you spot while reading a job.
	 * So "Show on CV" defaults to off — the skill starts counting for matching
	 * immediately and only reaches a document if you say so. Adding does *not*
	 * re-score this job (matching is an LLM pass the worker runs); the copy says
	 * so rather than implying the number moved.
	 */

	type Strength = 'strong' | 'weak' | null;

	interface Props {
		skill: string;
		strength?: Strength;
		variant?: 'required' | 'preferred';
		/** Set when this skill matches but is held back from documents. */
		profileOnlyId?: number | null;
	}

	let { skill, strength = null, variant = 'required', profileOnlyId = null }: Props = $props();

	let open = $state(false);
	let loaded = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);

	let categories = $state<Array<{ id: number; name: string | null }>>([]);
	/** Set once added (or once we learn the profile already has it). */
	let outcome = $state<'added' | 'existing' | null>(null);
	let addedProfileOnly = $state(true);

	let level = $state('');
	let categoryId = $state<number | null>(null);
	let showOnCv = $state(false);

	// "Held back" branch: the skill matches, but it's profile-only.
	let heldBack = $derived(strength !== null && profileOnlyId !== null);
	let versionsOpen = $state(false);
	let versionSlugs = $state<string[]>([]);
	let versionsLoaded = $state(false);
	let lifted = $state<string | null>(null);

	async function loadVersions() {
		if (versionsLoaded) return;
		versionsLoaded = true;
		try {
			const res = await fetch('/api/profile-versions');
			if (res.ok) versionSlugs = await res.json();
		} catch {
			// The "all documents" action works without them.
		}
	}

	async function showOn(target: string) {
		if (saving || profileOnlyId === null) return;
		saving = true;
		error = null;
		try {
			const res = await fetch('/api/profile-skills', {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ id: profileOnlyId, show_on: target })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || "Couldn't update the skill.");
			lifted = target;
			versionsOpen = false;
		} catch (e) {
			error = e instanceof Error ? e.message : "Couldn't update the skill.";
		} finally {
			saving = false;
		}
	}

	async function loadCategories() {
		if (loaded) return;
		try {
			const res = await fetch('/api/profile-skills');
			if (!res.ok) throw new Error();
			const data = await res.json();
			categories = data.categories ?? [];
			categoryId = categories[0]?.id ?? null;
			// The stored match may predate an earlier add, so trust the profile.
			const known = (data.skills ?? []).some(
				(n: string) => n?.trim().toLowerCase() === skill.trim().toLowerCase()
			);
			if (known) outcome = 'existing';
			loaded = true;
		} catch {
			error = "Couldn't load your skill categories.";
		}
	}

	function toggle() {
		open = !open;
		if (open) loadCategories();
	}

	async function add() {
		if (saving) return;
		saving = true;
		error = null;
		try {
			const res = await fetch('/api/profile-skills', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					name: skill,
					level: level || null,
					category_id: categoryId,
					profile_only: !showOnCv
				})
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || "Couldn't add the skill.");

			addedProfileOnly = !showOnCv;
			outcome = data.duplicate ? 'existing' : 'added';
			open = false;
		} catch (e) {
			error = e instanceof Error ? e.message : "Couldn't add the skill.";
		} finally {
			saving = false;
		}
	}
</script>

{#if heldBack}
	<!-- Matches, but held back from documents. Say so where the applicant is
       weighing themselves against the job, and offer the way out. -->
	<span class="relative inline-block">
		<button
			type="button"
			onclick={() => {
				versionsOpen = !versionsOpen;
				if (versionsOpen) loadVersions();
			}}
			title={lifted
				? 'Now shown on your CV'
				: 'In your profile, but kept off your CV — click to add it'}
			class="
        inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-sm transition-colors {lifted
				? 'border-[var(--dash-success)]/30 bg-[var(--dash-success-light)] text-[var(--dash-success)]'
				: 'border-dashed border-[var(--dash-success)]/40 bg-[var(--dash-success-light)]/50 text-[var(--dash-success)]'}
      "
		>
			<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
			{skill}
			{#if !lifted}
				<FontAwesomeIcon icon={faEyeSlash} class="h-3 w-3 opacity-70" />
			{/if}
		</button>

		{#if versionsOpen}
			<div class="fixed inset-0 z-40 bg-black/30 sm:hidden"></div>
			<div
				use:clickOutside={() => (versionsOpen = false)}
				use:keepInView
				class="absolute top-full left-0 z-50 mt-1 w-64 space-y-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 text-left shadow-lg"
			>
				<p class="text-sm font-medium text-[var(--dash-text)]">
					“{skill}” is profile-only
				</p>
				<p class="text-[10px] leading-snug text-[var(--dash-text-muted)]">
					It counts for matching but doesn't print on your resume / CV. Put it on:
				</p>
				<div class="flex flex-wrap gap-1.5">
					<button
						type="button"
						onclick={() => showOn('all')}
						disabled={saving}
						class="rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)] disabled:opacity-70"
					>
						All documents
					</button>
					{#each versionSlugs as slug}
						<button
							type="button"
							onclick={() => showOn(slug)}
							disabled={saving}
							class="rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)] disabled:opacity-70"
						>
							{slug}
						</button>
					{/each}
				</div>
				{#if error}
					<p class="text-[10px] text-[var(--dash-error)]">{error}</p>
				{/if}
			</div>
		{/if}
	</span>
{:else if strength !== null}
	<SkillPill {skill} {strength} {variant} size="md" />
{:else if outcome}
	<span
		class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-success)]/30 bg-[var(--dash-success-light)] px-3 py-1 text-sm text-[var(--dash-success)]"
		title={outcome === 'existing'
			? 'Already in your profile'
			: addedProfileOnly
				? 'Added to your profile — counts for matching from the next match on, and stays off your resume/CV'
				: 'Added to your profile — counts for matching from the next match on'}
	>
		<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
		{skill}
		{#if outcome === 'added' && addedProfileOnly}
			<FontAwesomeIcon icon={faEyeSlash} class="h-3 w-3 opacity-70" />
		{/if}
	</span>
{:else}
	<span class="relative inline-block">
		<button
			type="button"
			onclick={toggle}
			title="I have this skill — add it to my profile"
			class="
        inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-sm transition-colors {variant ===
			'preferred'
				? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary-light)] text-[var(--dash-primary)]'
				: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)]'} hover:border-[var(--dash-primary)]/60
      "
		>
			{skill}
			<FontAwesomeIcon icon={faPlus} class="h-2.5 w-2.5 opacity-50" />
		</button>

		{#if open}
			<!-- Mobile backdrop -->
			<div class="fixed inset-0 z-40 bg-black/30 sm:hidden"></div>
			<div
				use:clickOutside={() => (open = false)}
				use:keepInView
				class="absolute top-full left-0 z-50 mt-1 w-64 space-y-2 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-3 text-left shadow-lg"
			>
				<p class="text-sm font-medium text-[var(--dash-text)]">
					Add “{skill}” to your profile
				</p>

				<div>
					<label
						for="add-skill-level-{skill}"
						class="mb-1 block text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
						>Level</label
					>
					<select
						id="add-skill-level-{skill}"
						bind:value={level}
						class="w-full cursor-pointer rounded border border-[var(--dash-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
					>
						<option value="">--</option>
						{#each SKILL_LEVELS as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</div>

				{#if categories.length > 1}
					<div>
						<label
							for="add-skill-category-{skill}"
							class="mb-1 block text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
							>Category</label
						>
						<select
							id="add-skill-category-{skill}"
							bind:value={categoryId}
							class="w-full cursor-pointer rounded border border-[var(--dash-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
						>
							{#each categories as cat}
								<option value={cat.id}>{cat.name}</option>
							{/each}
						</select>
					</div>
				{/if}

				<div>
					<button
						type="button"
						onclick={() => (showOnCv = !showOnCv)}
						aria-pressed={showOnCv}
						class="flex w-full items-center justify-between gap-2 text-left"
					>
						<span class="text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase">
							Show on CV
						</span>
						<span
							class="
                relative inline-flex h-4 w-7 shrink-0 rounded-full transition-colors {showOnCv
								? 'bg-emerald-500'
								: 'bg-[var(--dash-border)]'}
              "
						>
							<span
								class="
                  absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all {showOnCv
									? 'left-3.5'
									: 'left-0.5'}
                "
							></span>
						</span>
					</button>
					<p class="mt-0.5 text-[10px] leading-snug text-[var(--dash-text-muted)]">
						{#if showOnCv}
							Shown on your resume / CV, and counts for job matching.
						{:else}
							Counts for job matching. Stays off your resume / CV until you turn this on.
						{/if}
					</p>
				</div>

				{#if error}
					<p class="text-[10px] text-[var(--dash-error)]">{error}</p>
				{/if}

				<div class="flex justify-end gap-1.5 pt-1">
					<button
						type="button"
						onclick={() => (open = false)}
						class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-text)]"
					>
						Cancel
					</button>
					<button
						type="button"
						onclick={add}
						disabled={saving}
						class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-70"
					>
						{#if saving}
							<FontAwesomeIcon icon={faCircleNotch} spin class="h-3 w-3" />
						{/if}
						Add
					</button>
				</div>
			</div>
		{/if}
	</span>
{/if}
