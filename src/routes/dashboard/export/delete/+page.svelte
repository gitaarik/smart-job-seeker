<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faExclamationTriangle,
    faSpinner,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let confirmName = $state("");
  let isLoading = $state(false);
  let showFinalConfirm = $state(false);

  const nameMatches = $derived(confirmName === data.profileName);

  function handleDeleteClick() {
    showFinalConfirm = true;
  }

  function confirmDelete() {
    document.getElementById("delete-form")?.requestSubmit();
  }

  function cancelDelete() {
    showFinalConfirm = false;
  }
</script>

<div class="space-y-6">
  <SectionHeader title="Delete Profile" icon={faTrash} />

  <div
    class="rounded-lg border p-6 space-y-4"
    style="background-color: var(--dash-error-light); border-color: var(--dash-error);"
  >
    <div class="flex items-start gap-3">
      <FontAwesomeIcon
        icon={faExclamationTriangle}
        class="w-6 h-6 flex-shrink-0 mt-0.5"
        style="color: var(--dash-error);"
      />
      <div>
        <h3 class="text-lg font-semibold" style="color: var(--dash-error);">Danger Zone</h3>
        <p class="mt-1 text-[var(--dash-text-secondary)]">
          This action <strong>cannot be undone</strong>. This will permanently delete the
          profile <strong>"{data.profileName}"</strong> and all associated data including:
        </p>
        <ul class="list-disc ml-5 mt-2 text-[var(--dash-text-secondary)] space-y-1">
          <li>Work experiences and achievements</li>
          <li>Education records</li>
          <li>Skills and skill categories</li>
          <li>Side projects</li>
          <li>Resume/CV versions</li>
          <li>Share links and access tokens</li>
          <li>Exported files</li>
        </ul>
      </div>
    </div>
  </div>

  {#if data.isLastProfile}
    <div
      class="rounded-lg border p-4"
      style="background-color: var(--dash-warning-light); border-color: var(--dash-warning-border);"
    >
      <p style="color: var(--dash-warning);">
        This is your only profile. You cannot delete it. Create another profile first if you want to delete this one.
      </p>
    </div>
  {:else}
    <form
      id="delete-form"
      method="POST"
      action="?/delete"
      use:enhance={() => {
        isLoading = true;
        return async ({ result, update }) => {
          isLoading = false;
          await update();
        };
      }}
      class="space-y-4"
    >
      {#if form?.error}
        <div
          class="rounded-md border p-4"
          style="background-color: var(--dash-error-light); border-color: var(--dash-error);"
        >
          <p class="text-sm" style="color: var(--dash-error);">{form.error}</p>
        </div>
      {/if}

      <div>
        <label
          for="confirmName"
          class="block text-sm font-medium text-[var(--dash-text)] mb-2"
        >
          To confirm, type <strong>"{data.profileName}"</strong> below:
        </label>
        <input
          type="text"
          id="confirmName"
          name="confirmName"
          bind:value={confirmName}
          autocomplete="off"
          class="w-full max-w-md px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:border-transparent bg-[var(--dash-card)] text-[var(--dash-text)]"
          style="--tw-ring-color: var(--dash-error);"
          placeholder="Enter profile name to confirm"
        />
      </div>

      {#if showFinalConfirm}
        <div
          class="rounded-lg border p-4 space-y-3"
          style="border-color: var(--dash-error); background-color: var(--dash-error-light);"
        >
          <p class="font-medium" style="color: var(--dash-error);">
            Are you absolutely sure you want to delete "{data.profileName}"?
          </p>
          <div class="flex gap-2">
            <button
              type="button"
              onclick={cancelDelete}
              disabled={isLoading}
              class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-md hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50 text-[var(--dash-text)]"
            >
              Cancel
            </button>
            <button
              type="button"
              onclick={confirmDelete}
              disabled={isLoading}
              class="px-3 py-1.5 text-sm text-white rounded-md hover:opacity-90 transition-colors disabled:opacity-50 flex items-center gap-2"
              style="background-color: var(--dash-error);"
            >
              {#if isLoading}
                <FontAwesomeIcon icon={faSpinner} class="w-3 h-3 animate-spin" />
              {/if}
              Yes, delete permanently
            </button>
          </div>
        </div>
      {:else}
        <button
          type="button"
          onclick={handleDeleteClick}
          disabled={!nameMatches || isLoading}
          class="px-4 py-2 text-white font-medium rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          style="background-color: var(--dash-error);"
        >
          <FontAwesomeIcon icon={faTrash} class="w-4 h-4" />
          Delete this profile
        </button>
      {/if}
    </form>
  {/if}
</div>
