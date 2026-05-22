<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faChevronDown,
    faChevronRight,
    faEye,
    faEyeSlash,
    faKey,
    faPen,
    faPlus,
    faShareAlt,
    faTimes,
    faTrash,
    faUserMinus,
  } from "@fortawesome/free-solid-svg-icons";
  import Spinner from "$lib/components/Spinner.svelte";

  interface CredentialEntry {
    id: number;
    username: string | null;
    security_answer?: string | null;
    /** True when the credential is owned by another user and shared with the current user */
    shared?: boolean;
    owner_user_id?: string | null;
    owner_label?: string | null;
  }
  interface ContactUser {
    id: string;
    name: string | null;
    email: string;
  }
  interface CredentialShare {
    id: number;
    date_created: Date | null;
    user: ContactUser & { image: string | null };
  }

  interface Props {
    credentials: CredentialEntry[];
    selectedId: string;
    loginMode: string;
    platformId: number;
    profileId: number;
    platformName?: string | null;
    disabled?: boolean;
    /** When true, the login-mode toggle is hidden and the credential list is
     *  always rendered (caller is responsible for pinning loginMode to
     *  "auto"). Used by flows where login is mandatory — e.g. admin
     *  discovery, which can't proceed without logging in. */
    hideLoginMode?: boolean;
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
    hideLoginMode = false,
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

  // Inline edit for an existing credential (password + security answer).
  // Password isn't returned from the server, so it stays blank unless the
  // user is changing it.
  let editingCredId = $state<number | null>(null);
  let editPassword = $state("");
  let editSecurityAnswer = $state("");
  let editShowPassword = $state(false);
  let isSavingEdit = $state(false);

  // Share-config modal state
  let sharingCredentialId = $state<number | null>(null);
  let sharingContacts = $state<ContactUser[]>([]);
  let sharingExisting = $state<CredentialShare[]>([]);
  let sharingLoading = $state(false);
  let sharingError = $state<string | null>(null);

  async function openShareModal(credId: number) {
    sharingCredentialId = credId;
    sharingLoading = true;
    sharingError = null;
    try {
      const [contactsRes, sharesRes] = await Promise.all([
        fetch("/api/contacts"),
        fetch(`/api/credential-shares?platformCredentialId=${credId}`),
      ]);
      const contactsData = await contactsRes.json();
      const sharesData = await sharesRes.json();
      sharingContacts = (contactsData.contacts || [])
        .filter((c: { status: string }) => c.status === "accepted")
        .map((c: { user: ContactUser }) => c.user);
      sharingExisting = sharesData.shares || [];
    } catch {
      sharingError = "Failed to load sharing data";
      sharingCredentialId = null;
    } finally {
      sharingLoading = false;
    }
  }

  function isSharedWith(userId: string): boolean {
    return sharingExisting.some((s) => s.user.id === userId);
  }

  async function shareWithContact(userId: string) {
    if (sharingCredentialId === null) return;
    sharingError = null;
    try {
      const res = await fetch("/api/credential-shares", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformCredentialId: sharingCredentialId,
          userId,
        }),
      });
      if (res.ok) {
        await openShareModal(sharingCredentialId);
      } else {
        const data = await res.json();
        sharingError = data.error || "Failed to share credential";
      }
    } catch {
      sharingError = "Failed to share credential";
    }
  }

  async function unshareFromContact(userId: string) {
    if (sharingCredentialId === null) return;
    sharingError = null;
    try {
      const res = await fetch("/api/credential-shares", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          platformCredentialId: sharingCredentialId,
          userId,
        }),
      });
      if (res.ok) {
        await openShareModal(sharingCredentialId);
      } else {
        const data = await res.json().catch(() => ({}));
        sharingError = data.error || "Failed to unshare credential";
      }
    } catch {
      sharingError = "Failed to unshare credential";
    }
  }

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
        const { id: newId } = await response.json();
        const listRes = await fetch(
          `/api/platforms/${platformId}/credentials?profileId=${profileId}`,
        );
        if (listRes.ok) {
          const data = await listRes.json();
          if (Array.isArray(data)) {
            credentials = data;
            const newCred = data.find(
              (c: { id: number }) => c.id === newId,
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

  function startEditCredential(credId: number) {
    const cred = credentials.find((c) => c.id === credId);
    editingCredId = credId;
    editPassword = "";
    editSecurityAnswer = cred?.security_answer || "";
    editShowPassword = false;
  }

  function cancelEditCredential() {
    editingCredId = null;
    editPassword = "";
    editSecurityAnswer = "";
    editShowPassword = false;
  }

  async function saveCredentialEdits() {
    if (editingCredId === null) return;
    const cred = credentials.find((c) => c.id === editingCredId);
    if (!cred) return;

    const body: Record<string, unknown> = {
      profileId,
      credentialId: cred.id,
      username: cred.username || "",
    };
    const passwordChanged = editPassword.length > 0;
    const answerChanged = editSecurityAnswer !== (cred.security_answer || "");
    if (passwordChanged) body.password = editPassword;
    if (answerChanged) body.security_answer = editSecurityAnswer || undefined;
    if (!passwordChanged && !answerChanged) {
      cancelEditCredential();
      return;
    }

    isSavingEdit = true;
    try {
      const response = await fetch(
        `/api/platforms/${platformId}/credentials`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      if (response.ok) {
        if (answerChanged) {
          const idx = credentials.findIndex((c) => c.id === editingCredId);
          if (idx >= 0) {
            credentials[idx] = {
              ...credentials[idx],
              security_answer: editSecurityAnswer || null,
            };
          }
        }
        cancelEditCredential();
      }
    } catch (err) {
      console.error("Failed to save credential:", err);
    } finally {
      isSavingEdit = false;
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

  {#if !hideLoginMode}
    <!-- Login Mode Toggle -->
    <div class="mb-3">
      <h3 class="text-xs font-medium text-[var(--dash-text-secondary)] mb-2">
        Login Mode
      </h3>
      <div
        class="flex rounded-md border border-[var(--dash-border)] overflow-hidden"
      >
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
  {/if}

  <!-- Credential list (only for auto-login) -->
  {#if loginMode === "auto"}
    <div class="space-y-1.5">
      {#each credentials as cred}
        <div
          class="
            rounded-md transition-colors {selectedId === String(cred.id)
            ? 'bg-[var(--dash-primary)]/10 border border-[var(--dash-primary)]/30'
            : 'bg-[var(--dash-bg)] border border-transparent hover:border-[var(--dash-border)]'}
          "
        >
          <div class="flex items-center gap-2.5 px-3 py-2 text-sm">
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
              {#if cred.shared}
                <span
                  class="text-xs px-1.5 py-0.5 rounded-full bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]"
                  title="Shared by {cred.owner_label ?? 'a contact'}"
                >
                  shared by {cred.owner_label ?? "a contact"}
                </span>
              {/if}
            </button>
            {#if !disabled && !cred.shared}
              <button
                type="button"
                onclick={() => {
                  if (editingCredId === cred.id) {
                    cancelEditCredential();
                  } else {
                    startEditCredential(cred.id);
                  }
                }}
                class="p-1 transition-colors {editingCredId === cred.id ? 'text-[var(--dash-primary)]' : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)]'}"
                title="Edit credential"
              >
                <FontAwesomeIcon icon={faPen} class="w-3 h-3" />
              </button>
              <button
                type="button"
                onclick={() => openShareModal(cred.id)}
                class="p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] transition-colors"
                title="Share with a contact"
              >
                <FontAwesomeIcon icon={faShareAlt} class="w-3 h-3" />
              </button>
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

          {#if editingCredId === cred.id && !cred.shared}
            <div
              class="px-3 pb-3 pt-1 space-y-2 border-t border-[var(--dash-border)]/50"
            >
              <div>
                <label
                  for="edit-password-{cred.id}"
                  class="block text-xs text-[var(--dash-text-secondary)] mb-1"
                >
                  Password
                </label>
                <div class="relative">
                  <input
                    type={editShowPassword ? "text" : "password"}
                    id="edit-password-{cred.id}"
                    bind:value={editPassword}
                    placeholder="Leave blank to keep current password"
                    class="w-full px-2 py-1 pr-8 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
                  />
                  <button
                    type="button"
                    onclick={() => (editShowPassword = !editShowPassword)}
                    class="absolute right-1.5 top-1/2 -translate-y-1/2 p-1 text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]"
                  >
                    <FontAwesomeIcon
                      icon={editShowPassword ? faEyeSlash : faEye}
                      class="w-3.5 h-3.5"
                    />
                  </button>
                </div>
              </div>
              <div>
                <label
                  for="edit-security-answer-{cred.id}"
                  class="block text-xs text-[var(--dash-text-secondary)] mb-1"
                >
                  Security Question Answer
                </label>
                <input
                  type="text"
                  id="edit-security-answer-{cred.id}"
                  bind:value={editSecurityAnswer}
                  placeholder="e.g., your mother's maiden name"
                  class="w-full px-2 py-1 text-sm border border-[var(--dash-border)] rounded bg-[var(--dash-bg)] text-[var(--dash-text)] placeholder-[var(--dash-text-muted)]"
                />
                <p class="text-xs text-[var(--dash-text-muted)] mt-1">
                  Auto-filled when a site asks a security question after login.
                </p>
              </div>
              <div class="flex justify-end gap-2">
                <button
                  type="button"
                  onclick={cancelEditCredential}
                  class="px-2 py-1 text-xs border border-[var(--dash-border)] rounded text-[var(--dash-text)] hover:bg-[var(--dash-card)] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onclick={saveCredentialEdits}
                  disabled={isSavingEdit ||
                    (editPassword.length === 0 &&
                      editSecurityAnswer === (cred.security_answer || ""))}
                  class="px-2 py-1 text-xs bg-[var(--dash-primary)] text-white rounded hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  {#if isSavingEdit}
                    <Spinner size="w-3 h-3" />
                  {:else}
                    <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                  {/if}
                  Save
                </button>
              </div>
            </div>
          {/if}
        </div>
      {/each}
    </div>

    {#if credentials.length === 0 && !showAddForm}
      <p class="mt-2 text-xs text-[var(--dash-text-muted)]">
        No credentials configured{platformName ? ` for ${platformName}` : ""}.
      </p>
    {/if}

    {#if !showAddForm && !disabled && loginMode === "auto"}
      <button
        type="button"
        onclick={() => (showAddForm = true)}
        class="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--dash-primary)] border border-dashed border-[var(--dash-border)] rounded-md hover:bg-[var(--dash-bg)] transition-colors w-full justify-center"
      >
        <FontAwesomeIcon icon={faPlus} class="w-3 h-3" />
        Add credentials
      </button>
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
              Security Question Answer <span
                class="font-normal text-[var(--dash-text-muted)]"
              >(optional)</span>
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

<!-- Share Credential Modal -->
{#if sharingCredentialId !== null}
  {@const sharingCred = credentials.find((c) => c.id === sharingCredentialId)}
  <div
    class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 sm:p-4"
  >
    <div
      class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)] w-full max-w-md shadow-xl flex flex-col max-h-full sm:max-h-[90vh]"
    >
      <div
        class="flex items-center justify-between p-4 border-b border-[var(--dash-border)]"
      >
        <div>
          <h3 class="font-medium text-[var(--dash-text)]">
            Share login
          </h3>
          <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">
            {sharingCred?.username ?? "credential"}
            {platformName ? `· ${platformName}` : ""}
          </p>
        </div>
        <button
          type="button"
          onclick={() => {
            sharingCredentialId = null;
            sharingError = null;
          }}
          class="p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
        >
          <FontAwesomeIcon icon={faTimes} class="w-4 h-4" />
        </button>
      </div>

      <div class="p-4 overflow-y-auto">
        <p class="text-xs text-[var(--dash-text-muted)] mb-3">
          Contacts you share this login with can use it on their import tasks
          but never see the password. They can only run it on devices you've
          also shared with them.
        </p>

        {#if sharingError}
          <div
            class="mb-3 p-2 rounded bg-[var(--dash-error-light)] border border-[var(--dash-error)] text-xs text-[var(--dash-error)]"
          >
            {sharingError}
          </div>
        {/if}

        {#if sharingLoading}
          <div class="flex items-center justify-center py-8">
            <Spinner size="w-6 h-6" />
          </div>
        {:else if sharingContacts.length === 0}
          <div class="text-center py-6">
            <p class="text-sm text-[var(--dash-text-secondary)]">
              No contacts yet. <a
                href="/contacts"
                class="text-[var(--dash-primary)] hover:underline"
              >Add contacts</a> to share logins.
            </p>
          </div>
        {:else}
          {#if sharingExisting.length > 0}
            <div class="mb-4">
              <p
                class="text-xs font-medium text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2"
              >
                Shared with
              </p>
              <div class="space-y-2">
                {#each sharingExisting as share (share.id)}
                  <div
                    class="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--dash-primary)]/5 border border-[var(--dash-primary)]/20"
                  >
                    <div class="flex items-center gap-2">
                      <div
                        class="w-6 h-6 rounded-full bg-[var(--dash-primary)]/20 flex items-center justify-center text-xs font-medium text-[var(--dash-primary)]"
                      >
                        {(share.user.name || share.user.email)[0].toUpperCase()}
                      </div>
                      <span class="text-sm text-[var(--dash-text)]">
                        {share.user.name || share.user.email}
                      </span>
                    </div>
                    <button
                      type="button"
                      onclick={() => unshareFromContact(share.user.id)}
                      class="p-1 text-[var(--dash-text-muted)] hover:text-red-400 transition-colors"
                      title="Remove access"
                    >
                      <FontAwesomeIcon icon={faUserMinus} class="w-3.5 h-3.5" />
                    </button>
                  </div>
                {/each}
              </div>
            </div>
          {/if}

          {@const unsharedContacts = sharingContacts.filter(
            (c) => !isSharedWith(c.id),
          )}
          {#if unsharedContacts.length > 0}
            <div>
              <p
                class="text-xs font-medium text-[var(--dash-text-secondary)] uppercase tracking-wide mb-2"
              >
                Your contacts
              </p>
              <div class="space-y-1">
                {#each unsharedContacts as contact (contact.id)}
                  <button
                    type="button"
                    onclick={() => shareWithContact(contact.id)}
                    class="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-[var(--dash-bg)] transition-colors text-left"
                  >
                    <div
                      class="w-6 h-6 rounded-full bg-[var(--dash-text-muted)]/20 flex items-center justify-center text-xs font-medium text-[var(--dash-text-muted)]"
                    >
                      {(contact.name || contact.email)[0].toUpperCase()}
                    </div>
                    <span class="text-sm text-[var(--dash-text)]">
                      {contact.name || contact.email}
                    </span>
                  </button>
                {/each}
              </div>
            </div>
          {:else if sharingExisting.length > 0}
            <p
              class="text-sm text-[var(--dash-text-secondary)] text-center py-2"
            >
              Shared with all your contacts.
            </p>
          {/if}
        {/if}
      </div>
    </div>
  </div>
{/if}
