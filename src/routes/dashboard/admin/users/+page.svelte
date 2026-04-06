<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";
  import {
    faUsers,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import EmptyState from "../../profile/components/EmptyState.svelte";
  import Card from "../../components/Card.svelte";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let users = $derived(data.users);
  let showAddForm = $state(false);
  let addingUser = $state(false);

  // Add form state
  let newName = $state("");
  let newEmail = $state("");
  let newPassword = $state("");
  let newSendInvite = $state(true);
  let newApproved = $state(true);
  let newStaff = $state(false);
  let newAdmin = $state(false);

  function resetAddForm() {
    showAddForm = false;
    newName = "";
    newEmail = "";
    newPassword = "";
    newSendInvite = true;
    newApproved = true;
    newStaff = false;
    newAdmin = false;
  }

  function handleAddSubmit() {
    addingUser = true;
    return async (
      { result, update }: {
        result: { type: string };
        update: () => Promise<void>;
      },
    ) => {
      await update();
      addingUser = false;
      if (result.type === "success") {
        resetAddForm();
      }
    };
  }

  function formatDate(date: Date | string | null) {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }
</script>

<div class="space-y-6">
  <SectionHeader
    title="Users"
    icon={faUsers}
    showAddButton={!showAddForm && users.length > 0}
    addLabel="Add User"
    onAdd={() => (showAddForm = true)}
  />

  {#if form?.error}
    <div
      class="bg-[var(--dash-error-light)] border border-[var(--dash-error)] rounded-lg p-4"
    >
      <p class="text-[var(--dash-error)] text-sm">{form.error}</p>
    </div>
  {/if}

  {#if form?.success}
    <div
      class="bg-green-50 border border-green-400 rounded-lg p-4 dark:bg-green-900/20 dark:border-green-600"
    >
      <p class="text-green-700 text-sm dark:text-green-400">
        Operation completed successfully.
      </p>
    </div>
  {/if}

  <!-- Add Form -->
  {#if showAddForm}
    <form
      method="POST"
      action={newSendInvite ? "?/invite" : "?/create"}
      use:enhance={handleAddSubmit}
      class="bg-[var(--dash-card)] rounded-lg border border-[var(--dash-primary)] p-4"
    >
      <h3 class="font-medium text-[var(--dash-text)] mb-4">Add New User</h3>

      <!-- Invite / Password toggle -->
      <div class="flex gap-1 mb-4 p-1 bg-[var(--dash-bg)] rounded-lg w-fit">
        <button
          type="button"
          onclick={() => (newSendInvite = true)}
          class="
            px-3 py-1.5 text-sm rounded-md transition-colors {newSendInvite
            ? 'bg-[var(--dash-primary)] text-white'
            : 'text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}
          "
        >
          Send Invite
        </button>
        <button
          type="button"
          onclick={() => (newSendInvite = false)}
          class="
            px-3 py-1.5 text-sm rounded-md transition-colors {!newSendInvite
            ? 'bg-[var(--dash-primary)] text-white'
            : 'text-[var(--dash-text-secondary)] hover:text-[var(--dash-text)]'}
          "
        >
          Set Password
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label
            for="new-name"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Name
          </label>
          <input
            type="text"
            id="new-name"
            name="name"
            bind:value={newName}
            placeholder="Full name"
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>
        <div>
          <label
            for="new-email"
            class="block text-sm font-medium text-[var(--dash-text)] mb-1"
          >
            Email <span class="text-[var(--dash-error)]">*</span>
          </label>
          <input
            type="email"
            id="new-email"
            name="email"
            bind:value={newEmail}
            placeholder="user@example.com"
            required
            class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
          />
        </div>
        {#if !newSendInvite}
          <div>
            <label
              for="new-password"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Password <span class="text-[var(--dash-error)]">*</span>
            </label>
            <input
              type="password"
              id="new-password"
              name="password"
              bind:value={newPassword}
              placeholder="Min 8 characters"
              required
              minlength="8"
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            />
          </div>
        {/if}
        <div class="flex items-end gap-4 pb-1">
          <label
            class="flex items-center gap-2 text-sm text-[var(--dash-text)]"
          >
            <input
              type="checkbox"
              name="is_approved"
              bind:checked={newApproved}
              class="rounded border-[var(--dash-border)]"
            />
            Approved
          </label>
          <label
            class="flex items-center gap-2 text-sm text-[var(--dash-text)]"
          >
            <input
              type="checkbox"
              name="is_staff"
              bind:checked={newStaff}
              class="rounded border-[var(--dash-border)]"
            />
            Staff
          </label>
          <label
            class="flex items-center gap-2 text-sm text-[var(--dash-text)]"
          >
            <input
              type="checkbox"
              name="is_admin"
              bind:checked={newAdmin}
              class="rounded border-[var(--dash-border)]"
            />
            Admin
          </label>
        </div>
      </div>

      {#if newSendInvite}
        <p class="mt-3 text-xs text-[var(--dash-text-muted)]">
          An invitation email will be sent. The user will set their own
          password.
        </p>
      {/if}

      <div class="flex justify-end gap-2 mt-4">
        <button
          type="button"
          onclick={resetAddForm}
          class="px-4 py-2 border border-[var(--dash-border)] rounded-lg text-[var(--dash-text)] hover:bg-[var(--dash-bg)] transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={addingUser}
          class="px-4 py-2 bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {#if addingUser}
            <Spinner size="w-4 h-4" />
            {newSendInvite ? "Sending..." : "Adding..."}
          {:else}
            {newSendInvite ? "Send Invite" : "Add User"}
          {/if}
        </button>
      </div>
    </form>
  {/if}

  <!-- Users List -->
  {#if users.length === 0 && !showAddForm}
    <EmptyState
      icon={faUsers}
      title="No users yet"
      description="Create the first user account to get started."
      actionLabel="Add First User"
      onAction={() => (showAddForm = true)}
    />
  {:else}
    <div class="space-y-3">
      {#each users as user (user.id)}
        <a
          href="/dashboard/admin/users/{user.id}"
          class="block"
        >
          <Card class="overflow-hidden relative transition-all hover:border-[var(--dash-primary)]/30">
            <div class="p-3 sm:p-4 hover:bg-[var(--dash-bg)] transition-colors">
              <div class="flex items-start gap-3">
                <div class="flex-1 min-w-0">
                  <div class="flex items-center gap-2 flex-wrap">
                    <h3
                      class="font-medium text-[var(--dash-text)] text-sm sm:text-base"
                    >
                      {user.name || "(no name)"}
                    </h3>
                    {#if user.is_admin}
                      <span
                        class="px-1.5 py-0.5 text-xs rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400"
                      >Admin</span>
                    {/if}
                    {#if user.is_staff}
                      <span
                        class="px-1.5 py-0.5 text-xs rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400"
                      >Staff</span>
                    {/if}
                    {#if user.is_approved}
                      <span
                        class="px-1.5 py-0.5 text-xs rounded-full bg-green-500/15 text-green-600 dark:text-green-400"
                      >Approved</span>
                    {:else}
                      <span
                        class="px-1.5 py-0.5 text-xs rounded-full bg-yellow-500/15 text-yellow-600 dark:text-yellow-400"
                      >Pending</span>
                    {/if}
                    {#if user.hasInvite}
                      <span
                        class="px-1.5 py-0.5 text-xs rounded-full bg-orange-500/15 text-orange-600 dark:text-orange-400"
                      >Invited</span>
                    {/if}
                    <span
                      class="px-1.5 py-0.5 text-xs rounded-full capitalize {user.plan === 'free'
                        ? 'bg-[var(--dash-text-muted)]/15 text-[var(--dash-text-muted)]'
                        : 'bg-[var(--dash-primary)]/15 text-[var(--dash-primary)]'}"
                    >{user.plan}</span>
                  </div>
                  <p
                    class="text-xs sm:text-sm text-[var(--dash-text-secondary)] mt-0.5"
                  >
                    {user.email}
                  </p>
                  <div
                    class="flex items-center gap-3 mt-1 text-xs text-[var(--dash-text-muted)]"
                  >
                    <span>Joined {formatDate(user.createdAt)}</span>
                    <span>{user.profileCount}
                      {
                        user.profileCount === 1
                          ? "profile"
                          : "profiles"
                      }</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </a>
      {/each}
    </div>
  {/if}
</div>
