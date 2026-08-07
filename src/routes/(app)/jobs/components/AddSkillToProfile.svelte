<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCheck, faCircleNotch, faEyeSlash, faPlus } from '@fortawesome/free-solid-svg-icons';
	import { invalidateAll } from '$app/navigation';
	import SkillPill from './SkillPill.svelte';
	import { SKILL_LEVELS } from '$lib/data/field-labels';
	import { clickOutside, keepInView } from '$lib/actions/popover';
	import type { ProfileSkillRef } from '$lib/profile-visibility';

	/**
	 * A job's skill pill, which doubles as the shortest path between noticing a
	 * skill and having the profile reflect it.
	 *
	 * Reading a job is when you learn things about your own profile: that you'd
	 * defend a skill you never listed, that one you kept off your CV is the thing
	 * this employer leads with, that a level is wrong. So every pill is an
	 * affordance — missing skills add, and skills the profile already has open
	 * the same form with their current values, because "add it" and "change it"
	 * are the same thought a moment apart. Neither re-scores this job: matching
	 * is an LLM pass the worker runs, and the copy says so rather than implying
	 * the number moved.
	 *
	 * Two different questions decide what a pill looks like, and conflating them
	 * is what makes this component fiddly: whether the *match* counted the skill
	 * (`strength`, from the matcher's stored output) and whether the *profile*
	 * has it (`profileSkill`, read live). They disagree often — the matcher ran
	 * at a moment in time, and it is an LLM. Both are props, resolved before the
	 * first paint. An earlier version asked the server only after the popover had
	 * opened, which let the answer arrive mid-interaction and swap the branch out
	 * from under it: the popover appeared to open and close itself.
	 */

	type Strength = 'strong' | 'weak' | null;

	interface Props {
		skill: string;
		strength?: Strength;
		variant?: 'required' | 'preferred';
		/** What the profile holds for this skill, if anything. */
		profileSkill?: ProfileSkillRef | null;
	}

	let { skill, strength = null, variant = 'required', profileSkill = null }: Props = $props();

	/**
	 * Skill names make bad ids — ".NET", "C++" and "Machine Learning" all appear
	 * in job listings, and the last one isn't a conforming id at all, which
	 * breaks the label/control pairing. A job can also require and prefer the
	 * same skill, which would emit the id twice.
	 */
	const uid = $props.id();

	let open = $state(false);
	let loaded = $state(false);
	let saving = $state(false);
	let error = $state<string | null>(null);

	let categories = $state<Array<{ id: number; name: string | null }>>([]);
	let versionSlugs = $state<string[]>([]);

	/**
	 * Sentinel for the category select. Skills arrive from jobs in whatever order
	 * the jobs come, so the one you want to file a skill under is regularly one
	 * the profile doesn't have yet — and being sent to the skills page to make it
	 * first would lose the job you were reading. Bound as a string so the "new"
	 * option and the ids share one type.
	 */
	const NEW_CATEGORY = 'new';

	// Draft state. Seeded from the profile row when editing, so the form opens
	// showing what is true rather than what a blank form would default to.
	let level = $state('');
	let categoryChoice = $state<string>('');
	let newCategoryName = $state('');
	let showOnCv = $state(false);
	let versions = $state<string[]>([]);

	let editing = $derived(profileSkill !== null);
	let profileOnly = $derived(profileSkill?.profileOnly ?? false);

	function seed() {
		level = profileSkill?.level ?? '';
		categoryChoice = profileSkill ? String(profileSkill.categoryId) : '';
		newCategoryName = '';
		showOnCv = profileSkill ? !profileSkill.profileOnly : false;
		versions = [...(profileSkill?.versions ?? [])];
		error = null;
	}

	async function load() {
		if (loaded) return;
		try {
			const [catRes, verRes] = await Promise.all([
				fetch('/api/profile-skills'),
				fetch('/api/profile-versions')
			]);
			if (!catRes.ok) throw new Error();
			const data = await catRes.json();
			categories = data.categories ?? [];
			if (!categoryChoice) {
				categoryChoice = categories[0] ? String(categories[0].id) : NEW_CATEGORY;
			}
			// Versions are optional furniture: without them the form still works,
			// it just can't offer the per-version exceptions.
			if (verRes.ok) versionSlugs = await verRes.json();
			loaded = true;
		} catch {
			error = "Couldn't load your skill categories.";
		}
	}

	function toggle() {
		open = !open;
		if (open) {
			seed();
			load();
		}
	}

	function toggleVersion(slug: string) {
		versions = versions.includes(slug) ? versions.filter((v) => v !== slug) : [...versions, slug];
	}

	async function save() {
		if (saving) return;

		const creating = categoryChoice === NEW_CATEGORY;
		if (creating && !newCategoryName.trim()) {
			error = 'Name the new category.';
			return;
		}

		saving = true;
		error = null;
		try {
			const body = {
				level: level || null,
				category_id: creating ? null : Number(categoryChoice),
				category_name: creating ? newCategoryName.trim() : null
			};
			const res = await fetch('/api/profile-skills', {
				method: editing ? 'PATCH' : 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(
					editing
						? {
								...body,
								id: profileSkill!.id,
								profile_only: !showOnCv,
								versions: showOnCv ? [] : versions
							}
						: {
								...body,
								name: skill,
								profile_only: !showOnCv,
								versions: showOnCv ? [] : versions
							}
				)
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || "Couldn't save the skill.");

			open = false;
			// Re-read from the server rather than patching local state: the pill's
			// whole appearance derives from the profile row, and a duplicate add
			// resolves to an existing row this component never saw.
			await invalidateAll();
		} catch (e) {
			error = e instanceof Error ? e.message : "Couldn't save the skill.";
		} finally {
			saving = false;
		}
	}

	let pillTitle = $derived(
		!editing
			? 'I have this skill — add it to my profile'
			: profileOnly
				? 'In your profile, kept off your resume / CV — click to change'
				: strength === null
					? "In your profile — this job's match doesn't count it yet"
					: 'In your profile — click to change'
	);
</script>

<span class="relative inline-block">
	<button
		type="button"
		onclick={toggle}
		title={pillTitle}
		class="inline-flex cursor-pointer align-middle"
	>
		{#if profileOnly}
			<!-- Held back from documents: say so where the applicant is weighing
           themselves against the job, rather than letting it read as absent. -->
			<span
				class="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--dash-success)]/40 bg-[var(--dash-success-light)]/50 px-3 py-1 text-sm text-[var(--dash-success)]"
			>
				<FontAwesomeIcon icon={faCheck} class="h-3 w-3" />
				{skill}
				<FontAwesomeIcon icon={faEyeSlash} class="h-3 w-3 opacity-70" />
			</span>
		{:else if editing}
			<!-- Matched or not, the profile has it — reuse the matched styling so a
           stale match doesn't make an owned skill look missing. -->
			<SkillPill {skill} strength={strength ?? 'strong'} {variant} size="md" />
		{:else}
			<span
				class="
          inline-flex items-center gap-1.5 rounded-lg border px-3 py-1 text-sm transition-colors {variant ===
				'preferred'
					? 'border-[var(--dash-primary)]/30 bg-[var(--dash-primary-light)] text-[var(--dash-primary)]'
					: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)]'} hover:border-[var(--dash-primary)]/60
        "
			>
				{skill}
				<FontAwesomeIcon icon={faPlus} class="h-2.5 w-2.5 opacity-50" />
			</span>
		{/if}
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
				{editing ? 'Edit' : 'Add'} “{skill}”{editing ? '' : ' in your profile'}
			</p>
			{#if editing && strength === null}
				<p class="text-[10px] leading-snug text-[var(--dash-text-muted)]">
					This job's match doesn't count it yet — that catches up the next time the job is matched.
				</p>
			{/if}

			<div>
				<label
					for="skill-level-{uid}"
					class="mb-1 block text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
					>Level</label
				>
				<select
					id="skill-level-{uid}"
					bind:value={level}
					class="w-full cursor-pointer rounded border border-[var(--dash-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
				>
					<option value="">--</option>
					{#each SKILL_LEVELS as opt}
						<option value={opt.value}>{opt.label}</option>
					{/each}
				</select>
			</div>

			<div>
				<label
					for="skill-category-{uid}"
					class="mb-1 block text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase"
					>Category</label
				>
				<select
					id="skill-category-{uid}"
					bind:value={categoryChoice}
					class="w-full cursor-pointer rounded border border-[var(--dash-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
				>
					{#each categories as cat}
						<option value={String(cat.id)}>{cat.name}</option>
					{/each}
					<option value={NEW_CATEGORY}>+ New category…</option>
				</select>
				{#if categoryChoice === NEW_CATEGORY}
					<input
						type="text"
						bind:value={newCategoryName}
						placeholder="Category name"
						aria-label="New category name"
						class="mt-1 w-full rounded border border-[var(--dash-border)] bg-transparent px-2 py-1.5 text-sm text-[var(--dash-text)] focus:ring-1 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
				{/if}
			</div>

			<div>
				<button
					type="button"
					onclick={() => (showOnCv = !showOnCv)}
					aria-pressed={showOnCv}
					class="flex w-full cursor-pointer items-center justify-between gap-2 text-left"
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

				{#if !showOnCv && versionSlugs.length > 0}
					<!-- The exception that makes holding a skill back liveable: off by
               default, on for the versions where it earns its place. -->
					<p class="mt-2 mb-1 text-[10px] tracking-wide text-[var(--dash-text-muted)] uppercase">
						Show anyway on
					</p>
					<div class="flex flex-wrap gap-1.5">
						{#each versionSlugs as slug}
							<button
								type="button"
								onclick={() => toggleVersion(slug)}
								aria-pressed={versions.includes(slug)}
								class="
                  cursor-pointer rounded border px-2 py-1 text-xs transition-colors {versions.includes(
									slug
								)
									? 'border-[var(--dash-primary)]/40 bg-[var(--dash-primary-light)] text-[var(--dash-primary)]'
									: 'border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}
                "
							>
								{slug}
							</button>
						{/each}
					</div>
				{/if}
			</div>

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
					type="button"
					onclick={save}
					disabled={saving}
					class="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600 transition-colors hover:bg-emerald-500/20 disabled:opacity-70"
				>
					{#if saving}
						<FontAwesomeIcon icon={faCircleNotch} spin class="h-3 w-3" />
					{/if}
					{editing ? 'Save' : 'Add'}
				</button>
			</div>
		</div>
	{/if}
</span>
