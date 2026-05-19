<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faArrowsUpDown,
    faBook,
    faChevronRight,
    faCircleNotch,
    faFileAlt,
    faGripVertical,
    faLayerGroup,
    faPencil,
    faPlus,
    faStickyNote,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import { dragHandleZone, dragHandle } from "svelte-dnd-action";
  import { flip } from "svelte/animate";
  import Card from "../../components/Card.svelte";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import ConfirmModal from "../../profile/components/ConfirmModal.svelte";
  import FilterTabs from "../../components/FilterTabs.svelte";
  import SectionSaveButton from "$lib/components/SectionSaveButton.svelte";
  import SimpleEditor from "$lib/components/SimpleEditor.svelte";
  import { invalidateAll } from "$app/navigation";

  let { data }: { data: PageData } = $props();

  let cheatsheets = $derived(data.cheatsheets);
  let stories = $derived(data.stories);

  // Filter state
  let currentType = $state("all");
  const typeFilters = [
    { value: "all", label: "All", icon: faLayerGroup },
    { value: "cheatsheets", label: "Interview Cheat Sheets", icon: faStickyNote },
    { value: "stories", label: "Project Stories", icon: faBook },
  ];

  // Shared state
  let expandedKey = $state<string | null>(null);
  let editingKey = $state<string | null>(null);
  let showAddMenu = $state(false);
  let showAddCheatSheet = $state(false);
  let showAddStory = $state(false);

  // Delete state
  let deleteKey = $state<string | null>(null);
  let deleteType = $state<"cheatsheet" | "story">("cheatsheet");

  // Discard edits confirmation
  let showDiscardConfirm = $state(false);

  // Original values for dirty checking
  let originalValues = $state<Record<string, string>>({});

  // Save states
  type SaveState = "idle" | "saving" | "saved" | "error";
  let addSaveState = $state<SaveState>("idle");
  let editSaveState = $state<SaveState>("idle");
  let errorMessage = $state("");

  // Cheat sheet form states
  let newSheetTitle = $state("");
  let newSheetContent = $state("");
  let editSheetTitle = $state("");
  let editSheetContent = $state("");

  // Story form states
  let newStoryTitle = $state("");
  let newStoryCategory = $state("");
  let newStorySituation = $state("");
  let newStoryTask = $state("");
  let newStoryAction = $state("");
  let newStoryResult = $state("");
  let newStoryReflection = $state("");
  let editStoryTitle = $state("");
  let editStoryCategory = $state("");
  let editStorySituation = $state("");
  let editStoryTask = $state("");
  let editStoryAction = $state("");
  let editStoryResult = $state("");
  let editStoryReflection = $state("");

  const categories = [
    { value: "leadership", label: "Leadership" },
    { value: "problem_solving", label: "Problem Solving" },
    { value: "teamwork", label: "Teamwork" },
    { value: "technical", label: "Technical Challenge" },
    { value: "conflict", label: "Conflict Resolution" },
    { value: "innovation", label: "Innovation" },
    { value: "failure", label: "Learning from Failure" },
    { value: "achievement", label: "Achievement" },
  ];

  // Combined filtered list
  type CheatSheetItem = (typeof cheatsheets)[0] & { itemType: "cheatsheet"; key: string };
  type StoryItem = (typeof stories)[0] & { itemType: "story"; key: string };
  type Item = CheatSheetItem | StoryItem;

  let filteredItems = $derived.by(() => {
    const sheets: Item[] = cheatsheets.map((s) => ({ ...s, itemType: "cheatsheet" as const, key: `cs-${s.id}` }));
    const storyItems: Item[] = stories.map((s) => ({ ...s, itemType: "story" as const, key: `st-${s.id}` }));

    if (currentType === "cheatsheets") return sheets;
    if (currentType === "stories") return storyItems;
    return [...sheets, ...storyItems];
  });

  let hasAnyItems = $derived(cheatsheets.length > 0 || stories.length > 0);

  // Toggle expand/collapse
  function isEditDirty(): boolean {
    if (!editingKey) return false;
    if (editingKey.startsWith("cs-")) {
      return editSheetTitle !== originalValues.title || editSheetContent !== originalValues.content;
    }
    return editStoryTitle !== originalValues.title || editStoryCategory !== originalValues.category
      || editStorySituation !== originalValues.situation || editStoryTask !== originalValues.task
      || editStoryAction !== originalValues.action || editStoryResult !== originalValues.result
      || editStoryReflection !== originalValues.reflection;
  }

  function toggleExpand(key: string) {
    if (editingKey === key) {
      if (isEditDirty()) {
        showDiscardConfirm = true;
      } else {
        editingKey = null;
        editSaveState = "idle";
        expandedKey = null;
      }
      return;
    }
    expandedKey = expandedKey === key ? null : key;
  }

  function confirmDiscard() {
    editingKey = null;
    editSaveState = "idle";
    expandedKey = null;
    showDiscardConfirm = false;
  }

  // --- Cheat sheet CRUD ---
  function startEditSheet(sheet: (typeof cheatsheets)[0]) {
    const key = `cs-${sheet.id}`;
    editingKey = key;
    expandedKey = key;
    editSheetTitle = sheet.title || "";
    editSheetContent = sheet.content || "";
    editSaveState = "idle";
    originalValues = { title: editSheetTitle, content: editSheetContent };
  }

  function resetAddSheetForm() {
    showAddCheatSheet = false;
    newSheetTitle = "";
    newSheetContent = "";
    addSaveState = "idle";
    errorMessage = "";
  }

  async function saveNewSheet() {
    if (!newSheetTitle.trim()) {
      errorMessage = "Title is required";
      addSaveState = "error";
      setTimeout(() => (addSaveState = "idle"), 2000);
      return;
    }
    addSaveState = "saving";
    errorMessage = "";
    try {
      const response = await fetch("/api/cheat-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: data.profileId,
          title: newSheetTitle,
          content: newSheetContent,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        errorMessage = err.message || err.error || "Failed to create cheat sheet";
        addSaveState = "error";
        setTimeout(() => (addSaveState = "idle"), 2000);
        return;
      }
      addSaveState = "saved";
      await invalidateAll();
      setTimeout(() => resetAddSheetForm(), 500);
    } catch {
      errorMessage = "Failed to create cheat sheet";
      addSaveState = "error";
      setTimeout(() => (addSaveState = "idle"), 2000);
    }
  }

  async function saveEditedSheet(id: number) {
    if (!editSheetTitle.trim()) {
      errorMessage = "Title is required";
      editSaveState = "error";
      setTimeout(() => (editSaveState = "idle"), 2000);
      return;
    }
    editSaveState = "saving";
    errorMessage = "";
    try {
      const response = await fetch("/api/cheat-sheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: data.profileId,
          id,
          title: editSheetTitle,
          content: editSheetContent,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        errorMessage = err.message || err.error || "Failed to update cheat sheet";
        editSaveState = "error";
        setTimeout(() => (editSaveState = "idle"), 2000);
        return;
      }
      editSaveState = "saved";
      await invalidateAll();
      setTimeout(() => {
        editingKey = null;
        editSaveState = "idle";
      }, 500);
    } catch {
      errorMessage = "Failed to update cheat sheet";
      editSaveState = "error";
      setTimeout(() => (editSaveState = "idle"), 2000);
    }
  }

  async function deleteSheet(id: number) {
    try {
      const response = await fetch("/api/cheat-sheets", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: data.profileId, id }),
      });
      if (!response.ok) {
        const err = await response.json();
        errorMessage = err.message || err.error || "Failed to delete cheat sheet";
        return;
      }
      await invalidateAll();
      deleteKey = null;
    } catch {
      errorMessage = "Failed to delete cheat sheet";
    }
  }

  // --- Story CRUD ---
  function startEditStory(story: (typeof stories)[0]) {
    const key = `st-${story.id}`;
    editingKey = key;
    expandedKey = key;
    editStoryTitle = story.title || "";
    editStoryCategory = story.category || "";
    editStorySituation = story.situation || "";
    editStoryTask = story.task || "";
    editStoryAction = story.action || "";
    editStoryResult = story.result || "";
    editStoryReflection = story.reflection || "";
    editSaveState = "idle";
    originalValues = {
      title: editStoryTitle, category: editStoryCategory,
      situation: editStorySituation, task: editStoryTask,
      action: editStoryAction, result: editStoryResult, reflection: editStoryReflection,
    };
  }

  function resetAddStoryForm() {
    showAddStory = false;
    newStoryTitle = "";
    newStoryCategory = "";
    newStorySituation = "";
    newStoryTask = "";
    newStoryAction = "";
    newStoryResult = "";
    newStoryReflection = "";
    addSaveState = "idle";
    errorMessage = "";
  }

  async function saveNewStory() {
    if (!newStoryTitle.trim()) {
      errorMessage = "Title is required";
      addSaveState = "error";
      setTimeout(() => (addSaveState = "idle"), 2000);
      return;
    }
    addSaveState = "saving";
    errorMessage = "";
    try {
      const response = await fetch("/api/interview-stories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: data.profileId,
          title: newStoryTitle,
          category: newStoryCategory,
          situation: newStorySituation,
          task: newStoryTask,
          action: newStoryAction,
          result: newStoryResult,
          reflection: newStoryReflection,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        errorMessage = err.message || err.error || "Failed to create story";
        addSaveState = "error";
        setTimeout(() => (addSaveState = "idle"), 2000);
        return;
      }
      addSaveState = "saved";
      await invalidateAll();
      setTimeout(() => resetAddStoryForm(), 500);
    } catch {
      errorMessage = "Failed to create story";
      addSaveState = "error";
      setTimeout(() => (addSaveState = "idle"), 2000);
    }
  }

  async function saveEditedStory(id: number) {
    if (!editStoryTitle.trim()) {
      errorMessage = "Title is required";
      editSaveState = "error";
      setTimeout(() => (editSaveState = "idle"), 2000);
      return;
    }
    editSaveState = "saving";
    errorMessage = "";
    try {
      const response = await fetch("/api/interview-stories", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: data.profileId,
          id,
          title: editStoryTitle,
          category: editStoryCategory,
          situation: editStorySituation,
          task: editStoryTask,
          action: editStoryAction,
          result: editStoryResult,
          reflection: editStoryReflection,
        }),
      });
      if (!response.ok) {
        const err = await response.json();
        errorMessage = err.message || err.error || "Failed to update story";
        editSaveState = "error";
        setTimeout(() => (editSaveState = "idle"), 2000);
        return;
      }
      editSaveState = "saved";
      await invalidateAll();
      setTimeout(() => {
        editingKey = null;
        editSaveState = "idle";
      }, 500);
    } catch {
      errorMessage = "Failed to update story";
      editSaveState = "error";
      setTimeout(() => (editSaveState = "idle"), 2000);
    }
  }

  async function deleteStory(id: number) {
    try {
      const response = await fetch("/api/interview-stories", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: data.profileId, id }),
      });
      if (!response.ok) {
        const err = await response.json();
        errorMessage = err.message || err.error || "Failed to delete story";
        return;
      }
      await invalidateAll();
      deleteKey = null;
    } catch {
      errorMessage = "Failed to delete story";
    }
  }

  // Shared helpers
  function cancelEdit() {
    editingKey = null;
    editSaveState = "idle";
  }

  function handleDelete() {
    if (!deleteKey) return;
    if (deleteType === "cheatsheet") {
      const id = parseInt(deleteKey.replace("cs-", ""));
      deleteSheet(id);
    } else {
      const id = parseInt(deleteKey.replace("st-", ""));
      deleteStory(id);
    }
  }

  function getCategoryLabel(value: string | null): string {
    if (!value) return "";
    const category = categories.find((c) => c.value === value);
    return category?.label || value;
  }

  // --- Reorder mode ---
  let reorderMode = $state(false);
  let reorderSaving = $state(false);
  interface DndItem {
    id: string;
    item: Item;
    [key: string]: unknown;
  }
  let dndItems = $state<DndItem[]>([]);
  let reorderSnapshot = $state<Item[] | null>(null);
  const flipDurationMs = 150;

  // Determine the effective reorder type: when only one type exists, use it
  // even if the filter is on "all" (since filter tabs are hidden in that case)
  let reorderType = $derived.by(() => {
    if (currentType !== "all") return currentType;
    const hasSheets = cheatsheets.length > 0;
    const hasStories = stories.length > 0;
    if (hasSheets && !hasStories) return "cheatsheets";
    if (hasStories && !hasSheets) return "stories";
    return "all";
  });

  let canReorder = $derived(
    (reorderType === "cheatsheets" && cheatsheets.length > 1) ||
    (reorderType === "stories" && stories.length > 1)
  );

  function startReorder() {
    // Use the resolved type so reorder works when only one type exists
    const items = reorderType === "cheatsheets"
      ? cheatsheets.map((s) => ({ ...s, itemType: "cheatsheet" as const, key: `cs-${s.id}` }))
      : stories.map((s) => ({ ...s, itemType: "story" as const, key: `st-${s.id}` }));
    reorderSnapshot = [...items];
    dndItems = items.map((item) => ({
      id: String(item.id),
      item,
    }));
    reorderMode = true;
  }

  function handleDndConsider(e: CustomEvent<{ items: DndItem[] }>) {
    dndItems = e.detail.items;
  }

  function handleDndFinalize(e: CustomEvent<{ items: DndItem[] }>) {
    dndItems = e.detail.items;
  }

  async function confirmReorder() {
    reorderSaving = true;
    const ids = dndItems.map((d) => parseInt(d.id)).filter((id) => !isNaN(id));
    const endpoint = reorderType === "cheatsheets" ? "/api/cheat-sheets" : "/api/interview-stories";
    try {
      await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_id: data.profileId, order: ids }),
      });
      await invalidateAll();
    } catch {
      // silently fail
    }
    reorderSaving = false;
    reorderSnapshot = null;
    reorderMode = false;
  }

  function cancelReorder() {
    reorderSnapshot = null;
    reorderMode = false;
  }

  function handleClickOutside(e: MouseEvent) {
    const target = e.target as HTMLElement;
    if (!target.closest("[data-add-menu]")) {
      showAddMenu = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<svelte:head>
  <title>Interview Prep - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header with title and add button -->
  <div class="flex items-center justify-between gap-3">
    <div class="flex items-center gap-3">
      <FontAwesomeIcon icon={faBook} class="w-7 h-7 text-[var(--dash-primary)]" />
      <h2 class="text-2xl font-bold text-[var(--dash-text)]">Interview Prep</h2>
    </div>
    {#if hasAnyItems}
      <div class="relative" data-add-menu>
        <button
          type="button"
          onclick={() => (showAddMenu = !showAddMenu)}
          class="flex items-center justify-center gap-2 p-3 sm:px-4 sm:py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} class="w-5 h-5 sm:w-4 sm:h-4" />
          <span class="hidden sm:inline">Add</span>
        </button>
        {#if showAddMenu}
          <div class="absolute top-full right-0 mt-1 z-20 bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-lg shadow-lg py-1 min-w-[220px]">
            <button
              type="button"
              onclick={() => { showAddCheatSheet = true; showAddMenu = false; }}
              class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-text)]"
            >
              <FontAwesomeIcon icon={faStickyNote} class="w-3.5 h-3.5 opacity-50" />
              Interview Cheat Sheet
            </button>
            <button
              type="button"
              onclick={() => { showAddStory = true; showAddMenu = false; }}
              class="w-full px-3 py-2 text-sm text-left flex items-center gap-2 hover:bg-[var(--dash-bg)] transition-colors text-[var(--dash-text)]"
            >
              <FontAwesomeIcon icon={faBook} class="w-3.5 h-3.5 opacity-50" />
              Project Story
            </button>
          </div>
        {/if}
      </div>
    {/if}
  </div>

  <!-- Filter tabs -->
  {#if cheatsheets.length > 0 && stories.length > 0}
    <FilterTabs filters={typeFilters} value={currentType} onchange={(v) => { currentType = v; if (reorderMode) cancelReorder(); }} />
  {/if}

  {#if canReorder && !reorderMode}
    <div class="flex justify-end">
      <button
        type="button"
        onclick={startReorder}
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)] hover:text-[var(--dash-text-secondary)]"
      >
        <FontAwesomeIcon icon={faArrowsUpDown} class="w-3 h-3" />
        Reorder
      </button>
    </div>
  {/if}

  {#if errorMessage && (addSaveState === "error" || editSaveState === "error")}
    <div class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4">
      <p class="text-[var(--dash-error)] text-sm">{errorMessage}</p>
    </div>
  {/if}

  <!-- Add Interview Cheat Sheet Form -->
  {#if showAddCheatSheet}
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-primary)] p-4">
      <h3 class="font-medium text-[var(--dash-text)] mb-4">Add New Interview Cheat Sheet</h3>
      <div class="space-y-4">
        <div>
          <label for="new-sheet-title" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
            Title <span class="text-[var(--dash-error)]">*</span>
          </label>
          <input
            type="text"
            id="new-sheet-title"
            bind:value={newSheetTitle}
            placeholder="e.g., System Design Interview Topics"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>
        <div>
          <label class="block text-sm font-medium text-[var(--dash-text)] mb-1">Content</label>
          <input type="hidden" name="content" value={newSheetContent} />
          <SimpleEditor bind:content={newSheetContent} placeholder="Add your notes, key points, or reference material..." />
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button type="button" onclick={resetAddSheetForm}
          class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors">
          Cancel
        </button>
        <SectionSaveButton state={addSaveState} onClick={saveNewSheet} />
      </div>
    </div>
  {/if}

  <!-- Add Story Form -->
  {#if showAddStory}
    <div class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-primary)] p-4">
      <h3 class="font-medium text-[var(--dash-text)] mb-4">Add New Project Story</h3>
      <div class="space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="new-story-title" class="block text-sm font-semibold text-[var(--dash-text)] mb-1">
              Title <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input type="text" id="new-story-title" bind:value={newStoryTitle}
              placeholder="e.g., Led migration to microservices"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent" />
          </div>
          <div>
            <label for="new-story-category" class="block text-sm font-semibold text-[var(--dash-text)] mb-1">Category</label>
            <select id="new-story-category" bind:value={newStoryCategory}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent">
              <option value="">Select a category</option>
              {#each categories as cat}
                <option value={cat.value}>{cat.label}</option>
              {/each}
            </select>
          </div>
        </div>
        <p class="text-sm text-[var(--dash-text-secondary)]">
          Use the STAR method to structure your story: Situation, Task, Action, Result.
        </p>
        <div>
          <label for="new-story-situation" class="block text-sm font-semibold text-[var(--dash-text)] mb-1">Situation</label>
          <textarea id="new-story-situation" bind:value={newStorySituation} rows={3} placeholder="Describe the context and background..."
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[120px] sm:min-h-0"></textarea>
        </div>
        <div>
          <label for="new-story-task" class="block text-sm font-semibold text-[var(--dash-text)] mb-1">Task</label>
          <textarea id="new-story-task" bind:value={newStoryTask} rows={2} placeholder="What was your responsibility or goal?"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[100px] sm:min-h-0"></textarea>
        </div>
        <div>
          <label for="new-story-action" class="block text-sm font-semibold text-[var(--dash-text)] mb-1">Action</label>
          <textarea id="new-story-action" bind:value={newStoryAction} rows={4} placeholder="What specific steps did you take?"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[150px] sm:min-h-0"></textarea>
        </div>
        <div>
          <label for="new-story-result" class="block text-sm font-semibold text-[var(--dash-text)] mb-1">Result</label>
          <textarea id="new-story-result" bind:value={newStoryResult} rows={3} placeholder="What was the outcome? Include metrics if possible."
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[120px] sm:min-h-0"></textarea>
        </div>
        <p class="text-sm text-[var(--dash-text-secondary)]">Optional: Add a reflection on what you learned from this experience.</p>
        <div>
          <label for="new-story-reflection" class="block text-sm font-semibold text-[var(--dash-text)] mb-1">Reflection (optional)</label>
          <textarea id="new-story-reflection" bind:value={newStoryReflection} rows={2} placeholder="What did you learn? What would you do differently?"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[100px] sm:min-h-0"></textarea>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-4">
        <button type="button" onclick={resetAddStoryForm}
          class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors">
          Cancel
        </button>
        <SectionSaveButton state={addSaveState} onClick={saveNewStory} />
      </div>
    </div>
  {/if}

  <!-- Items List -->
  {#if !hasAnyItems && !showAddCheatSheet && !showAddStory}
    <EmptyState
      icon={faBook}
      title="No interview prep materials yet"
      description="Create cheat sheets for quick reference or project stories using the STAR method to prepare for behavioral interview questions."
      actionLabel="Add First Item"
      onAction={() => (showAddMenu = true)}
    />
  {:else if reorderMode}
    <!-- Reorder Mode -->
    {#snippet reorderConfirmCancel()}
      <div class="flex items-center justify-end gap-2">
        <span class="text-xs text-[var(--dash-text-muted)]">Reorder {reorderType === "cheatsheets" ? "Interview Cheat Sheets" : "Stories"}</span>
        <button
          type="button"
          onclick={cancelReorder}
          class="px-3 py-1 border border-[var(--dash-border)] text-[var(--dash-text)] rounded-lg hover:bg-[var(--dash-bg)] transition-colors text-xs"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={confirmReorder}
          disabled={reorderSaving}
          class="px-3 py-1 bg-[var(--dash-success)] text-white rounded-lg hover:opacity-90 transition-colors text-xs inline-flex items-center gap-1.5 disabled:opacity-70"
        >
          {#if reorderSaving}<FontAwesomeIcon icon={faCircleNotch} spin class="w-3 h-3" />{/if}
          Save
        </button>
      </div>
    {/snippet}

    {@render reorderConfirmCancel()}
    <div
      class="space-y-2 mt-2"
      use:dragHandleZone={{ items: dndItems, flipDurationMs, type: "interview-items" }}
      onconsider={handleDndConsider}
      onfinalize={handleDndFinalize}
    >
      {#each dndItems as dndItem (dndItem.id)}
        <div animate:flip={{ duration: flipDurationMs }}>
          <Card class="p-3 sm:p-4">
            <div class="flex items-center gap-3">
              <div use:dragHandle class="cursor-grab active:cursor-grabbing touch-none p-1 -m-1">
                <FontAwesomeIcon
                  icon={faGripVertical}
                  class="w-4 h-4 text-[var(--dash-text-muted)] flex-shrink-0"
                />
              </div>
              <FontAwesomeIcon
                icon={dndItem.item.itemType === "cheatsheet" ? faStickyNote : faBook}
                class="w-4 h-4 {dndItem.item.itemType === 'cheatsheet' ? 'text-purple-600' : 'text-blue-600'} flex-shrink-0"
              />
              <h3 class="text-base font-semibold text-[var(--dash-text)] truncate">
                {dndItem.item.title || "Untitled"}
              </h3>
              <span class="text-xs text-[var(--dash-text-muted)] flex-shrink-0">
                {dndItem.item.itemType === "cheatsheet" ? "Interview Cheat Sheet" : "Story"}
              </span>
            </div>
          </Card>
        </div>
      {/each}
    </div>
    <div class="mt-2">
      {@render reorderConfirmCancel()}
    </div>
  {:else}
    <div class="space-y-3">
      {#each filteredItems as item (item.key)}
        {#if item.itemType === "cheatsheet"}
          <!-- Cheat Sheet Card -->
          {@const sheet = item}
          {@const isExpanded = expandedKey === item.key}
          {@const isEditing = editingKey === item.key}
          <Card class="overflow-hidden relative transition-all">
            <button
              type="button"
              onclick={(e) => { e.stopPropagation(); toggleExpand(item.key); }}
              class="absolute top-3 right-3 p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors z-10"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <span class="inline-block transition-transform duration-200 {isExpanded ? 'rotate-90' : ''}">
                <FontAwesomeIcon icon={faChevronRight} class="w-4 h-4" />
              </span>
            </button>

            <button type="button" onclick={() => toggleExpand(item.key)}
              class="w-full p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors text-left cursor-pointer">
              <div class="flex items-start gap-3">
                <div class="hidden md:flex flex-shrink-0">
                  <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                    <FontAwesomeIcon icon={faStickyNote} class="w-6 h-6 text-purple-600" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-[var(--dash-text)] text-sm sm:text-base line-clamp-2 sm:truncate pr-14">
                    {sheet.title || "Untitled"}
                  </h3>
                  <span class="text-xs text-[var(--dash-text-muted)]">Interview Cheat Sheet</span>
                </div>
                <div class="flex-shrink-0 md:hidden flex flex-col items-end">
                  <div class="h-6 mb-1"></div>
                  <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                    <FontAwesomeIcon icon={faStickyNote} class="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>
            </button>

            {#if !isEditing}
              <button
                type="button"
                onclick={(e) => { e.stopPropagation(); startEditSheet(sheet); }}
                class="absolute top-3 right-10 p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors z-10 cursor-pointer"
                aria-label="Edit"
              >
                <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
              </button>
            {/if}

            {#if isExpanded}
              <div class="border-t border-[var(--dash-border)] p-3 sm:p-4">
                {#if isEditing}
                  <div class="space-y-4">
                    <div>
                      <label for="edit-sheet-title-{sheet.id}" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
                        Title <span class="text-[var(--dash-error)]">*</span>
                      </label>
                      <input type="text" id="edit-sheet-title-{sheet.id}" bind:value={editSheetTitle}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium text-[var(--dash-text)] mb-1">Content</label>
                      <input type="hidden" name="content" value={editSheetContent} />
                      <SimpleEditor bind:content={editSheetContent} placeholder="Add your notes..." />
                    </div>
                  </div>
                  <div class="flex items-center mt-4">
                    <button type="button" onclick={() => { deleteKey = item.key; deleteType = "cheatsheet"; }}
                      class="px-3 py-2 text-xs bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 transition-colors flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faTrash} class="w-3 h-3" /> Delete
                    </button>
                    <div class="flex gap-2 ml-auto">
                      <button type="button" onclick={cancelEdit}
                        class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors">
                        Cancel
                      </button>
                      <SectionSaveButton state={editSaveState} onClick={() => saveEditedSheet(sheet.id)} />
                    </div>
                  </div>
                {:else}
                  <div class="space-y-3 sm:space-y-4">
                    {#if sheet.content}
                      <div class="cheatsheet-content text-sm text-[var(--dash-text)]">
                        {@html sheet.content}
                      </div>
                    {:else}
                      <p class="text-[var(--dash-text-secondary)] italic">No content yet</p>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}

          </Card>
        {:else}
          <!-- Story Card -->
          {@const story = item}
          {@const isExpanded = expandedKey === item.key}
          {@const isEditing = editingKey === item.key}
          <Card class="overflow-hidden relative transition-all">
            <button
              type="button"
              onclick={(e) => { e.stopPropagation(); toggleExpand(item.key); }}
              class="absolute top-3 right-3 p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors z-10"
              aria-label={isExpanded ? "Collapse" : "Expand"}
            >
              <span class="inline-block transition-transform duration-200 {isExpanded ? 'rotate-90' : ''}">
                <FontAwesomeIcon icon={faChevronRight} class="w-4 h-4" />
              </span>
            </button>

            <button type="button" onclick={() => toggleExpand(item.key)}
              class="w-full p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors text-left cursor-pointer">
              <div class="flex items-start gap-3">
                <div class="hidden md:flex flex-shrink-0">
                  <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                    <FontAwesomeIcon icon={faBook} class="w-6 h-6 text-blue-600" />
                  </div>
                </div>
                <div class="flex-1 min-w-0">
                  <h3 class="font-medium text-[var(--dash-text)] text-sm sm:text-base line-clamp-2 sm:truncate pr-14">
                    {story.title || "Untitled Story"}
                  </h3>
                  <div class="flex items-center gap-2 sm:gap-3 mt-1 text-xs sm:text-sm text-[var(--dash-text-secondary)] flex-wrap">
                    <span class="text-xs text-[var(--dash-text-muted)]">Project Story</span>
                    {#if story.category}
                      <span class="px-2 py-0.5 rounded-full bg-[var(--dash-info-light)] text-[var(--dash-info)] font-medium">
                        {getCategoryLabel(story.category)}
                      </span>
                    {/if}
                  </div>
                </div>
                <div class="flex-shrink-0 md:hidden flex flex-col items-end">
                  <div class="h-6 mb-1"></div>
                  <div class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center">
                    <FontAwesomeIcon icon={faBook} class="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>
            </button>

            {#if !isEditing}
              <button
                type="button"
                onclick={(e) => { e.stopPropagation(); startEditStory(story); }}
                class="absolute top-3 right-10 p-1.5 text-[var(--dash-text-secondary)] hover:text-[var(--dash-primary)] transition-colors z-10 cursor-pointer"
                aria-label="Edit"
              >
                <FontAwesomeIcon icon={faPencil} class="w-4 h-4" />
              </button>
            {/if}

            {#if isExpanded}
              <div class="border-t border-[var(--dash-border)] p-3 sm:p-4">
                {#if isEditing}
                  <div class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label for="edit-story-title-{story.id}" class="block text-sm font-semibold text-[var(--dash-text)] mb-1">
                          Title <span class="text-[var(--dash-error)]">*</span>
                        </label>
                        <input type="text" id="edit-story-title-{story.id}" bind:value={editStoryTitle}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent" />
                      </div>
                      <div>
                        <label for="edit-story-category-{story.id}" class="block text-sm font-semibold text-[var(--dash-text)] mb-1">Category</label>
                        <select id="edit-story-category-{story.id}" bind:value={editStoryCategory}
                          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent">
                          <option value="">Select a category</option>
                          {#each categories as cat}
                            <option value={cat.value}>{cat.label}</option>
                          {/each}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label for="edit-story-situation-{story.id}" class="block text-sm font-semibold text-[var(--dash-text)] mb-1">Situation</label>
                      <textarea id="edit-story-situation-{story.id}" bind:value={editStorySituation} rows={3}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[120px] sm:min-h-0"></textarea>
                    </div>
                    <div>
                      <label for="edit-story-task-{story.id}" class="block text-sm font-semibold text-[var(--dash-text)] mb-1">Task</label>
                      <textarea id="edit-story-task-{story.id}" bind:value={editStoryTask} rows={2}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[100px] sm:min-h-0"></textarea>
                    </div>
                    <div>
                      <label for="edit-story-action-{story.id}" class="block text-sm font-semibold text-[var(--dash-text)] mb-1">Action</label>
                      <textarea id="edit-story-action-{story.id}" bind:value={editStoryAction} rows={4}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[150px] sm:min-h-0"></textarea>
                    </div>
                    <div>
                      <label for="edit-story-result-{story.id}" class="block text-sm font-semibold text-[var(--dash-text)] mb-1">Result</label>
                      <textarea id="edit-story-result-{story.id}" bind:value={editStoryResult} rows={3}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[120px] sm:min-h-0"></textarea>
                    </div>
                    <div>
                      <label for="edit-story-reflection-{story.id}" class="block text-sm font-semibold text-[var(--dash-text)] mb-1">Reflection (optional)</label>
                      <textarea id="edit-story-reflection-{story.id}" bind:value={editStoryReflection} rows={2}
                        class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-y min-h-[100px] sm:min-h-0"></textarea>
                    </div>
                  </div>
                  <div class="flex items-center mt-4">
                    <button type="button" onclick={() => { deleteKey = item.key; deleteType = "story"; }}
                      class="px-3 py-2 text-xs bg-red-500/10 border border-red-500/30 rounded-lg text-red-500 hover:bg-red-500/20 hover:border-red-500/50 transition-colors flex items-center gap-1.5">
                      <FontAwesomeIcon icon={faTrash} class="w-3 h-3" /> Delete
                    </button>
                    <div class="flex gap-2 ml-auto">
                      <button type="button" onclick={cancelEdit}
                        class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors">
                        Cancel
                      </button>
                      <SectionSaveButton state={editSaveState} onClick={() => saveEditedStory(story.id)} />
                    </div>
                  </div>
                {:else}
                  <div class="space-y-3 sm:space-y-4">
                    {#if story.situation}
                      <div>
                        <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">Situation</p>
                        <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{story.situation}</p>
                      </div>
                    {/if}
                    {#if story.task}
                      <div>
                        <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">Task</p>
                        <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{story.task}</p>
                      </div>
                    {/if}
                    {#if story.action}
                      <div>
                        <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">Action</p>
                        <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{story.action}</p>
                      </div>
                    {/if}
                    {#if story.result}
                      <div>
                        <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">Result</p>
                        <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{story.result}</p>
                      </div>
                    {/if}
                    {#if story.reflection}
                      <div>
                        <p class="text-xs text-[var(--dash-text-secondary)] uppercase tracking-wide mb-1">Reflection</p>
                        <p class="text-sm text-[var(--dash-text)] whitespace-pre-wrap">{story.reflection}</p>
                      </div>
                    {/if}
                  </div>
                {/if}
              </div>
            {/if}

          </Card>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<!-- Delete Confirmation Modal -->
<ConfirmModal
  isOpen={deleteKey !== null}
  title={deleteType === "cheatsheet" ? "Delete Interview Cheat Sheet" : "Delete Story"}
  message={deleteType === "cheatsheet"
    ? "Are you sure you want to delete this interview cheat sheet? This action cannot be undone."
    : "Are you sure you want to delete this project story? This action cannot be undone."}
  onCancel={() => (deleteKey = null)}
  onConfirm={handleDelete}
/>

<ConfirmModal
  isOpen={showDiscardConfirm}
  title="Discard Changes"
  message="You have unsaved changes. Are you sure you want to discard them?"
  onCancel={() => (showDiscardConfirm = false)}
  onConfirm={confirmDiscard}
/>

<style>
  .cheatsheet-content :global(h3) {
    font-size: 1.1em;
    font-weight: 600;
    margin-top: 0.75em;
    margin-bottom: 0.5em;
  }
  .cheatsheet-content :global(p) {
    margin-bottom: 0.5em;
  }
  .cheatsheet-content :global(ul),
  .cheatsheet-content :global(ol) {
    margin-left: 1.25em;
    margin-bottom: 0.5em;
  }
  .cheatsheet-content :global(ul) {
    list-style-type: disc;
  }
  .cheatsheet-content :global(ol) {
    list-style-type: decimal;
  }
  .cheatsheet-content :global(li) {
    margin-bottom: 0.25em;
  }
  .cheatsheet-content :global(strong) {
    font-weight: 600;
  }
  .cheatsheet-content :global(em) {
    font-style: italic;
  }
</style>
