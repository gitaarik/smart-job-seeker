<script lang="ts">
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCalendarCheck } from "@fortawesome/free-solid-svg-icons";
  import {
    stepperPhases,
    stepsByPhase,
    actionsByStep,
    actionsByPhase,
    defaultStepByPhase,
    defaultActionByPhase,
    defaultActionByStep,
    resultOptions,
    getStepperPhase,
    getStatusColor,
    isFinishedStatus,
  } from "$lib/application-status";

  let {
    status,
    statusStep,
    statusAction,
    statusActionDate,
    saving = $bindable(false),
    oncancel,
    onsave,
  }: {
    status: string;
    statusStep: string | null;
    statusAction: string | null;
    statusActionDate: string | null;
    saving?: boolean;
    oncancel: () => void;
    onsave: () => void;
  } = $props();

  // State
  let selectedPhase = $state(getStepperPhase(status));
  let selectedStep = $state(statusStep || "");
  let selectedAction = $state(statusAction || "");
  let selectedActionDate = $state(statusActionDate || "");
  let selectedResult = $state(isFinishedStatus(status) ? status : "");
  let description = $state("");
  let customStepActive = $state(false);
  let customStepText = $state("");
  let customActionActive = $state(false);
  let customActionText = $state("");
  let noteOpen = $state(false);

  // Derived
  let stepOptions = $derived(stepsByPhase[selectedPhase] || []);
  let actionOptions = $derived(
    (customStepActive ? [] : actionsByStep[selectedStep]) ||
    actionsByPhase[selectedPhase] ||
    []
  );

  // The actual DB status to submit
  let submitStatus = $derived(
    selectedPhase === "result" ? selectedResult : selectedPhase
  );
  let submitStep = $derived(customStepActive ? customStepText : selectedStep);
  let submitAction = $derived(customActionActive ? customActionText : selectedAction);

  function selectPhase(phase: string) {
    if (phase === selectedPhase) return;
    selectedPhase = phase;
    customStepActive = false;
    customStepText = "";
    customActionActive = false;
    customActionText = "";

    if (phase === "result") {
      selectedStep = "";
      selectedAction = "";
      selectedResult = "";
    } else {
      selectedResult = "";
      selectedStep = defaultStepByPhase[phase] || "";
      const stepDefault = selectedStep && defaultActionByStep[selectedStep];
      selectedAction = stepDefault || defaultActionByPhase[phase] || "";
    }
  }

  function onStepChange(e: Event) {
    const val = (e.currentTarget as HTMLSelectElement).value;
    if (val === "__custom__") {
      customStepActive = true;
      selectedStep = "";
      customActionActive = false;
      customActionText = "";
      selectedAction = "";
    } else {
      customStepActive = false;
      customStepText = "";
      selectedStep = val;
      customActionActive = false;
      customActionText = "";
      if (val && defaultActionByStep[val]) {
        selectedAction = defaultActionByStep[val];
      } else {
        selectedAction = defaultActionByPhase[selectedPhase] || "";
      }
    }
  }

  function onActionChange(e: Event) {
    const val = (e.currentTarget as HTMLSelectElement).value;
    if (val === "__custom__") {
      customActionActive = true;
      selectedAction = "";
    } else {
      customActionActive = false;
      customActionText = "";
      selectedAction = val;
    }
  }
</script>

<form
  method="POST"
  action="?/updateStatus"
  use:enhance={() => {
    saving = true;
    return async ({ update }) => {
      await update();
      saving = false;
      onsave();
    };
  }}
>
  <input type="hidden" name="status" value={submitStatus} />
  <input type="hidden" name="step" value={selectedPhase === "result" ? "" : submitStep} />
  <input type="hidden" name="action" value={selectedPhase === "result" ? "" : submitAction} />
  <input type="hidden" name="action_date" value={submitAction === "Scheduled" ? selectedActionDate : ""} />

  <div class="space-y-4">
    <!-- Phase: dropdown on mobile, segmented control on desktop -->
    <div>
      <label class="block text-xs text-[var(--dash-text-secondary)] mb-1 uppercase tracking-wide">Phase</label>
      <!-- Mobile dropdown -->
      <select
        value={selectedPhase}
        onchange={(e) => selectPhase((e.currentTarget as HTMLSelectElement).value)}
        class="sm:hidden w-full px-3 py-2 text-sm rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)]"
      >
        {#each stepperPhases as phase}
          <option value={phase.value}>{phase.label}</option>
        {/each}
      </select>
      <!-- Desktop segmented control -->
      <div class="hidden sm:inline-flex rounded-lg border border-[var(--dash-border)] overflow-hidden">
        {#each stepperPhases as phase, i}
          <button
            type="button"
            onclick={() => selectPhase(phase.value)}
            class="px-3 py-2 text-sm transition-colors {selectedPhase === phase.value
              ? 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] font-medium'
              : 'text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]'} {i > 0 ? 'border-l border-[var(--dash-border)]' : ''}"
          >
            {phase.label}
          </button>
        {/each}
      </div>
    </div>

    {#if selectedPhase === "result"}
      <!-- Result selection -->
      <div>
        <label class="block text-xs text-[var(--dash-text-secondary)] mb-1 uppercase tracking-wide">Result</label>
        <div class="grid grid-cols-3 gap-2">
          {#each resultOptions as option}
            <button
              type="button"
              onclick={() => selectedResult = option.value}
              class="px-3 py-2.5 text-sm font-medium rounded-lg border-2 transition-all text-center
                {selectedResult === option.value
                  ? option.value === 'accepted'
                    ? 'bg-green-100 text-green-700 border-green-400'
                    : 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] border-[var(--dash-primary)]'
                  : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'
                }"
            >
              {option.label}
            </button>
          {/each}
        </div>
      </div>
    {:else}
      <!-- Status dropdown -->
      {#if stepOptions.length > 0}
        <div>
          <label for="picker-step" class="block text-xs text-[var(--dash-text-secondary)] mb-1 uppercase tracking-wide">Status</label>
          <select
            id="picker-step"
            value={customStepActive ? "__custom__" : selectedStep}
            onchange={onStepChange}
            class="w-full px-3 py-2 text-sm rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)]"
          >
            <option value="">— None —</option>
            {#each stepOptions as step}
              <option value={step}>{step}</option>
            {/each}
            <option value="__custom__">Custom...</option>
          </select>
          {#if customStepActive}
            <input
              type="text"
              bind:value={customStepText}
              placeholder="Custom status..."
              class="mt-2 w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-lg bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)]"
            />
          {/if}
        </div>
      {/if}

      <!-- Action dropdown -->
      {#if actionOptions.length > 0}
        <div>
          <label for="picker-action" class="block text-xs text-[var(--dash-text-secondary)] mb-1 uppercase tracking-wide">Action</label>
          <select
            id="picker-action"
            value={customActionActive ? "__custom__" : selectedAction}
            onchange={onActionChange}
            class="w-full px-3 py-2 text-sm rounded-lg border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)]"
          >
            <option value="">— None —</option>
            {#each actionOptions as action}
              <option value={action}>{action}</option>
            {/each}
            <option value="__custom__">Custom...</option>
          </select>
          {#if customActionActive}
            <input
              type="text"
              bind:value={customActionText}
              placeholder="Custom action..."
              class="mt-2 w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-lg bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)]"
            />
          {/if}
          {#if submitAction === "Scheduled"}
            <div class="mt-3">
              <label for="picker-action-date" class="block text-xs text-[var(--dash-text-secondary)] mb-1 uppercase tracking-wide">
                <FontAwesomeIcon icon={faCalendarCheck} class="w-3 h-3" /> Scheduled Date
              </label>
              <input
                id="picker-action-date"
                type="date"
                bind:value={selectedActionDate}
                class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-lg bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)]"
              />
            </div>
          {/if}
        </div>
      {/if}
    {/if}

    <!-- Note (collapsible) -->
    <div>
      {#if noteOpen}
        <label for="picker-description" class="block text-xs text-[var(--dash-text-secondary)] mb-1 uppercase tracking-wide">Note</label>
        <textarea
          id="picker-description"
          name="description"
          bind:value={description}
          rows={2}
          placeholder="Any additional context..."
          class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-lg bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:border-[var(--dash-primary)] resize-y"
        ></textarea>
      {:else}
        <button
          type="button"
          onclick={() => noteOpen = true}
          class="text-sm text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors"
        >
          + Add note
        </button>
      {/if}
    </div>
  </div>

  <!-- Footer -->
  <div class="flex flex-wrap justify-end gap-2 mt-5">
    <button
      type="button"
      onclick={oncancel}
      class="px-4 py-2 text-sm whitespace-nowrap border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
    >
      Cancel
    </button>
    <button
      type="submit"
      disabled={saving || (selectedPhase === "result" && !selectedResult)}
      class="px-4 py-2 text-sm whitespace-nowrap bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50"
    >
      {saving ? "Saving..." : "Save"}
    </button>
  </div>
</form>
