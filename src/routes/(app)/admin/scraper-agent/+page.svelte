<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faRobot,
    faPlay,
    faChevronRight,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import Card from "../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import { searchTaskDisplayName } from "$lib/format";
  import {
    type SearchTask,
    type SessionSummary,
    DEFAULT_SYSTEM_PROMPT,
    statusColor,
    statusDot,
    stageLabel,
    stageColor,
    formatTime,
    progressPct,
  } from "./shared";

  let { data } = $props();

  let sessions = $state<SessionSummary[]>([]);
  let loading = $state(true);
  let errorMsg = $state("");
  let pollInterval: ReturnType<typeof setInterval> | null = null;

  // Create form state
  let showCreateForm = $state(false);
  let createUserId = $state<string | null>(null);
  let createSearchTaskId = $state<number | null>(null);
  let createMaxIterations = $state(10);
  let createGoal = $state("");
  let createSystemPrompt = $state(DEFAULT_SYSTEM_PROMPT);
  let createRunFirst = $state(false);
  let creating = $state(false);

  let filteredSearchTasks = $derived(
    createUserId
      ? (data.searchTasks as SearchTask[]).filter((t) => t.userId === createUserId)
      : (data.searchTasks as SearchTask[]),
  );

  async function loadSessions() {
    try {
      const response = await fetch("/api/admin/scraper-agent");
      if (response.ok) {
        const result = await response.json();
        if (JSON.stringify(result.sessions) !== JSON.stringify(sessions)) {
          sessions = result.sessions;
        }
        errorMsg = "";
      } else {
        errorMsg = "Failed to load sessions";
      }
    } catch {
      errorMsg = "Failed to load sessions";
    } finally {
      loading = false;
    }
  }

  async function createSession() {
    if (!createSearchTaskId) return;
    creating = true;
    try {
      const response = await fetch("/api/admin/scraper-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchTaskId: createSearchTaskId,
          maxIterations: createMaxIterations,
          goal: createGoal,
          systemPrompt: createSystemPrompt || undefined,
          runFirst: createRunFirst,
        }),
      });
      if (response.ok) {
        const result = await response.json();
        goto(`/admin/scraper-agent/${result.id}`);
      } else {
        const text = await response.text();
        try {
          const err = JSON.parse(text);
          errorMsg = err.message || text;
        } catch {
          errorMsg = text;
        }
      }
    } catch {
      errorMsg = "Failed to create session";
    } finally {
      creating = false;
    }
  }

  // Handle retry=SESSION_ID from detail page
  async function handleRetryParam() {
    const retryId = $page.url.searchParams.get("retry");
    if (!retryId) return;

    // Clear the param from URL
    const url = new URL($page.url);
    url.searchParams.delete("retry");
    history.replaceState({}, "", url.pathname);

    try {
      const response = await fetch(`/api/admin/scraper-agent/${retryId}`);
      if (response.ok) {
        const result = await response.json();
        const session = result.session;
        const task = (data.searchTasks as SearchTask[]).find((t) => t.id === session.searchTaskId);
        createUserId = task?.userId ?? null;
        createSearchTaskId = session.searchTaskId;
        createMaxIterations = session.maxIterations;
        createGoal = session.goal;
        createSystemPrompt = session.systemPrompt || DEFAULT_SYSTEM_PROMPT;
        createRunFirst = session.runFirst;
        showCreateForm = true;
      }
    } catch {
      // Ignore - just don't pre-fill
    }
  }

  onMount(() => {
    loadSessions();
    handleRetryParam();
    pollInterval = setInterval(loadSessions, 5000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });
</script>

<div class="space-y-6">
  <SectionHeader
    title="Scraper Agent"
    icon={faRobot}
    showAddButton={!showCreateForm}
    addLabel="New Session"
    onAdd={() => (showCreateForm = true)}
  />

  <!-- Create Form -->
  {#if showCreateForm}
    <Card padding="responsive">
      <div class="space-y-4">
        <h3 class="text-sm font-medium text-[var(--dash-text)]">Create New Session</h3>

        <div class="grid gap-4 sm:grid-cols-2">
          <div>
            <label for="user-filter" class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1">
              User
            </label>
            <select
              id="user-filter"
              bind:value={createUserId}
              onchange={() => (createSearchTaskId = null)}
              class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-sm text-[var(--dash-text)] px-3 py-2"
            >
              <option value={null}>All users</option>
              {#each data.users as user}
                <option value={user.id}>{user.name}</option>
              {/each}
            </select>
          </div>

          <div>
            <label for="search-task" class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1">
              Search Task
            </label>
            <select
              id="search-task"
              bind:value={createSearchTaskId}
              class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-sm text-[var(--dash-text)] px-3 py-2"
            >
              <option value={null}>Select a search task...</option>
              {#each filteredSearchTasks as task}
                <option value={task.id}>
                  {searchTaskDisplayName(task.platformName, task.note)}{createUserId ? "" : ` (${task.userName || "No user"})`}
                </option>
              {/each}
            </select>
          </div>

          <div>
            <label for="max-iter" class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1">
              Max Iterations
            </label>
            <input
              id="max-iter"
              type="number"
              min="1"
              max="50"
              bind:value={createMaxIterations}
              class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-sm text-[var(--dash-text)] px-3 py-2 max-w-32"
            />
          </div>
        </div>

        <label class="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={createRunFirst}
            class="rounded border-[var(--dash-border)] text-[var(--dash-primary)]"
          />
          <span class="text-xs text-[var(--dash-text-secondary)]">
            Run initial scrape first
          </span>
          <span class="text-xs text-[var(--dash-text-muted)]">
            — runs a baseline scrape before Claude starts analyzing
          </span>
        </label>

        <div>
          <label for="goal" class="block text-xs font-medium text-[var(--dash-text-secondary)] mb-1">
            Goal
            <span class="font-normal text-[var(--dash-text-muted)]">— what should the results look like?</span>
          </label>
          <textarea
            id="goal"
            bind:value={createGoal}
            rows="4"
            placeholder="e.g. focus on fixing the job description extraction, many jobs have empty descriptions. Also make sure pagination works to scrape at least 3 pages."
            class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-sm text-[var(--dash-text)] px-3 py-2 min-h-[6rem]"
          ></textarea>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1">
            <label for="system-prompt" class="block text-xs font-medium text-[var(--dash-text-secondary)]">
              System Prompt
            </label>
            {#if createSystemPrompt !== DEFAULT_SYSTEM_PROMPT}
              <button
                onclick={() => (createSystemPrompt = DEFAULT_SYSTEM_PROMPT)}
                class="text-xs text-[var(--dash-primary)] hover:underline"
              >
                Reset to default
              </button>
            {/if}
          </div>
          <textarea
            id="system-prompt"
            bind:value={createSystemPrompt}
            rows="10"
            class="w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-sm text-[var(--dash-text)] px-3 py-2 font-mono text-xs leading-relaxed min-h-[10rem]"
          ></textarea>
        </div>

        <div class="flex gap-2 justify-end">
          <button
            onclick={() => (showCreateForm = false)}
            class="px-3 py-1.5 text-xs rounded-lg bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-border)] transition-colors"
          >
            Cancel
          </button>
          <button
            onclick={createSession}
            disabled={!createSearchTaskId || !createGoal.trim() || creating}
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary)]/90 transition-colors disabled:opacity-50"
          >
            {#if creating}
              <Spinner size="w-3 h-3" />
            {:else}
              <FontAwesomeIcon icon={faPlay} class="w-3 h-3" />
            {/if}
            Start Session
          </button>
        </div>
      </div>
    </Card>
  {/if}

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <Spinner size="w-6 h-6" color="var(--dash-primary)" />
    </div>
  {:else if errorMsg && sessions.length === 0}
    <Card padding="responsive">
      <p class="text-[var(--dash-error)] text-sm">{errorMsg}</p>
    </Card>
  {:else if sessions.length === 0}
    <Card padding="responsive">
      <p class="text-sm text-[var(--dash-text-muted)] text-center py-4">
        No scraper agent sessions yet. Create one to start improving a scraper automatically.
      </p>
    </Card>
  {:else}
    {#if errorMsg}
      <Card padding="responsive">
        <p class="text-[var(--dash-error)] text-sm">{errorMsg}</p>
      </Card>
    {/if}
    <div class="space-y-2">
      {#each sessions as session (session.id)}
        <a
          href="/admin/scraper-agent/{session.id}"
          class="block"
        >
          <Card padding="responsive" class="hover:border-[var(--dash-primary)]/40 transition-colors">
            <div class="flex items-center gap-2 mb-1">
              {#if session.status === "active"}
                <span class="relative flex h-2 w-2 flex-shrink-0">
                  <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span class="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
              {:else}
                <span class="w-2 h-2 rounded-full flex-shrink-0 {statusDot(session.status)}"></span>
              {/if}
              <span class="text-xs font-medium {statusColor(session.status)} uppercase">{session.status}</span>
              <span class="text-sm font-medium text-[var(--dash-text)] truncate">
                {session.searchTaskName}
              </span>
              <FontAwesomeIcon
                icon={faChevronRight}
                class="w-3 h-3 text-[var(--dash-text-muted)] flex-shrink-0 ml-auto"
              />
            </div>

            <!-- Progress -->
            <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--dash-text-secondary)]">
              <span>
                Iteration {session.currentIteration}/{session.maxIterations}
              </span>
              {#if session.status === "active" && session.latestStage && session.latestStage !== "done"}
                <span class={stageColor(session.latestStage)}>
                  {stageLabel(session.latestStage)}
                </span>
              {/if}
              {#if session.latestSuccessPct !== null}
                <span class="text-[var(--dash-text-muted)]">
                  {session.latestSuccessPct.toFixed(1)}%
                </span>
              {/if}
              {#if session.latestGoalMet === true}
                <span class="text-green-600">Goal met</span>
              {:else if session.latestGoalMet === false}
                <span class="text-amber-600">Goal not met</span>
              {/if}
              <span>{formatTime(session.createdAt)}</span>
            </div>

            <!-- Progress bar -->
            {#if session.currentIteration > 0}
              <div class="mt-2 h-1.5 bg-[var(--dash-border)] rounded-full overflow-hidden">
                <div
                  class="h-full rounded-full transition-all duration-300 {session.status === 'completed' ? 'bg-[var(--dash-primary)]' : session.status === 'failed' ? 'bg-[var(--dash-error)]' : 'bg-green-500'}"
                  style="width: {progressPct(session)}%"
                ></div>
              </div>
            {/if}

            <!-- Error message -->
            {#if session.errorMessage && session.status !== "active"}
              <p class="text-xs text-[var(--dash-text-muted)] mt-1 truncate" title={session.errorMessage}>
                {session.errorMessage}
              </p>
            {/if}
          </Card>
        </a>
      {/each}
    </div>
  {/if}
</div>
