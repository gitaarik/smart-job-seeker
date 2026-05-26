<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faExclamationTriangle,
    faFileUpload,
    faSlidersH,
    faUpload,
    faCheckCircle,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../../components/Card.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let file = $state<File | null>(null);
  let fileName = $state("");
  let replaceExistingTasks = $state(false);
  let applyMatchConfig = $state(true);
  let applyEmailDigest = $state(true);
  let applySalary = $state(true);
  let importing = $state(false);

  function handleFileChange(event: Event) {
    const input = event.target as HTMLInputElement;
    file = input.files?.[0] ?? null;
    fileName = file?.name ?? "";
  }

  function handleImport() {
    importing = true;
    return async ({
      update,
    }: {
      update: () => Promise<void>;
    }) => {
      await update();
      importing = false;
    };
  }
</script>

<div class="space-y-6">
  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  {#if form?.success && form.summary}
    <Card padding="lg">
      <div class="flex items-start gap-3">
        <FontAwesomeIcon
          icon={faCheckCircle}
          class="w-5 h-5 text-[var(--dash-success)] mt-0.5"
        />
        <div class="text-sm space-y-1">
          <p class="font-medium text-[var(--dash-text)]">
            Settings imported successfully
          </p>
          <ul class="text-[var(--dash-text-secondary)] list-disc list-inside">
            {#if form.summary.tasksDeleted > 0}
              <li>{form.summary.tasksDeleted} existing task{form.summary.tasksDeleted === 1 ? "" : "s"} replaced</li>
            {/if}
            <li>{form.summary.tasksInserted} import task{form.summary.tasksInserted === 1 ? "" : "s"} added</li>
            {#if form.summary.platformProfilesCreated > 0}
              <li>
                Auto-linked existing credential{form.summary.platformProfilesCreated === 1 ? "" : "s"} for {form.summary.platformProfilesCreated} platform{form.summary.platformProfilesCreated === 1 ? "" : "s"}
              </li>
            {/if}
            {#if form.summary.matchConfigUpdated}
              <li>Match config updated</li>
            {/if}
            {#if form.summary.emailDigestUpdated}
              <li>Email digest preferences updated</li>
            {/if}
            {#if form.summary.salaryUpdated}
              <li>
                Salary settings updated
                {#if form.summary.salaryExpectationsInserted > 0 || form.summary.salaryExpectationsReplaced > 0}
                  ({form.summary.salaryExpectationsInserted} expectation{form.summary.salaryExpectationsInserted === 1 ? "" : "s"} loaded{form.summary.salaryExpectationsReplaced > 0 ? `, ${form.summary.salaryExpectationsReplaced} replaced` : ""})
                {/if}
              </li>
            {/if}
            {#if form.summary.tasksSkippedUnknownPlatform.length > 0}
              <li class="text-[var(--dash-warning)]">
                Skipped {form.summary.tasksSkippedUnknownPlatform.length} task(s) for unknown platforms: {form.summary.tasksSkippedUnknownPlatform.join(", ")}
              </li>
            {/if}
            {#if form.summary.tasksWithoutCredential.length > 0}
              <li class="text-[var(--dash-warning)]">
                No credential configured on this profile for: {form.summary.tasksWithoutCredential.join(", ")} — those tasks were imported without a linked credential.
              </li>
            {/if}
          </ul>
        </div>
      </div>
    </Card>
  {/if}

  <Card padding="lg">
    <div class="flex items-start gap-4">
      <div
        class="w-12 h-12 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center flex-shrink-0"
      >
        <FontAwesomeIcon icon={faSlidersH} class="w-6 h-6 text-indigo-600" />
      </div>
      <div class="flex-1">
        <h3 class="font-medium text-[var(--dash-text)] mb-1">
          Import Settings
        </h3>
        <p class="text-sm text-[var(--dash-text-secondary)] mb-4">
          Upload a settings.json file exported from another Smart Job Seeker
          instance. Imported tasks will auto-link to this profile's existing
          platform credentials when available.
        </p>

        <form
          method="POST"
          action="?/import"
          enctype="multipart/form-data"
          use:enhance={handleImport}
        >
          <label
            class="flex items-center gap-3 p-3 mb-4 rounded-lg border border-dashed border-[var(--dash-border)] hover:border-[var(--dash-primary)]/50 cursor-pointer transition-colors"
          >
            <FontAwesomeIcon
              icon={faFileUpload}
              class="w-5 h-5 text-[var(--dash-text-muted)]"
            />
            <input
              type="file"
              name="file"
              accept="application/json,.json"
              required
              onchange={handleFileChange}
              class="sr-only"
            />
            <div class="text-sm">
              {#if fileName}
                <div class="font-medium text-[var(--dash-text)]">{fileName}</div>
                <div class="text-xs text-[var(--dash-text-secondary)]">
                  Click to choose a different file
                </div>
              {:else}
                <div class="font-medium text-[var(--dash-text)]">Choose settings.json</div>
                <div class="text-xs text-[var(--dash-text-secondary)]">
                  Exported from /data/settings-export
                </div>
              {/if}
            </div>
          </label>

          <div class="space-y-2 mb-4">
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="replaceExistingTasks"
                bind:checked={replaceExistingTasks}
                class="w-4 h-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)]"
              />
              <span class="text-sm text-[var(--dash-text)]">
                Replace existing import tasks (otherwise: add alongside)
              </span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="applyMatchConfig"
                bind:checked={applyMatchConfig}
                class="w-4 h-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)]"
              />
              <span class="text-sm text-[var(--dash-text)]">
                Apply match config from file
              </span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="applyEmailDigest"
                bind:checked={applyEmailDigest}
                class="w-4 h-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)]"
              />
              <span class="text-sm text-[var(--dash-text)]">
                Apply email digest preferences from file
              </span>
            </label>
            <label class="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                name="applySalary"
                bind:checked={applySalary}
                class="w-4 h-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)]"
              />
              <span class="text-sm text-[var(--dash-text)]">
                Apply salary settings from file (replaces existing expectations)
              </span>
            </label>
          </div>

          {#if replaceExistingTasks}
            <div
              class="flex items-start gap-2 p-3 mb-4 rounded-lg bg-[var(--dash-warning-light)] border border-[var(--dash-warning)]"
            >
              <FontAwesomeIcon
                icon={faExclamationTriangle}
                class="w-4 h-4 text-[var(--dash-warning)] mt-0.5"
              />
              <p class="text-sm text-[var(--dash-warning)]">
                This profile's existing import tasks will be permanently deleted, along with their run history.
              </p>
            </div>
          {/if}

          <button
            type="submit"
            disabled={importing || !file}
            class="inline-flex items-center gap-2 px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if importing}
              <span
                class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
              ></span>
              Importing...
            {:else}
              <FontAwesomeIcon icon={faUpload} class="w-4 h-4" />
              Import settings
            {/if}
          </button>
        </form>
      </div>
    </div>
  </Card>
</div>
