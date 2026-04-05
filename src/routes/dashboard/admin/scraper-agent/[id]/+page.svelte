<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faRobot,
    faPlay,
    faPause,
    faStop,
    faRotateRight,
    faCodeCommit,
    faExternalLinkAlt,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../../profile/components/SectionHeader.svelte";
  import Card from "../../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import {
    type SessionDetail,
    type Iteration,
    statusColor,
    statusDot,
    stageLabel,
    stageColor,
    formatTime,
    progressPct,
    isActive,
  } from "../shared";

  let { data } = $props();

  let session = $state<SessionDetail | null>(null);
  let iterations = $state<Iteration[]>([]);
  let loading = $state(true);
  let errorMsg = $state("");
  let pollInterval: ReturnType<typeof setInterval> | null = null;
  let actionInProgress = $state<string | null>(null);
  let confirmCommit = $state(false);
  let committing = $state(false);

  // Hint input
  let hintInput = $state("");
  let hintSending = $state(false);

  async function loadSession() {
    try {
      const response = await fetch(`/api/admin/scraper-agent/${data.sessionId}`);
      if (response.ok) {
        const result = await response.json();
        if (JSON.stringify(result.session) !== JSON.stringify(session)) {
          session = result.session;
        }
        if (JSON.stringify(result.iterations) !== JSON.stringify(iterations)) {
          iterations = result.iterations;
        }
        errorMsg = "";
      } else if (response.status === 404) {
        errorMsg = "Session not found";
      } else {
        errorMsg = "Failed to load session";
      }
    } catch {
      errorMsg = "Failed to load session";
    } finally {
      loading = false;
    }
  }

  async function performAction(action: "pause" | "cancel" | "resume") {
    actionInProgress = action;
    try {
      const response = await fetch(`/api/admin/scraper-agent/${data.sessionId}/${action}`, {
        method: "POST",
      });
      if (!response.ok) {
        console.error(`Action ${action} failed:`, await response.text());
      }
      await loadSession();
    } catch {
      console.error(`Action ${action} failed`);
    } finally {
      actionInProgress = null;
    }
  }

  async function skipRun() {
    try {
      const response = await fetch(`/api/admin/scraper-agent/${data.sessionId}/skip-run`, {
        method: "POST",
      });
      if (response.ok) {
        await loadSession();
      }
    } catch {
      // Ignore
    }
  }

  async function updateMaxIterations(value: number) {
    try {
      const response = await fetch(`/api/admin/scraper-agent/${data.sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maxIterations: value }),
      });
      if (response.ok) {
        await loadSession();
      }
    } catch {
      // Ignore
    }
  }

  async function submitHint() {
    const hint = hintInput.trim() || null;
    hintSending = true;
    try {
      const response = await fetch(`/api/admin/scraper-agent/${data.sessionId}/hint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hint }),
      });
      if (response.ok) {
        hintInput = "";
        await loadSession();
      }
    } catch {
      // Ignore
    } finally {
      hintSending = false;
    }
  }

  async function commitAndPush() {
    committing = true;
    try {
      const response = await fetch(`/api/admin/scraper-agent/${data.sessionId}/commit`, {
        method: "POST",
      });
      const result = await response.json();
      if (!response.ok) {
        errorMsg = result.message || "Commit failed";
      } else if (!result.committed) {
        errorMsg = result.message;
      }
    } catch {
      errorMsg = "Commit & push failed";
    } finally {
      committing = false;
      confirmCommit = false;
    }
  }

  function retrySession() {
    if (!session) return;
    goto(`/dashboard/admin/scraper-agent?retry=${data.sessionId}`);
  }

  // Derived: latest stage for header display
  let latestStage = $derived(
    iterations.length > 0 ? iterations[iterations.length - 1].stage : null,
  );

  let latestSuccessPct = $derived(
    iterations.length > 0 ? iterations[iterations.length - 1].successPct : null,
  );

  onMount(() => {
    loadSession();
    pollInterval = setInterval(loadSession, 5000);
  });

  onDestroy(() => {
    if (pollInterval) clearInterval(pollInterval);
  });
</script>

<div class="space-y-6">
  <SectionHeader
    title="Scraper Agent Session"
    icon={faRobot}
    backHref="/dashboard/admin/scraper-agent"
    backLabel="All Sessions"
  />

  {#if loading}
    <div class="flex items-center justify-center py-12">
      <Spinner size="w-6 h-6" color="var(--dash-primary)" />
    </div>
  {:else if errorMsg && !session}
    <Card padding="responsive">
      <p class="text-[var(--dash-error)] text-sm">{errorMsg}</p>
    </Card>
  {:else if session}
    {#if errorMsg}
      <Card padding="responsive">
        <p class="text-[var(--dash-error)] text-sm">{errorMsg}</p>
      </Card>
    {/if}

    <!-- Session overview -->
    <Card padding="responsive">
      <!-- Status + search task link -->
      <div class="flex items-start justify-between gap-4 mb-4">
        <div class="min-w-0">
          <div class="flex items-center gap-2 mb-1">
            {#if session.status === "active"}
              <span class="relative flex h-2.5 w-2.5 flex-shrink-0">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
              </span>
            {:else}
              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0 {statusDot(session.status)}"></span>
            {/if}
            <span class="text-sm font-semibold {statusColor(session.status)} uppercase">{session.status}</span>
            {#if session.status === "active" && latestStage && latestStage !== "done"}
              <span class="text-xs {stageColor(latestStage)}">
                — {stageLabel(latestStage)}
              </span>
            {/if}
          </div>
          <a
            href="/dashboard/jobs/search-tasks/{session.searchTaskId}"
            class="inline-flex items-center gap-1.5 text-sm text-[var(--dash-primary)] hover:underline"
          >
            {session.searchTaskName}
            <FontAwesomeIcon icon={faExternalLinkAlt} class="w-3 h-3 opacity-60" />
          </a>
        </div>

        <!-- Action buttons -->
        <div class="flex flex-wrap items-center gap-2 flex-shrink-0">
          {#if session.status === "active"}
            <button
              onclick={() => performAction("pause")}
              disabled={!!actionInProgress}
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-amber-500/10 text-amber-600 hover:bg-amber-500/20 transition-colors disabled:opacity-50"
            >
              {#if actionInProgress === "pause"}
                <Spinner size="w-3 h-3" />
              {:else}
                <FontAwesomeIcon icon={faPause} class="w-3 h-3" />
              {/if}
              Pause
            </button>
            <button
              onclick={() => performAction("cancel")}
              disabled={!!actionInProgress}
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--dash-error)]/10 text-[var(--dash-error)] hover:bg-[var(--dash-error)]/20 transition-colors disabled:opacity-50"
            >
              {#if actionInProgress === "cancel"}
                <Spinner size="w-3 h-3" />
              {:else}
                <FontAwesomeIcon icon={faStop} class="w-3 h-3" />
              {/if}
              Cancel
            </button>
          {:else if session.status === "paused"}
            <button
              onclick={() => performAction("resume")}
              disabled={!!actionInProgress}
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/20 transition-colors disabled:opacity-50"
            >
              {#if actionInProgress === "resume"}
                <Spinner size="w-3 h-3" />
              {:else}
                <FontAwesomeIcon icon={faPlay} class="w-3 h-3" />
              {/if}
              Resume
            </button>
            <button
              onclick={() => performAction("cancel")}
              disabled={!!actionInProgress}
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--dash-error)]/10 text-[var(--dash-error)] hover:bg-[var(--dash-error)]/20 transition-colors disabled:opacity-50"
            >
              {#if actionInProgress === "cancel"}
                <Spinner size="w-3 h-3" />
              {:else}
                <FontAwesomeIcon icon={faStop} class="w-3 h-3" />
              {/if}
              Cancel
            </button>
          {/if}
          {#if ["completed", "failed", "cancelled"].includes(session.status)}
            {#if session.status === "completed"}
              {#if confirmCommit}
                <button
                  onclick={() => commitAndPush()}
                  disabled={committing}
                  class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {#if committing}
                    <Spinner size="w-3 h-3" />
                  {:else}
                    <FontAwesomeIcon icon={faCodeCommit} class="w-3 h-3" />
                  {/if}
                  Confirm push
                </button>
                <button
                  onclick={() => (confirmCommit = false)}
                  class="px-3 py-1.5 text-xs rounded-lg bg-[var(--dash-bg)] text-[var(--dash-text-muted)] hover:bg-[var(--dash-border)] transition-colors"
                >
                  Cancel
                </button>
              {:else}
                <button
                  onclick={() => (confirmCommit = true)}
                  class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-green-500/10 text-green-600 hover:bg-green-500/20 transition-colors"
                >
                  <FontAwesomeIcon icon={faCodeCommit} class="w-3 h-3" />
                  Commit & push
                </button>
              {/if}
            {/if}
            <button
              onclick={retrySession}
              class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/20 transition-colors"
            >
              <FontAwesomeIcon icon={faRotateRight} class="w-3 h-3" />
              Retry
            </button>
          {/if}
        </div>
      </div>

      <!-- Progress bar -->
      {#if session.currentIteration > 0}
        <div class="mb-4">
          <div class="flex items-center justify-between text-xs text-[var(--dash-text-secondary)] mb-1">
            <span>Iteration {session.currentIteration} / {session.maxIterations}</span>
            {#if latestSuccessPct !== null}
              <span>{latestSuccessPct.toFixed(1)}% success</span>
            {/if}
          </div>
          <div class="h-2 bg-[var(--dash-border)] rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-300 {session.status === 'completed' ? 'bg-[var(--dash-primary)]' : session.status === 'failed' ? 'bg-[var(--dash-error)]' : 'bg-green-500'}"
              style="width: {progressPct(session)}%"
            ></div>
          </div>
        </div>
      {/if}

      <!-- Error message -->
      {#if session.errorMessage && session.status !== "active"}
        <div class="p-3 rounded-lg bg-[var(--dash-error)]/5 border border-[var(--dash-error)]/20 mb-4">
          <p class="text-sm text-[var(--dash-error)]">{session.errorMessage}</p>
        </div>
      {/if}

      <!-- Blocked by manual intervention -->
      {#if latestStage === "blocked"}
        <div class="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 mb-4">
          <p class="text-xs font-medium text-orange-700 mb-1">Run is waiting for manual action</p>
          {#if session.blockedMessage}
            <p class="text-sm text-[var(--dash-text)] mb-2">{session.blockedMessage}</p>
          {/if}
          <p class="text-xs text-[var(--dash-text-muted)] mb-2">
            You can complete the action manually and let the run continue, or skip the run to move on to evaluation.
          </p>
          <button
            onclick={skipRun}
            class="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 transition-colors"
          >
            Skip run
          </button>
        </div>
      {/if}

      <!-- Agent question (needs input) -->
      {#if session.needsInput}
        <div class="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 mb-4">
          <p class="text-xs font-medium text-amber-700 mb-1">Agent is asking for input:</p>
          <p class="text-sm text-[var(--dash-text)]">{session.needsInput}</p>
        </div>
      {/if}

      <!-- Hint input for active/paused sessions -->
      {#if ["active", "paused"].includes(session.status)}
        {@const currentHint = hintInput || session.pendingHint || ""}
        {@const hintChanged = currentHint.trim() !== (session.pendingHint ?? "").trim()}
        <div class="mb-4">
          <div class="flex gap-2 items-end">
            <textarea
              placeholder={session.needsInput ? "Reply to the agent's question..." : "Add a hint for the next iteration..."}
              value={currentHint}
              oninput={(e) => (hintInput = (e.currentTarget as HTMLTextAreaElement).value)}
              onkeydown={(e) => { if (e.key === "Enter" && !e.shiftKey && hintChanged) { e.preventDefault(); submitHint(); } }}
              rows="1"
              class="flex-1 rounded-lg border {session.pendingHint && !hintChanged ? 'border-purple-400' : 'border-[var(--dash-border)]'} bg-[var(--dash-bg)] text-sm text-[var(--dash-text)] px-3 py-2 placeholder:text-[var(--dash-text-muted)] resize-none transition-all"
              onfocus={(e) => (e.currentTarget as HTMLTextAreaElement).rows = 3}
              onblur={(e) => { if (!(e.currentTarget as HTMLTextAreaElement).value.trim()) (e.currentTarget as HTMLTextAreaElement).rows = 1; }}
            ></textarea>
            {#if session.pendingHint && !hintChanged}
              <button
                onclick={() => { hintInput = ""; submitHint(); }}
                disabled={hintSending}
                class="px-3 py-2 text-xs rounded-lg bg-[var(--dash-error)]/10 text-[var(--dash-error)] hover:bg-[var(--dash-error)]/20 transition-colors disabled:opacity-50"
              >
                Clear
              </button>
            {:else}
              <button
                onclick={submitHint}
                disabled={!hintChanged || hintSending}
                class="px-3 py-2 text-xs rounded-lg bg-purple-500/10 text-purple-600 hover:bg-purple-500/20 transition-colors disabled:opacity-50"
              >
                {#if hintSending}
                  <Spinner size="w-3 h-3" />
                {:else}
                  {session.pendingHint ? "Update" : "Send"}
                {/if}
              </button>
            {/if}
          </div>
          {#if session.pendingHint && !hintChanged}
            <p class="text-xs text-purple-600 mt-1">
              Queued — will be sent at the start of the next iteration
            </p>
          {/if}
        </div>
      {/if}

      <!-- Session details -->
      <div class="grid gap-3 text-xs sm:grid-cols-2">
        <!-- Max iterations (editable for active/paused) -->
        {#if ["active", "paused"].includes(session.status)}
          <div class="flex items-center gap-2">
            <span class="font-medium text-[var(--dash-text-muted)]">Max iterations:</span>
            <input
              type="number"
              min={session.currentIteration + 1}
              max="50"
              value={session.maxIterations}
              onchange={(e) => updateMaxIterations(parseInt((e.currentTarget as HTMLInputElement).value))}
              class="w-16 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-sm text-[var(--dash-text)] px-2 py-0.5 text-center"
            />
            <span class="text-[var(--dash-text-muted)]">
              ({session.maxIterations - session.currentIteration} remaining)
            </span>
          </div>
        {/if}

        <div class="sm:col-span-2">
          <span class="font-medium text-[var(--dash-text-muted)]">Goal:</span>
          <span class="text-[var(--dash-text-secondary)] ml-1">{session.goal}</span>
        </div>

        <div class="sm:col-span-2 text-[var(--dash-text-muted)]">
          Started {formatTime(session.createdAt)}
          {#if session.finishedAt}
            — finished {formatTime(session.finishedAt)}
          {/if}
        </div>

        {#if session.systemPrompt}
          <details class="sm:col-span-2">
            <summary class="font-medium text-[var(--dash-text-muted)] cursor-pointer hover:text-[var(--dash-text-secondary)]">
              System prompt
            </summary>
            <p class="text-[var(--dash-text-secondary)] mt-1 whitespace-pre-wrap max-h-48 overflow-y-auto font-mono text-[10px] leading-relaxed bg-[var(--dash-border)]/30 rounded p-2">
              {session.systemPrompt}
            </p>
          </details>
        {/if}
      </div>
    </Card>

    <!-- Iterations -->
    <Card padding="responsive">
      <h3 class="text-sm font-medium text-[var(--dash-text)] mb-3">Iterations</h3>
      {#if iterations.length === 0}
        <p class="text-xs text-[var(--dash-text-muted)] text-center py-4">
          No iterations yet — waiting for agent to start...
        </p>
      {:else}
        <div class="space-y-3">
          {#each iterations as iter, idx (iter.id)}
            {@const prevIter = idx > 0 ? iterations[idx - 1] : null}
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
      {/if}
    </Card>
  {/if}
</div>
