<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faChevronDown,
    faChevronRight,
    faGripVertical,
    faPlus,
    faTimes,
    faUndo,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionSaveButton from "$lib/components/SectionSaveButton.svelte";
  import ProjectDocuments from "./ProjectDocuments.svelte";
  import { dndzone } from "svelte-dnd-action";
  import { flip } from "svelte/animate";

  type SaveState = "idle" | "saving" | "saved" | "error";

  interface InitialTech {
    name: string | null;
  }
  interface InitialProject {
    id: number;
    name: string | null;
    url: string | null;
    start_date: string | Date | null;
    end_date: string | Date | null;
    description: string | null;
    outcome: string | null;
    work_experience_project_technologies: InitialTech[];
  }

  interface DocForList {
    id: number;
    kind: string;
    title: string | null;
    original_filename: string | null;
    status: string;
    summary: string | null;
    keywords: unknown;
    skipped: unknown;
    file_count: number;
    total_bytes: number;
  }

  let {
    workExperienceId,
    projects: initial,
    profileId,
    documentsByProject = {},
  }: {
    workExperienceId: number;
    projects: InitialProject[];
    profileId: number;
    documentsByProject?: Record<number, DocForList[]>;
  } = $props();

  // `_key` is a stable client-side key so #each and drag-reorder can track a
  // project across moves and inserts; it's stripped before saving.
  interface ProjectItem {
    id?: number;
    name: string;
    url: string;
    start_date: string;
    end_date: string;
    description: string;
    outcome: string;
    technologies: string[];
    _key: number;
  }

  function formatDate(date: Date | string | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString().split("T")[0];
  }

  let keySeq = 0;
  let items = $state<ProjectItem[]>(
    initial.map((p) => ({
      id: p.id,
      name: p.name ?? "",
      url: p.url ?? "",
      start_date: formatDate(p.start_date),
      end_date: formatDate(p.end_date),
      description: p.description ?? "",
      outcome: p.outcome ?? "",
      technologies: (p.work_experience_project_technologies ?? [])
        .map((t) => t.name ?? "")
        .filter(Boolean),
      _key: keySeq++,
    })),
  );

  let deleted = $state<Set<number>>(new Set());
  let expanded = $state<number | null>(null);
  let saveState = $state<SaveState>("idle");

  function yearLabel(value: string): string {
    return value ? value.slice(0, 4) : "";
  }

  function dateRange(p: ProjectItem): string {
    const start = yearLabel(p.start_date);
    const end = yearLabel(p.end_date);
    if (start && end) return start === end ? start : `${start} – ${end}`;
    if (start) return `${start} – present`;
    return end;
  }

  function toggleExpand(index: number) {
    expanded = expanded === index ? null : index;
  }

  function addProject() {
    items = [
      ...items,
      {
        name: "",
        url: "",
        start_date: "",
        end_date: "",
        description: "",
        outcome: "",
        technologies: [],
        _key: keySeq++,
      },
    ];
    expanded = items.length - 1;
  }

  function isEmptyProject(p: ProjectItem): boolean {
    return (
      !p.name.trim() &&
      !p.url.trim() &&
      !p.description.trim() &&
      !p.outcome.trim() &&
      p.technologies.filter((t) => t.trim()).length === 0
    );
  }

  function removeProject(index: number) {
    if (isEmptyProject(items[index])) {
      // Brand-new empty row — drop it and remap side state by index.
      items = items.filter((_, i) => i !== index);
      const remap = (set: Set<number>) => {
        const next = new Set<number>();
        set.forEach((i) => {
          if (i > index) next.add(i - 1);
          else if (i < index) next.add(i);
        });
        return next;
      };
      deleted = remap(deleted);
      if (expanded === index) expanded = null;
      else if (expanded !== null && expanded > index) expanded -= 1;
    } else {
      deleted = new Set([...deleted, index]);
      if (expanded === index) expanded = null;
    }
  }

  function undoRemove(index: number) {
    const next = new Set(deleted);
    next.delete(index);
    deleted = next;
  }

  // --- Per-project technologies (simple chip list, no version tags) ---
  function addTech(pi: number) {
    items[pi].technologies = [...items[pi].technologies, ""];
  }

  function removeTech(pi: number, ti: number) {
    items[pi].technologies = items[pi].technologies.filter((_, i) => i !== ti);
  }

  // --- Drag reorder (gated behind a toggle, like the Technologies section) ---
  const flipMs = 150;
  let reorderMode = $state(false);
  let reorderSnapshot = $state<{ items: ProjectItem[]; deleted: Set<number> } | null>(null);

  interface DndProject {
    id: number;
    project: ProjectItem;
    deleted: boolean;
  }
  let dnd = $state<DndProject[]>([]);

  function startReorder() {
    reorderSnapshot = {
      items: items.map((p) => ({ ...p })),
      deleted: new Set(deleted),
    };
    dnd = items.map((p, i) => ({ id: p._key, project: p, deleted: deleted.has(i) }));
    expanded = null;
    reorderMode = true;
  }

  function applyDndOrder(next: DndProject[]) {
    dnd = next;
    items = next.map((d) => d.project);
    deleted = new Set(next.flatMap((d, i) => (d.deleted ? [i] : [])));
  }

  function handleConsider(e: CustomEvent<{ items: DndProject[] }>) {
    dnd = e.detail.items;
  }

  function handleFinalize(e: CustomEvent<{ items: DndProject[] }>) {
    applyDndOrder(e.detail.items);
  }

  function cancelReorder() {
    if (reorderSnapshot) {
      items = reorderSnapshot.items;
      deleted = reorderSnapshot.deleted;
    }
    reorderSnapshot = null;
    reorderMode = false;
    dnd = [];
  }

  async function saveReorder() {
    await save();
    if (saveState === "error") return; // stay in reorder mode so the user can retry
    reorderSnapshot = null;
    reorderMode = false;
    dnd = [];
  }

  async function save() {
    saveState = "saving";
    try {
      // Track the source indices we send so the server's returned ids can be
      // written back onto the freshly-inserted projects (keeps them stable for
      // the next save without a reload).
      const sent = items
        .map((p, i) => ({ p, i }))
        .filter(({ p, i }) => p.name.trim() && !deleted.has(i));

      const response = await fetch(`/api/work-experience/${workExperienceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: "projects",
          projects: sent.map(({ p }) => ({
            id: p.id,
            name: p.name.trim(),
            url: p.url.trim() || null,
            start_date: p.start_date || null,
            end_date: p.end_date || null,
            description: p.description.trim() || null,
            outcome: p.outcome.trim() || null,
            technologies: p.technologies.map((t) => t.trim()).filter(Boolean),
          })),
        }),
      });

      if (response.ok) {
        const result = await response.json().catch(() => null);
        if (result && Array.isArray(result.projects)) {
          const updated = [...items];
          sent.forEach(({ i }, k) => {
            const newId = result.projects[k]?.id;
            if (newId) updated[i] = { ...updated[i], id: newId };
          });
          items = updated;
        }
        saveState = "saved";
        setTimeout(() => (saveState = "idle"), 2000);
      } else {
        saveState = "error";
        setTimeout(() => (saveState = "idle"), 3000);
      }
    } catch {
      saveState = "error";
      setTimeout(() => (saveState = "idle"), 3000);
    }
  }

  const inputClass =
    "w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent";
</script>

{#if reorderMode}
  <div
    class="border border-[var(--dash-border)] rounded-md overflow-hidden"
    use:dndzone={{ items: dnd, flipDurationMs: flipMs, type: "we-projects" }}
    onconsider={handleConsider}
    onfinalize={handleFinalize}
  >
    {#each dnd as item, index (item.id)}
      <div
        animate:flip={{ duration: flipMs }}
        class="flex items-center cursor-grab active:cursor-grabbing {index > 0 ? 'border-t border-[var(--dash-border)]' : ''} {item.deleted ? 'opacity-50 bg-[var(--dash-bg)]/50' : ''}"
      >
        <span class="pl-3 pr-1 self-stretch flex items-center text-[var(--dash-text-secondary)]/60" aria-hidden="true">
          <FontAwesomeIcon icon={faGripVertical} class="w-3 h-3" />
        </span>
        <span class="flex-1 px-2 py-3 text-[var(--dash-text)] {item.deleted ? 'line-through text-[var(--dash-text-secondary)]' : ''} {!item.project.name.trim() ? 'italic text-[var(--dash-text-secondary)]' : ''}">
          {item.project.name.trim() || "Untitled project"}
        </span>
        {#if dateRange(item.project)}
          <span class="px-3 text-xs text-[var(--dash-text-muted)]">{dateRange(item.project)}</span>
        {/if}
      </div>
    {/each}
  </div>
  <div class="flex items-center justify-end gap-2 mt-4">
    <span class="mr-auto text-xs text-[var(--dash-text-muted)]">Drag to reorder, then save.</span>
    <button
      type="button"
      onclick={cancelReorder}
      class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
    >
      Cancel
    </button>
    <SectionSaveButton state={saveState} onClick={saveReorder} />
  </div>
{:else}
  {#if items.length > 1}
    <div class="flex justify-end mb-2">
      <button
        type="button"
        onclick={startReorder}
        class="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded border transition-colors bg-[var(--dash-bg)] text-[var(--dash-text-muted)] border-[var(--dash-border)] hover:text-[var(--dash-text)]"
      >
        <span class="inline-block w-1.5 h-1.5 rounded-full bg-[var(--dash-text-muted)]/30"></span>
        Reorder
      </button>
    </div>
  {/if}

  {#if items.length === 0}
    <p class="text-[var(--dash-text-secondary)] text-sm">No projects added yet.</p>
  {:else}
    <div class="space-y-3">
      {#each items as project, index (project._key)}
        {@const isDeleted = deleted.has(index)}
        {@const isOpen = expanded === index}
        <div class="border border-[var(--dash-border)] rounded-lg overflow-hidden {isDeleted ? 'opacity-50' : ''}">
          <!-- Header row -->
          <div class="flex items-center">
            {#if isDeleted}
              <span class="flex-1 px-4 py-3 text-[var(--dash-text-secondary)] line-through">
                {project.name.trim() || "Untitled project"}
              </span>
              <button
                type="button"
                onclick={() => undoRemove(index)}
                class="p-3 text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] transition-colors"
                aria-label="Undo"
              >
                <FontAwesomeIcon icon={faUndo} class="w-4 h-4" />
              </button>
            {:else}
              <button
                type="button"
                onclick={() => toggleExpand(index)}
                class="flex-1 flex items-center gap-2 px-4 py-3 text-left hover:bg-[var(--dash-bg)]/50 transition-colors"
              >
                <FontAwesomeIcon icon={isOpen ? faChevronDown : faChevronRight} class="w-3 h-3 text-[var(--dash-text-secondary)]" />
                <span class="flex-1 text-[var(--dash-text)] {!project.name.trim() ? 'italic text-[var(--dash-text-secondary)]' : ''}">
                  {project.name.trim() || "Untitled project"}
                </span>
                {#if dateRange(project)}
                  <span class="text-xs text-[var(--dash-text-muted)]">{dateRange(project)}</span>
                {/if}
              </button>
              <button
                type="button"
                onclick={() => removeProject(index)}
                class="p-3 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors"
                aria-label="Remove project"
              >
                <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
              </button>
            {/if}
          </div>

          <!-- Editor body -->
          {#if isOpen && !isDeleted}
            <div class="border-t border-[var(--dash-border)] p-4 space-y-4 bg-[var(--dash-bg)]/30">
              <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label for="proj-name-{project._key}" class="block text-sm font-medium text-[var(--dash-text)] mb-1">
                    Project Name <span class="text-[var(--dash-error)]">*</span>
                  </label>
                  <input id="proj-name-{project._key}" type="text" bind:value={items[index].name} placeholder="e.g. Checkout redesign" class={inputClass} />
                </div>
                <div>
                  <label for="proj-url-{project._key}" class="block text-sm font-medium text-[var(--dash-text)] mb-1">URL</label>
                  <input id="proj-url-{project._key}" type="url" bind:value={items[index].url} placeholder="https://…" class={inputClass} />
                </div>
                <div>
                  <label for="proj-start-{project._key}" class="block text-sm font-medium text-[var(--dash-text)] mb-1">Start Date</label>
                  <input id="proj-start-{project._key}" type="date" bind:value={items[index].start_date} class={inputClass} />
                </div>
                <div>
                  <label for="proj-end-{project._key}" class="block text-sm font-medium text-[var(--dash-text)] mb-1">End Date</label>
                  <input id="proj-end-{project._key}" type="date" bind:value={items[index].end_date} class={inputClass} />
                </div>
              </div>

              <div>
                <label for="proj-desc-{project._key}" class="block text-sm font-medium text-[var(--dash-text)] mb-1">Description</label>
                <textarea id="proj-desc-{project._key}" bind:value={items[index].description} rows={3} placeholder="What was the project and your role in it?" class="{inputClass} resize-y"></textarea>
              </div>

              <div>
                <label for="proj-outcome-{project._key}" class="block text-sm font-medium text-[var(--dash-text)] mb-1">Outcome</label>
                <textarea id="proj-outcome-{project._key}" bind:value={items[index].outcome} rows={2} placeholder="The result or impact (e.g. cut checkout time by 30%)." class="{inputClass} resize-y"></textarea>
              </div>

              <div>
                <span class="block text-sm font-medium text-[var(--dash-text)] mb-1">Technologies</span>
                <div class="flex flex-wrap gap-2">
                  {#each items[index].technologies as _, ti}
                    <div class="flex items-center gap-1 rounded-lg pl-3.5 pr-1 py-1 bg-[var(--dash-primary)]/5 border border-[var(--dash-primary)]/20">
                      <div class="relative pr-3">
                        <span class="invisible whitespace-pre text-sm min-w-[3ch]">{items[index].technologies[ti] || "Technology"}</span>
                        <input
                          type="text"
                          bind:value={items[index].technologies[ti]}
                          placeholder="Technology"
                          class="absolute inset-0 bg-transparent border-none focus:outline-none text-[var(--dash-text)] text-sm w-full pr-3"
                        />
                      </div>
                      <button type="button" onclick={() => removeTech(index, ti)} class="p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-error)] transition-colors" aria-label="Remove technology">
                        <FontAwesomeIcon icon={faTimes} class="w-3 h-3" />
                      </button>
                    </div>
                  {/each}
                  <button
                    type="button"
                    onclick={() => addTech(index)}
                    class="flex items-center gap-1 px-3 py-1 border border-dashed border-[var(--dash-border)] rounded-lg text-sm text-[var(--dash-primary)] hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary-hover)] transition-colors"
                  >
                    <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
                    Add
                  </button>
                </div>
              </div>

              <!-- Files & source code -->
              <div>
                <span class="block text-sm font-medium text-[var(--dash-text)] mb-1">
                  Files & source code
                </span>
                {#if project.id}
                  <ProjectDocuments
                    {profileId}
                    workExperienceProjectId={project.id}
                    documents={documentsByProject[project.id] ?? []}
                  />
                {:else}
                  <p class="text-xs text-[var(--dash-text-muted)] italic">
                    Save this project first, then you can attach files.
                  </p>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}

  <button
    type="button"
    onclick={addProject}
    class="text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)] text-sm flex items-center gap-1 mt-3"
  >
    <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
    Add Project
  </button>

  <div class="flex justify-end mt-4">
    <SectionSaveButton state={saveState} onClick={save} />
  </div>
{/if}
