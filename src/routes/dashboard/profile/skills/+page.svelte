<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { invalidateAll } from "$app/navigation";
  import { faCode } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../components/SectionHeader.svelte";
  import SkillCategoriesEditor from "../../components/SkillCategoriesEditor.svelte";
  import type { CategoryItem } from "../../components/SkillCategoriesEditor.svelte";
  import type { SkillItem } from "../../components/SkillTagsEditor.svelte";

  interface DbCategoryItem extends CategoryItem {
    id: number;
  }

  interface DbSkillItem extends SkillItem {
    id: number;
  }

  let { data, form }: { data: PageData; form: ActionData } = $props();

  function mapSkills(
    dbSkills: (typeof data.categories)[0]["tech_skills"],
  ): DbSkillItem[] {
    return dbSkills.map((s) => ({
      id: s.id,
      name: s.name || "",
      level: s.level || undefined,
      yearsExperience: s.years_experience || undefined,
    }));
  }

  function mapCategories(
    cats: typeof data.categories,
  ): DbCategoryItem[] {
    return cats.map((c) => ({
      id: c.id,
      name: c.name || "",
      skills: mapSkills(c.tech_skills),
    }));
  }

  let mappedCategories = $state(mapCategories(data.categories));

  $effect(() => {
    mappedCategories = mapCategories(data.categories);
  });

  async function postAction(
    action: string,
    data: Record<string, string>,
  ) {
    const formData = new FormData();
    for (const [key, value] of Object.entries(data)) {
      formData.append(key, value);
    }
    await fetch(`?/${action}`, { method: "POST", body: formData });
    await invalidateAll();
  }

  function handleCategoryCreate(category: CategoryItem) {
    if (!category.name.trim()) return;
    postAction("createCategory", { name: category.name });
  }

  function handleCategoryRename(category: CategoryItem) {
    const dbCat = category as DbCategoryItem;
    if (!dbCat.id || !category.name.trim()) return;
    postAction("updateCategory", {
      id: String(dbCat.id),
      name: category.name,
    });
  }

  function handleCategoryRemove(category: CategoryItem) {
    const dbCat = category as DbCategoryItem;
    if (!dbCat.id) return;
    postAction("deleteCategory", { id: String(dbCat.id) });
  }

  function handleSkillCreate(category: CategoryItem, skill: SkillItem) {
    const dbCat = category as DbCategoryItem;
    if (!dbCat.id) return;
    postAction("createSkill", {
      categoryId: String(dbCat.id),
      name: skill.name,
      level: skill.level || "",
      years_experience: skill.yearsExperience?.toString() || "",
    });
  }

  function handleSkillUpdate(category: CategoryItem, skill: SkillItem) {
    const dbSkill = skill as DbSkillItem;
    if (!dbSkill.id) return;
    postAction("updateSkill", {
      id: String(dbSkill.id),
      name: skill.name,
      level: skill.level || "",
      years_experience: skill.yearsExperience?.toString() || "",
    });
  }

  function handleSkillRemove(category: CategoryItem, skill: SkillItem) {
    const dbSkill = skill as DbSkillItem;
    if (!dbSkill.id) return;
    postAction("deleteSkill", { id: String(dbSkill.id) });
  }
</script>

<div class="space-y-6">
  <SectionHeader title="Skills" icon={faCode} />

  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  <div class="space-y-4">
    <SkillCategoriesEditor
      bind:categories={mappedCategories}
      oncreate={handleCategoryCreate}
      onrename={handleCategoryRename}
      onremove={handleCategoryRemove}
      onskillcreate={handleSkillCreate}
      onskillupdate={handleSkillUpdate}
      onskillremove={handleSkillRemove}
    />
  </div>
</div>
