<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faRobot,
    faPlay,
    faPause,
    faStop,
    faChevronDown,
    faChevronRight,
    faRotateRight,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import Card from "../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";

  interface SearchTask {
    id: number;
    name: string;
    profileName: string | null;
    platformName: string | null;
    browserProvider: string | null;
    userId: string | null;
    userName: string | null;
  }

  interface User {
    id: string;
    name: string;
  }

  interface Session {
    id: number;
    searchTaskId: number;
    searchTaskName: string;
    status: string;
    goal: string;
    maxIterations: number;
    currentIteration: number;
    latestStage: string | null;
    latestSuccessPct: number | null;
    latestRunStatus: string | null;
    latestGoalMet: boolean | null;
    systemPrompt: string | null;
    runFirst: boolean;
    pendingHint: string | null;
    needsInput: string | null;
    errorMessage: string | null;
    createdAt: string;
    updatedAt: string;
    finishedAt: string | null;
  }

  interface Iteration {
    id: number;
    iteration: number;
    stage: string | null;
    runId: number | null;
    runStatus: string | null;
    itemsTotal: number | null;
    itemsCompleted: number | null;
    itemsError: number | null;
    successPct: number | null;
    goalMet: boolean | null;
    goalEvaluation: string | null;
    prompt: string | null;
    claudeAnalysis: string | null;
    claudeChanges: string | null;
    startedAt: string;
    finishedAt: string | null;
  }

  const DEFAULT_SYSTEM_PROMPT = `You are improving a generic job scraper that must work across a wide variety of job sites (LinkedIn, Indeed, Glassdoor, niche boards, etc.) without any site-specific code.

Key principles:
- NEVER write code that targets a specific site. All logic must be generic and pattern-based.
- The scraper uses CDP clickable detection, LLM extraction, and pattern matching — not CSS selectors for specific sites.
- Tactics and patterns are designed to catch most cases across many sites and languages (EN, ES, DE, FR, NL, PT). A fix that helps one site must not break others.
- Different tactics should not interfere with each other. Guard new logic so it activates only when relevant conditions are met.
- When fixing extraction issues, think about WHY the generic approach failed and fix the general case, not the specific page.
- The scraper handles: pagination detection, cookie/overlay dismissal, login flows, SPA navigation, content revelation (expand buttons, tabs), challenge detection (Cloudflare, CAPTCHA), and page degradation recovery.
- Test your reasoning: "Would this change work on a site I've never seen?" If not, make it more generic.

Debugging:
- The scraper has a structured logging system (see scrape-logger.ts). All logs are stored per-run and shown to you in the next iteration.
- When you can't determine the root cause from existing logs, add debug logging at strategic points to capture intermediate state. The next run will include these logs so you can diagnose the issue.
- Clean up too verbose debug logging once the issue is resolved. General debug logging that aids future troubleshooting is fine to keep.

Asking for help:
- If you're stuck and can't make progress (e.g. same errors repeating, unclear site behavior, need domain knowledge), you can request human input by including this block in your response:
=== NEEDS_INPUT ===
Your question here — what do you need to know?
=== END_NEEDS_INPUT ===
- This will pause the session so the developer can respond. Only use this when you genuinely can't figure it out yourself.

Focus areas when analyzing logs:
- Items with status "error" — what went wrong during click, extraction, or navigation?
- LLM extraction quality — are jobs being parsed correctly from the HTML?
- Pagination — is the scraper finding and clicking the next page?
- Click handling — are job cards being opened successfully (new tab, SPA, modal)?
- Content revelation — is the full job description being captured?`;

  let { data } = $props();

  let sessions = $state<Session[]>([]);
  let loading = $state(true);
  let errorMsg = $state("");
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let actionInProgress = $state<Record<number, string>>({});
  let confirmCommit = $state<number | null>(null);
  let committing = $state(false);

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

  // Hint inputs per session
  let hintInputs = $state<Record<number, string>>({});
  let hintSending = $state<Record<number, boolean>>({});

  // Expanded session detail
  let expandedSession = $state<number | null>(null);
  let sessionIterations = $state<Record<number, Iteration[]>>({});
  let loadingIterations = $state<Record<number, boolean>>({});

  async function loadSessions() {
    try {
      const response = await fetch("/api/admin/scraper-agent");
      if (response.ok) {
        const result = await response.json();
        // Only update if data actually changed to avoid re-renders that reset scroll
        if (JSON.stringify(result.sessions) !== JSON.stringify(sessions)) {
          sessions = result.sessions;
        }
        errorMsg = "";
        // Refresh expanded session's iterations too
        if (expandedSession) {
          loadIterations(expandedSession);
        }
      } else {
        errorMsg = "Failed to load sessions";
      }
    } catch {
      errorMsg = "Failed to load sessions";
    } finally {
      loading = false;
    }
  }

  async function loadIterations(sessionId: number) {
    const isFirstLoad = !sessionIterations[sessionId];
    if (isFirstLoad) loadingIterations = { ...loadingIterations, [sessionId]: true };
    try {
      const response = await fetch(`/api/admin/scraper-agent/${sessionId}`);
      if (response.ok) {
        const result = await response.json();
        if (JSON.stringify(result.iterations) !== JSON.stringify(sessionIterations[sessionId])) {
          sessionIterations = { ...sessionIterations, [sessionId]: result.iterations };
        }
      }
    } catch {
      // Ignore
    } finally {
      if (isFirstLoad) {
        const { [sessionId]: _, ...rest } = loadingIterations;
        loadingIterations = rest;
      }
    }
  }

  function toggleSession(sessionId: number) {
    if (expandedSession === sessionId) {
      expandedSession = null;
    } else {
      expandedSession = sessionId;
      if (!sessionIterations[sessionId]) {
        loadIterations(sessionId);
      }
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
        showCreateForm = false;
        createUserId = null;
        createSearchTaskId = null;
        createMaxIterations = 10;
        createGoal = "";
        createSystemPrompt = DEFAULT_SYSTEM_PROMPT;
        createRunFirst = false;
        await loadSessions();
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

  function retrySession(session: Session) {
    const task = (data.searchTasks as SearchTask[]).find((t) => t.id === session.searchTaskId);
    createUserId = task?.userId ?? null;
    createSearchTaskId = session.searchTaskId;
    createMaxIterations = session.maxIterations;
    createGoal = session.goal;
    createSystemPrompt = session.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    createRunFirst = session.runFirst;
    showCreateForm = true;
  }

  async function submitHint(sessionId: number) {
    const hint = hintInputs[sessionId]?.trim() || null;
    hintSending = { ...hintSending, [sessionId]: true };
    try {
      const response = await fetch(`/api/admin/scraper-agent/${sessionId}/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hint }),
      });
      if (response.ok) {
        const { [sessionId]: _, ...rest } = hintInputs;
        hintInputs = rest;
        await loadSessions();
      }
    } catch {
      // Ignore
    } finally {
      const { [sessionId]: _, ...rest } = hintSending;
      hintSending = rest;
    }
  }

  async function performAction(action: "pause" | "cancel" | "resume", sessionId: number) {
    actionInProgress = { ...actionInProgress, [sessionId]: action };
    try {
      const response = await fetch(`/api/admin/scraper-agent/${sessionId}/${action}`, {
        method: "POST",
      });
      if (!response.ok) {
        console.error(`Action ${action} failed:`, await response.text());
      }
      await loadSessions();
    } catch {
      console.error(`Action ${action} failed`);
    } finally {
      const { [sessionId]: _, ...rest } = actionInProgress;
      actionInProgress = rest;
    }
  }

  function isActive(status: string): boolean {
    return ["active", "paused"].includes(status);
  }

  function statusColor(status: string): string {
    switch (status) {
      case "active": return "text-green-600";
      case "paused": return "text-amber-600";
      case "completed": return "text-[var(--dash-primary)]";
      case "failed": return "text-[var(--dash-error)]";
      case "cancelled": return "text-[var(--dash-text-muted)]";
      default: return "text-[var(--dash-text-secondary)]";
    }
  }

  function statusDot(status: string): string {
    switch (status) {
      case "active": return "bg-green-500";
      case "paused": return "bg-amber-500";
      case "completed": return "bg-[var(--dash-primary)]";
      case "failed": return "bg-[var(--dash-error)]";
      case "cancelled": return "bg-gray-400";
      default: return "bg-gray-400";
    }
  }

  function formatTime(date: string): string {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function stageLabel(stage: string | null): string {
    switch (stage) {
      case "claude": return "AI analyzing & coding";
      case "reloading": return "Worker reloading";
      case "scraping": return "Running scrape";
      case "evaluating": return "Evaluating results";
      case "done": return "Done";
      case "error": return "Error";
      default: return "Starting...";
    }
  }

  function stageColor(stage: string | null): string {
    switch (stage) {
      case "claude": return "text-purple-600";
      case "reloading": return "text-amber-500";
      case "scraping": return "text-blue-600";
      case "evaluating": return "text-cyan-600";
      case "done": return "text-green-600";
      case "error": return "text-[var(--dash-error)]";
      default: return "text-[var(--dash-text-muted)]";
    }
  }

  function progressPct(session: Session): number {
    return session.maxIterations > 0
      ? (session.currentIteration / session.maxIterations) * 100
      : 0;
  }

  onMount(() => {
    loadSessions();
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
                  {task.name} @ {task.platformName || "Unknown"}{createUserId ? "" : ` (${task.userName || "No user"})`}
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
  {:else if errorMsg}
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
    <div class="space-y-2">
      {#each sessions as session (session.id)}
        <Card padding="responsive">
          <!-- Session Header -->
          <div class="flex items-start justify-between gap-4">
            <button
              onclick={() => toggleSession(session.id)}
              class="min-w-0 flex-1 text-left"
            >
              <!-- Status + Name -->
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
                  icon={expandedSession === session.id ? faChevronDown : faChevronRight}
                  class="w-3 h-3 text-[var(--dash-text-muted)] flex-shrink-0"
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
            </button>

            <!-- Actions -->
            <div class="flex items-center gap-2 flex-shrink-0">
              {#if session.status === "active"}
                <button
                  onclick={() => performAction("pause", session.id)}
                  disabled={!!actionInProgress[session.id]}
                  class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
                >
                  {#if actionInProgress[session.id] === "pause"}
                    <Spinner size="w-3 h-3" />
                  {:else}
                    <FontAwesomeIcon icon={faPause} class="w-3 h-3" />
                  {/if}
                  Pause
                </button>
                <button
                  onclick={() => performAction("cancel", session.id)}
                  disabled={!!actionInProgress[session.id]}
                  class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-[var(--dash-error)]/10 text-[var(--dash-error)] hover:bg-[var(--dash-error)]/20 transition-colors disabled:opacity-50"
                >
                  {#if actionInProgress[session.id] === "cancel"}
                    <Spinner size="w-3 h-3" />
                  {:else}
                    <FontAwesomeIcon icon={faStop} class="w-3 h-3" />
                  {/if}
                  Cancel
                </button>
              {:else if session.status === "paused"}
                <button
                  onclick={() => performAction("resume", session.id)}
                  disabled={!!actionInProgress[session.id]}
                  class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/20 transition-colors disabled:opacity-50"
                >
                  {#if actionInProgress[session.id] === "resume"}
                    <Spinner size="w-3 h-3" />
                  {:else}
                    <FontAwesomeIcon icon={faPlay} class="w-3 h-3" />
                  {/if}
                  Resume
                </button>
                <button
                  onclick={() => performAction("cancel", session.id)}
                  disabled={!!actionInProgress[session.id]}
                  class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-[var(--dash-error)]/10 text-[var(--dash-error)] hover:bg-[var(--dash-error)]/20 transition-colors disabled:opacity-50"
                >
                  {#if actionInProgress[session.id] === "cancel"}
                    <Spinner size="w-3 h-3" />
                  {:else}
                    <FontAwesomeIcon icon={faStop} class="w-3 h-3" />
                  {/if}
                  Cancel
                </button>
              {/if}
              {#if ["completed", "failed", "cancelled"].includes(session.status)}
                <button
                  onclick={() => retrySession(session)}
                  class="flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/20 transition-colors"
                >
                  <FontAwesomeIcon icon={faRotateRight} class="w-3 h-3" />
                  Retry
                </button>
              {/if}
            </div>
          </div>

          <!-- Agent question (needs input) -->
          {#if session.needsInput}
            <div class="mt-3 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <p class="text-xs font-medium text-amber-700 mb-1">Agent is asking for input:</p>
              <p class="text-sm text-[var(--dash-text)]">{session.needsInput}</p>
            </div>
          {/if}

          <!-- Hint input for active/paused sessions -->
          {#if ["active", "paused"].includes(session.status)}
            {@const currentHint = hintInputs[session.id] ?? session.pendingHint ?? ""}
            {@const hintChanged = currentHint.trim() !== (session.pendingHint ?? "").trim()}
            <div class="mt-3 flex gap-2 items-end">
              <textarea
                placeholder={session.needsInput ? "Reply to the agent's question..." : "Add a hint for the next iteration..."}
                value={currentHint}
                oninput={(e) => (hintInputs = { ...hintInputs, [session.id]: (e.currentTarget as HTMLTextAreaElement).value })}
                onkeydown={(e) => { if (e.key === "Enter" && !e.shiftKey && hintChanged) { e.preventDefault(); submitHint(session.id); } }}
                rows="1"
                class="flex-1 rounded-lg border {session.pendingHint && !hintChanged ? 'border-purple-400' : 'border-[var(--dash-border)]'} bg-[var(--dash-bg)] text-xs text-[var(--dash-text)] px-3 py-1.5 placeholder:text-[var(--dash-text-muted)] resize-none focus:rows-3 transition-all"
                onfocus={(e) => (e.currentTarget as HTMLTextAreaElement).rows = 3}
                onblur={(e) => { if (!(e.currentTarget as HTMLTextAreaElement).value.trim()) (e.currentTarget as HTMLTextAreaElement).rows = 1; }}
              ></textarea>
              {#if session.pendingHint && !hintChanged}
                <button
                  onclick={() => { hintInputs = { ...hintInputs, [session.id]: "" }; submitHint(session.id); }}
                  disabled={!!hintSending[session.id]}
                  class="px-3 py-1.5 text-xs rounded-lg bg-[var(--dash-error)]/10 text-[var(--dash-error)] hover:bg-[var(--dash-error)]/20 transition-colors disabled:opacity-50"
                >
                  Clear
                </button>
              {:else}
                <button
                  onclick={() => submitHint(session.id)}
                  disabled={!hintChanged || !!hintSending[session.id]}
                  class="px-3 py-1.5 text-xs rounded-lg bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
                >
                  {#if hintSending[session.id]}
                    <Spinner size="w-3 h-3" />
                  {:else}
                    {session.pendingHint ? "Update" : "Send"}
                  {/if}
                </button>
              {/if}
            </div>
            {#if session.pendingHint && !hintChanged}
              <p class="mt-1 text-xs text-purple-600">
                Queued — will be sent at the start of the next iteration
              </p>
            {/if}
          {/if}

          <!-- Expanded: Session Details + Iterations -->
          {#if expandedSession === session.id}
            <div class="mt-4 border-t border-[var(--dash-border)] pt-4 space-y-3">
              <!-- Session config -->
              <div class="text-xs space-y-2">
                <div>
                  <span class="font-medium text-[var(--dash-text-muted)]">Goal:</span>
                  <span class="text-[var(--dash-text-secondary)] ml-1">{session.goal}</span>
                </div>
                {#if session.systemPrompt}
                  <details>
                    <summary class="font-medium text-[var(--dash-text-muted)] cursor-pointer hover:text-[var(--dash-text-secondary)]">
                      System prompt
                    </summary>
                    <p class="text-[var(--dash-text-secondary)] mt-1 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono text-[10px] leading-relaxed bg-[var(--dash-border)]/30 rounded p-2">
                      {session.systemPrompt}
                    </p>
                  </details>
                {/if}
              </div>

              {#if loadingIterations[session.id]}
                <div class="flex items-center justify-center py-4">
                  <Spinner size="w-4 h-4" color="var(--dash-primary)" />
                </div>
              {:else if sessionIterations[session.id]?.length}
                <div class="space-y-3">
                  {#each sessionIterations[session.id] as iter, idx (iter.id)}
                    {@const prevIter = idx > 0 ? sessionIterations[session.id][idx - 1] : null}
                    {@const delta = iter.successPct !== null && prevIter?.successPct !== null
                      ? iter.successPct - (prevIter?.successPct ?? 0)
                      : null}
                    <div class="bg-[var(--dash-bg)] rounded-lg p-3 text-xs">
                      <!-- Iteration header -->
                      <div class="flex items-center justify-between mb-2">
                        <span class="font-medium text-[var(--dash-text)]">
                          Iteration {iter.iteration}
                        </span>
                        <div class="flex items-center gap-3 text-[var(--dash-text-muted)]">
                          {#if iter.runId}
                            <span>Run #{iter.runId}</span>
                          {/if}
                          {#if iter.runStatus}
                            <span class={iter.runStatus === "success" ? "text-green-600" : iter.runStatus === "error" ? "text-[var(--dash-error)]" : "text-amber-600"}>
                              {iter.runStatus}
                            </span>
                          {/if}
                          {#if iter.successPct !== null}
                            <span class="text-[var(--dash-text-secondary)]">
                              {iter.successPct.toFixed(1)}%
                            </span>
                            {#if delta !== null && prevIter}
                              <span class={delta > 0 ? "text-green-600" : delta < 0 ? "text-[var(--dash-error)]" : "text-[var(--dash-text-muted)]"}>
                                {delta > 0 ? "+" : ""}{delta.toFixed(1)}pp
                              </span>
                            {/if}
                          {/if}
                          {#if iter.goalMet === true}
                            <span class="text-green-600 font-medium">Goal met</span>
                          {/if}
                        </div>
                      </div>

                      <!-- Items stats -->
                      {#if iter.itemsTotal}
                        <div class="flex gap-4 text-[var(--dash-text-secondary)] mb-2">
                          <span>{iter.itemsCompleted || 0} completed</span>
                          <span>{iter.itemsError || 0} errors</span>
                          <span>{iter.itemsTotal} total</span>
                          {#if prevIter?.itemsTotal}
                            {@const completedDelta = (iter.itemsCompleted || 0) - (prevIter.itemsCompleted || 0)}
                            {@const errorDelta = (iter.itemsError || 0) - (prevIter.itemsError || 0)}
                            <span class="text-[var(--dash-text-muted)]">
                              (vs prev: {completedDelta > 0 ? "+" : ""}{completedDelta} completed, {errorDelta > 0 ? "+" : ""}{errorDelta} errors)
                            </span>
                          {/if}
                        </div>
                      {/if}

                      <!-- Goal evaluation -->
                      {#if iter.goalMet !== null}
                        <div class="mt-2 flex items-start gap-2">
                          <span class={iter.goalMet ? "text-green-600 font-medium" : "text-amber-600 font-medium"}>
                            {iter.goalMet ? "Goal met" : "Goal not met"}
                          </span>
                          {#if iter.goalEvaluation}
                            <span class="text-[var(--dash-text-secondary)]">— {iter.goalEvaluation}</span>
                          {/if}
                        </div>
                      {/if}

                      <!-- Prompt sent to Claude -->
                      {#if iter.prompt}
                        <details class="mt-2">
                          <summary class="font-medium text-[var(--dash-text-muted)] cursor-pointer hover:text-[var(--dash-text-secondary)]">
                            Prompt sent
                          </summary>
                          <p class="text-[var(--dash-text-secondary)] mt-1 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono text-[10px] leading-relaxed bg-[var(--dash-border)]/30 rounded p-2">
                            {iter.prompt}
                          </p>
                        </details>
                      {/if}

                      <!-- Claude response -->
                      {#if iter.claudeAnalysis}
                        <details class="mt-2" open={!iter.finishedAt}>
                          <summary class="font-medium text-[var(--dash-text-muted)] cursor-pointer hover:text-[var(--dash-text-secondary)]">
                            Claude response
                          </summary>
                          <p class="text-[var(--dash-text-secondary)] mt-1 whitespace-pre-wrap max-h-64 overflow-y-auto">
                            {iter.claudeAnalysis}
                          </p>
                        </details>
                      {/if}

                      <!-- Timestamp + Stage -->
                      <div class="text-[var(--dash-text-muted)] mt-2">
                        {formatTime(iter.startedAt)}
                        {#if iter.finishedAt}
                          — finished {formatTime(iter.finishedAt)}
                        {:else if iter.stage}
                          — <span class={stageColor(iter.stage)}>{stageLabel(iter.stage)}</span>
                        {:else}
                          — starting...
                        {/if}
                      </div>
                    </div>
                  {/each}
                </div>
              {:else}
                <p class="text-xs text-[var(--dash-text-muted)] text-center py-2">
                  No iterations yet — waiting for agent to start...
                </p>
              {/if}
            </div>
          {/if}
        </Card>
      {/each}
    </div>
  {/if}
</div>
