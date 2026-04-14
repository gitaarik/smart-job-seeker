<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronRight,
    faEye,
    faEyeSlash,
    faKey,
    faPlus,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import Spinner from "$lib/components/Spinner.svelte";

  interface Props {
    credentials: { id: number; username: string | null; security_answer?: string | null }[];
    selectedId: string;
    loginMode: string;
    platformId: number;
    profileId: number;
    platformName?: string | null;
    disabled?: boolean;
    onselect?: (credentialId: string) => void;
    onloginmodechange?: (mode: string) => void;
    oncredentialadded?: (
      cred: { id: number; username: string | null },
    ) => void;
    oncredentialdeleted?: (credId: number) => void;
  }

  let {
    credentials = $bindable(),
    selectedId = $bindable(),
    loginMode = $bindable(),
    platformId,
    profileId,
    platformName = null,
    disabled = false,
    onselect,
    onloginmodechange,
    oncredentialadded,
    oncredentialdeleted,
  }: Props = $props();

  // Saved credential ID to show "Current" badge
  let savedId = $state(selectedId);

  let isSaving = $state(false);
  let showAddForm = $state(false);
  let newUsername = $state("");
  let newPassword = $state("");
  let newSecurityAnswer = $state("");
  let showPassword = $state(false);
  let showAdvanced = $state(false);
  let isDeletingId = $state<number | null>(null);

  // Security answer editing for existing credentials
  let editingSecurityAnswerId = $state<number | null>(null);
  let editSecurityAnswer = $state("");
  let isSavingSecurityAnswer = $state(false);

  function select(id: string) {
    if (disabled) return;
    showAddForm = false;
    selectedId = id;
    onselect?.(id);
  }

  function setLoginMode(mode: string) {
    if (disabled) return;
    loginMode = mode;
    onloginmodechange?.(mode);
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
            security_answer: newSecurityAnswer || undefined,
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
      newSecurityAnswer = "";
      showAdvanced = false;
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

  function startEditSecurityAnswer(credId: number) {
    const cred = credentials.find((c) => c.id === credId);
    editingSecurityAnswerId = credId;
    editSecurityAnswer = cred?.security_answer || "";
  }

  async function saveSecurityAnswer() {
    if (editingSecurityAnswerId === null) return;
    isSavingSecurityAnswer = true;
    try {
      const cred = credentials.find((c) => c.id === editingSecurityAnswerId);
      const response = await fetch(
        `/api/platforms/${platformId}/credentials`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            profileId,
            username: cred?.username || "",
            security_answer: editSecurityAnswer || undefined,
          }),
        },
      );
      if (response.ok) {
        // Update local state
        const idx = credentials.findIndex((c) => c.id === editingSecurityAnswerId);
        if (idx >= 0) {
          credentials[idx] = { ...credentials[idx], security_answer: editSecurityAnswer || null };
        }
        editingSecurityAnswerId = null;
        editSecurityAnswer = "";
      }
    } catch (err) {
      console.error("Failed to save security answer:", err);
    } finally {
      isSavingSecurityAnswer = false;
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
        Login & Credentials
      </h2>
    </div>
    <div class="flex items-center gap-2">
      {#if isSaving}
        <Spinner size="w-3 h-3" color="var(--dash-text-muted)" />
      {/if}
      {#if !disabled && loginMode === "auto"}
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

  <!-- Login Mode Toggle -->
  <div class="mb-3">
    <h3 class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">Login Mode</h3>
    <div class="flex rounded-md border border-[var(--dash-border)] overflow-hidden">
      <button
        type="button"
        {disabled}
        onclick={() => setLoginMode("auto")}
        class={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
          loginMode === "auto"
            ? "bg-[var(--dash-primary)] text-white"
            : "bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]"
        } disabled:opacity-60`}
      >
        Auto-login
      </button>
      <button
        type="button"
        {disabled}
        onclick={() => setLoginMode("manual")}
        class={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
          loginMode === "manual"
            ? "bg-[var(--dash-primary)] text-white"
            : "bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]"
        } disabled:opacity-60`}
      >
        Manual login
      </button>
      <button
        type="button"
        {disabled}
        onclick={() => setLoginMode("none")}
        class={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
          loginMode === "none"
            ? "bg-[var(--dash-primary)] text-white"
            : "bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-surface)]"
        } disabled:opacity-60`}
      >
        No login
      </button>
    </div>
    <p class="text-xs text-[var(--dash-text-muted)] mt-1.5">
      {#if loginMode === "auto"}
        The scraper will fill in credentials and log in automatically.
      {:else if loginMode === "manual"}
        The scraper will navigate to the login page and wait for you to log in.
      {:else}
        The scraper will go directly to the search page without logging in.
      {/if}
    </p>
  </div>

  <!-- Credential list (only for auto-login) -->
  {#if loginMode === "auto"}
  <div class="space-y-1.5">
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

  <!-- Advanced: security answer for selected credential -->
  {#if credentials.length > 0 && !disabled}
    {@const selectedCred = credentials.find((c) => String(c.id) === selectedId)}
    {#if selectedCred}
      <div class="mt-2">
        <button
          type="button"
          onclick={() => {
            if (editingSecurityAnswerId === selectedCred.id) {
              editingSecurityAnswerId = null;
            } else {
              startEditSecurityAnswer(selectedCred.id);
            }
          }}
          class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors"
        >
          {#if editingSecurityAnswerId === selectedCred.id}
            <FontAwesomeIcon icon={faChevronDown} class="w-2.5 h-2.5" />
          {:else}
            <FontAwesomeIcon icon={faChevronRight} class="w-2.5 h-2.5" />
          {/if}
          Advanced
          {#if selectedCred.security_answer}
            <span class="text-[var(--dash-success)]">*</span>
          {/if}
        </button>

        {#if editingSecurityAnswerId === selectedCred.id}
          <div class="mt-2 space-y-2">
            <div>
              <label
                for="edit-security-answer"
                class="block text-xs text-[var(--dash-text-secondary)] mb-1"
              >
                Security Question Answer
              </label>
              <input
                type="text"
                id="edit-security-answer"
                bind:value={editSecurityAnswer}
                placeholder="e.g., your mother's maiden name"
                class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
              />
              <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                Auto-filled when a site asks a security question after login.
              </p>
            </div>
            {#if editSecurityAnswer !== (selectedCred.security_answer || "")}
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  onclick={() => {
                    editingSecurityAnswerId = null;
                    editSecurityAnswer = "";
                  }}
                  class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text)] hover:bg-[var(--dash-card)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onclick={saveSecurityAnswer}
                  disabled={isSavingSecurityAnswer}
                  class="px-2 py-1 text-xs bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {#if isSavingSecurityAnswer}
                    <Spinner size="w-3 h-3" />
                  {:else}
                    <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                  {/if}
                  Save
                </button>
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/if}
  {/if}

  {#if credentials.length === 0 && !showAddForm}
    <p class="mt-2 text-xs text-[var(--dash-text-muted)]">
      No credentials configured{platformName ? ` for ${platformName}` : ""}. Add
      credentials for automatic login.
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
      <!-- Advanced: security answer -->
      <button
        type="button"
        onclick={() => (showAdvanced = !showAdvanced)}
        class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] transition-colors"
      >
        {#if showAdvanced}
          <FontAwesomeIcon icon={faChevronDown} class="w-2.5 h-2.5" />
        {:else}
          <FontAwesomeIcon icon={faChevronRight} class="w-2.5 h-2.5" />
        {/if}
        Advanced
      </button>
      {#if showAdvanced}
        <div>
          <label
            for="new-cred-security-answer"
            class="block text-xs text-[var(--dash-text-secondary)] mb-1"
          >
            Security Question Answer <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span>
          </label>
          <input
            type="text"
            id="new-cred-security-answer"
            bind:value={newSecurityAnswer}
            placeholder="e.g., your mother's maiden name"
            class="w-full px-3 py-2 text-sm border border-[var(--dash-border)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
          <p class="text-xs text-[var(--dash-text-muted)] mt-1">
            Auto-filled when a site asks a security question after login.
          </p>
        </div>
      {/if}
      <div class="flex justify-end gap-2">
        <button
          type="button"
          onclick={() => {
            showAddForm = false;
            newUsername = "";
            newPassword = "";
            newSecurityAnswer = "";
            showAdvanced = false;
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
  {/if}
</div>
