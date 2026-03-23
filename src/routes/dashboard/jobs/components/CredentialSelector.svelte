<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faEye,
    faEyeSlash,
    faKey,
    faPlus,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import Spinner from "$lib/components/Spinner.svelte";

  interface Props {
    credentials: { id: number; username: string | null }[];
    selectedId: string;
    platformId: number;
    profileId: number;
    platformName?: string | null;
    disabled?: boolean;
    onselect?: (credentialId: string) => void;
    oncredentialadded?: (
      cred: { id: number; username: string | null },
    ) => void;
    oncredentialdeleted?: (credId: number) => void;
  }

  let {
    credentials = $bindable(),
    selectedId = $bindable(),
    platformId,
    profileId,
    platformName = null,
    disabled = false,
    onselect,
    oncredentialadded,
    oncredentialdeleted,
  }: Props = $props();

  // Saved credential ID to show "Current" badge
  let savedId = $state(selectedId);

  let isSaving = $state(false);
  let showAddForm = $state(false);
  let newUsername = $state("");
  let newPassword = $state("");
  let showPassword = $state(false);
  let isDeletingId = $state<number | null>(null);

  function select(id: string) {
    if (disabled) return;
    showAddForm = false;
    selectedId = id;
    onselect?.(id);
  }

  async function addCredential() {
    if (!newUsername.trim()) return;
    isSaving = true;
    try {
      const response = await fetch(
        `/api/platforms/${platformId}/credentials`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId,
            username: newUsername.trim(),
            password: newPassword,
          }),
        },
      );
      if (response.ok) {
        // Re-fetch credentials list for this platform
        const listRes = await fetch(
          `/api/platforms/${platformId}/credentials?profileId=${profileId}`,
        );
        if (listRes.ok) {
          const data = await listRes.json();
          if (Array.isArray(data)) {
            credentials = data;
            // Select the newly added one (last in list)
            const newCred = data.find(
              (c: { username: string | null }) =>
                c.username === newUsername.trim(),
            );
            if (newCred) {
              selectedId = String(newCred.id);
              onselect?.(selectedId);
              oncredentialadded?.(newCred);
            }
          }
        }
      }
    } catch (err) {
      console.error("Failed to add credential:", err);
    } finally {
      isSaving = false;
      showAddForm = false;
      newUsername = "";
      newPassword = "";
    }
  }

  async function deleteCredential(credId: number) {
    if (
      !confirm(
        "Delete this credential? Any search tasks using it will be unlinked.",
      )
    ) return;
    isDeletingId = credId;
    try {
      const response = await fetch(
        `/api/platforms/${platformId}/credentials?profileId=${profileId}&credentialId=${credId}`,
        { method: "DELETE" },
      );
      if (response.ok) {
        credentials = credentials.filter((c) => c.id !== credId);
        if (savedId === String(credId)) {
          savedId = "none";
        }
        if (selectedId === String(credId)) {
          selectedId = savedId;
          onselect?.(selectedId);
        }
        oncredentialdeleted?.(credId);
      }
    } catch (err) {
      console.error("Failed to delete credential:", err);
    } finally {
      isDeletingId = null;
    }
  }
</script>

<div>
  <div class="flex items-center justify-between mb-3">
    <div class="flex items-center gap-2">
      <FontAwesomeIcon
        icon={faKey}
        class="w-4 h-4 text-[var(--dash-text-secondary)]"
      />
      <h2 class="font-medium text-[var(--dash-text)] text-sm">
        Credentials
      </h2>
    </div>
    <div class="flex items-center gap-2">
      {#if isSaving}
        <Spinner size="w-3 h-3" color="var(--dash-text-muted)" />
      {/if}
      {#if !disabled}
        <button
          type="button"
          onclick={() => (showAddForm = !showAddForm)}
          class="flex items-center gap-1 px-2 py-1 text-xs text-[var(--dash-primary)] hover:bg-[var(--dash-bg)] rounded transition-colors"
        >
          <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
          Add
        </button>
      {/if}
    </div>
  </div>

  <!-- Credential list -->
  <div class="space-y-1.5">
    <!-- No credentials option -->
    <button
      type="button"
      {disabled}
      onclick={() => select("none")}
      class="
        w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors {selectedId === 'none'
        ? 'bg-[var(--dash-primary)]/10 border border-[var(--dash-primary)]/30 text-[var(--dash-text)]'
        : 'bg-[var(--dash-bg)] border border-transparent text-[var(--dash-text-secondary)] hover:border-[var(--dash-border)]'}
        disabled:opacity-60
      "
    >
      <span
        class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 {selectedId === 'none' ? 'border-[var(--dash-primary)]' : 'border-[var(--dash-border)]'}"
      >
        {#if selectedId === "none"}
          <span
            class="w-2 h-2 rounded-full bg-[var(--dash-primary)]"
          ></span>
        {/if}
      </span>
      <span class="flex-1 text-left">No credentials (public search)</span>
      {#if savedId === "none"}
        <span
          class="text-xs text-[var(--dash-text-muted)] font-medium"
        >Current</span>
      {/if}
    </button>

    {#each credentials as cred}
      <div
        class="
          flex items-center gap-2.5 px-3 py-2 text-sm rounded-md transition-colors {selectedId === String(cred.id)
          ? 'bg-[var(--dash-primary)]/10 border border-[var(--dash-primary)]/30'
          : 'bg-[var(--dash-bg)] border border-transparent hover:border-[var(--dash-border)]'}
        "
      >
        <button
          type="button"
          {disabled}
          onclick={() => select(String(cred.id))}
          class="flex-1 text-left flex items-center gap-2.5 text-[var(--dash-text)] disabled:opacity-60"
        >
          <span
            class="w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 {selectedId === String(cred.id) ? 'border-[var(--dash-primary)]' : 'border-[var(--dash-border)]'}"
          >
            {#if selectedId === String(cred.id)}
              <span
                class="w-2 h-2 rounded-full bg-[var(--dash-primary)]"
              ></span>
            {/if}
          </span>
          <span>{cred.username || "No username"}</span>
          {#if savedId === String(cred.id)}
            <span
              class="text-xs text-[var(--dash-text-muted)] font-medium"
            >Current</span>
          {/if}
        </button>
        {#if !disabled}
          <button
            type="button"
            onclick={() => deleteCredential(cred.id)}
            disabled={isDeletingId === cred.id}
            class="p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-error)] transition-colors"
            title="Delete credential"
          >
            {#if isDeletingId === cred.id}
              <Spinner size="w-3 h-3" />
            {:else}
              <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
            {/if}
          </button>
        {/if}
      </div>
    {/each}
  </div>

  {#if credentials.length === 0 && !showAddForm}
    <p class="mt-2 text-xs text-[var(--dash-text-muted)]">
      No credentials configured{platformName ? ` for ${platformName}` : ""}. Add
      credentials for automatic login. Otherwise manual login is required.
    </p>
  {/if}

  {#if showAddForm && !disabled}
    <div class="mt-3 p-3 bg-[var(--dash-bg)] rounded-lg space-y-3">
      <div>
        <label
          for="new-cred-username"
          class="block text-sm text-[var(--dash-text)] mb-1"
        >
          Username / Email
        </label>
        <input
          type="text"
          id="new-cred-username"
          bind:value={newUsername}
          placeholder="your@email.com"
          class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
        />
      </div>
      <div>
        <label
          for="new-cred-password"
          class="block text-sm text-[var(--dash-text)] mb-1"
        >
          Password
        </label>
        <div class="relative">
          <input
            type={showPassword ? "text" : "password"}
            id="new-cred-password"
            bind:value={newPassword}
            placeholder="Enter password"
            class="w-full px-3 py-2 pr-10 text-sm border border-[var(--dash-border)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
          <button
            type="button"
            onclick={() => (showPassword = !showPassword)}
            class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
          >
            <FontAwesomeIcon
              icon={showPassword ? faEyeSlash : faEye}
              class="w-4 h-4"
            />
          </button>
        </div>
      </div>
      <div class="flex justify-end gap-2">
        <button
          type="button"
          onclick={() => {
            showAddForm = false;
            newUsername = "";
            newPassword = "";
          }}
          class="px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-card)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={addCredential}
          disabled={!newUsername.trim() || isSaving}
          class="px-3 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
        >
          {#if isSaving}
            <Spinner size="w-3 h-3" />
          {:else}
            <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
          {/if}
          Add & Select
        </button>
      </div>
    </div>
  {/if}
</div>
