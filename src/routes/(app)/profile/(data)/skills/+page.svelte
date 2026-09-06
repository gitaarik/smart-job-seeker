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

	function mapCategories(cats: typeof data.categories): DbCategoryItem[] {
		return cats.map((c) => ({
			id: c.id,
			name: c.name || '',
			tags: Array.isArray(c.tags) ? (c.tags as string[]) : null,
			note: c.note ?? '',
			skills: mapSkills(c.tech_skills)
		}));
	}

	let mappedCategories = $state(mapCategories(data.categories));
	let canCategoryReorder = $state(false);
	let editorRef: SkillCategoriesEditor;

	$effect(() => {
		mappedCategories = mapCategories(data.categories);
	});

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
			onskillreorder={handleSkillReorder}
			oncategoryreorder={handleCategoryReorder}
		/>
	</div>
</div>
