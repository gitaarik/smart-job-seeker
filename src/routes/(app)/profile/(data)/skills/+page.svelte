<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { invalidateAll } from '$app/navigation';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faArrowsUpDown, faCode } from '@fortawesome/free-solid-svg-icons';
	import SectionHeader from '../../components/SectionHeader.svelte';
	import SkillCategoriesEditor from '../../../components/SkillCategoriesEditor.svelte';
	import type { CategoryItem } from '../../../components/SkillCategoriesEditor.svelte';
	import type { SkillItem } from '../../../components/SkillTagsEditor.svelte';

	interface DbCategoryItem extends CategoryItem {
		id: number;
	}

	interface DbSkillItem extends SkillItem {
		id: number;
	}

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let versionSlugs = $state<string[]>([]);
	let versionSlugsLoaded = $state(false);
	$effect(() => {
		if (versionSlugsLoaded) return;
		versionSlugsLoaded = true;
		fetch('/api/profile-versions')
			.then((res) => (res.ok ? res.json() : []))
			.then((slugs: string[]) => {
				versionSlugs = slugs;
			})
			.catch(() => {});
	});

	function mapSkills(dbSkills: (typeof data.categories)[0]['tech_skills']): DbSkillItem[] {
		return dbSkills.map((s) => ({
			id: s.id,
			name: s.name || '',
			level: s.level || undefined,
			yearsExperience: s.years_experience || undefined,
			tags: Array.isArray(s.tags) ? (s.tags as string[]) : null
		}));
	}

	/**
	 * The editable copy of a load's categories.
	 *
	 * `$state` rather than a plain array, and that is the whole of what makes
	 * the editors below work. They write through the binding by mutating a row
	 * in place — `skills[i].tags = …` for the Show-on switches, `bind:value` for
	 * level and years, the tag chips — and a plain object graph accepts every
	 * one of those writes silently: the value changes, nothing re-renders, and
	 * the `$derived` that reads it stays on its first answer forever. The
	 * switches then never move, and because each click recomputes from that
	 * stale answer, toggling a second template discards the first.
	 *
	 * Proxying here rather than at each mutation site is deliberate: the two
	 * editors deep-mutate in a dozen places, and the other caller
	 * (profile/create's review step) already binds real `$state`. This is the
	 * one caller that did not.
	 */
	function mapCategories(cats: typeof data.categories): DbCategoryItem[] {
		const mapped = $state(
			cats.map((c) => ({
				id: c.id,
				name: c.name || '',
				tags: Array.isArray(c.tags) ? (c.tags as string[]) : null,
				note: c.note ?? '',
				skills: mapSkills(c.tech_skills)
			}))
		);
		return mapped;
	}

	// A writable $derived: the editor binds to this and writes through it, and a
	// fresh `data` (an invalidate after a save) re-derives it. Written as $state
	// plus an $effect that assigned it, which is the same intent with a worse
	// failure mode — the effect runs after the write it is meant to overwrite,
	// so a save landing at the same moment as an edit could put the stored value
	// back over the newer one.
	let mappedCategories = $derived(mapCategories(data.categories));
	let canCategoryReorder = $state(false);
	let editorRef: SkillCategoriesEditor;

	async function postAction(action: string, data: Record<string, string>) {
		const formData = new FormData();
		for (const [key, value] of Object.entries(data)) {
			formData.append(key, value);
		}
		const res = await fetch(`?/${action}`, { method: 'POST', body: formData });
		await invalidateAll();
		return res.ok;
	}

	/**
	 * Reorder is the one action the editor waits on: it keeps its Save button
	 * spinning until the write has landed and only then leaves reorder mode. The
	 * editor runs that spinner itself, so the only thing left to report here is
	 * a failure — and the reload has already put the stored order back.
	 */
	let orderError = $state<string | null>(null);

	async function saveOrder(action: string, data: Record<string, string>) {
		orderError = null;
		try {
			if (!(await postAction(action, data))) throw new Error('Could not save that order');
		} catch (e) {
			orderError = e instanceof Error ? e.message : 'Could not save that order';
		}
	}

	function handleCategoryCreate(category: CategoryItem) {
		if (!category.name.trim()) return;
		postAction('createCategory', {
			name: category.name,
			note: category.note ?? ''
		});
	}

	function handleCategoryRename(category: CategoryItem) {
		const dbCat = category as DbCategoryItem;
		if (!dbCat.id || !category.name.trim()) return;
		postAction('updateCategory', {
			id: String(dbCat.id),
			name: category.name,
			note: category.note ?? ''
		});
	}

	function handleCategoryRemove(category: CategoryItem) {
		const dbCat = category as DbCategoryItem;
		if (!dbCat.id) return;
		postAction('deleteCategory', { id: String(dbCat.id) });
	}

	function handleCategoryTags(category: CategoryItem) {
		const dbCat = category as DbCategoryItem;
		if (!dbCat.id) return;
		postAction('updateCategoryTags', {
			id: String(dbCat.id),
			tags: JSON.stringify(category.tags || [])
		});
	}

	function handleCategoryClone(category: CategoryItem) {
		const dbCat = category as DbCategoryItem;
		if (!dbCat.id) return;
		postAction('cloneCategory', { id: String(dbCat.id) });
	}

	function handleSkillCreate(category: CategoryItem, skill: SkillItem) {
		const dbCat = category as DbCategoryItem;
		if (!dbCat.id) return;
		postAction('createSkill', {
			categoryId: String(dbCat.id),
			name: skill.name,
			level: skill.level || '',
			years_experience: skill.yearsExperience?.toString() || '',
			tags: JSON.stringify(skill.tags || [])
		});
	}

	function handleSkillUpdate(category: CategoryItem, skill: SkillItem) {
		const dbSkill = skill as DbSkillItem;
		if (!dbSkill.id) return;
		postAction('updateSkill', {
			id: String(dbSkill.id),
			name: skill.name,
			level: skill.level || '',
			years_experience: skill.yearsExperience?.toString() || '',
			tags: JSON.stringify(skill.tags || [])
		});
	}

	function handleSkillRemove(category: CategoryItem, skill: SkillItem) {
		const dbSkill = skill as DbSkillItem;
		if (!dbSkill.id) return;
		postAction('deleteSkill', { id: String(dbSkill.id) });
	}

	/**
	 * Write one skill's Show-on switches, immediately.
	 *
	 * Deliberately not `postAction`: that reloads the page data through
	 * `invalidateAll()`, and this write happens with the editor popup OPEN. A
	 * reload there rebuilds every category object underneath the popup that is
	 * bound to them, which is the whole page's state swapped out mid-edit. The
	 * local array already carries the change (the editor wrote it before calling
	 * this), so there is nothing a reload would add.
	 *
	 * Throws on failure rather than returning false, because that is what
	 * `autoSaveField` reads: a rejection is what puts the error and its Retry in
	 * front of the applicant instead of leaving a switch showing a state the
	 * server never accepted.
	 */
	async function handleSkillShownOn(
		category: CategoryItem,
		skill: SkillItem,
		shownOn: string[]
	): Promise<void> {
		const dbSkill = skill as DbSkillItem;
		if (!dbSkill.id) return;
		const res = await fetch('/api/profile-skills', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ id: dbSkill.id, base_templates: shownOn })
		});
		if (!res.ok) {
			const body = await res.json().catch(() => null);
			throw new Error(body?.error ?? 'Could not save that');
		}
	}

	function handleSkillReorder(category: CategoryItem, skills: SkillItem[]) {
		const dbCat = category as DbCategoryItem;
		if (!dbCat.id) return;
		const ids = skills.map((s) => (s as DbSkillItem).id).filter(Boolean);
		return saveOrder('reorderSkills', {
			categoryId: String(dbCat.id),
			order: JSON.stringify(ids)
		});
	}

	function handleCategoryReorder(cats: CategoryItem[]) {
		const ids = cats.map((c) => (c as DbCategoryItem).id).filter(Boolean);
		return saveOrder('reorderCategories', {
			order: JSON.stringify(ids)
		});
	}
</script>

<svelte:head>
	<title>Skills - Profile - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
	<SectionHeader title="Skills" icon={faCode}>
		{#snippet actions()}
			{#if canCategoryReorder}
				<button
					type="button"
					onclick={() => editorRef.startCategoryReorder()}
					class="inline-flex items-center gap-1.5 rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-1.5 text-xs font-medium text-[var(--dash-text-muted)] transition-colors hover:text-[var(--dash-text-secondary)]"
				>
					<FontAwesomeIcon icon={faArrowsUpDown} class="h-3 w-3" />
					Reorder
				</button>
			{/if}
		{/snippet}
	</SectionHeader>

	{#if orderError || form?.error}
		<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
			<p class="text-sm text-[var(--dash-error)]">{orderError ?? form?.error}</p>
		</div>
	{/if}

	<div class="space-y-4">
		<SkillCategoriesEditor
			bind:this={editorRef}
			bind:categories={mappedCategories}
			bind:canCategoryReorder
			levelOptions={data.levelOptions}
			{versionSlugs}
			oncreate={handleCategoryCreate}
			onrename={handleCategoryRename}
			onremove={handleCategoryRemove}
			oncategorytags={handleCategoryTags}
			onclone={handleCategoryClone}
			onskillcreate={handleSkillCreate}
			onskillupdate={handleSkillUpdate}
			onskillremove={handleSkillRemove}
			onskillshownon={handleSkillShownOn}
			onskillreorder={handleSkillReorder}
			oncategoryreorder={handleCategoryReorder}
		/>
	</div>
</div>
