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
  let pendingInvitations = $derived(data.pendingInvitations);
  let devices = $derived(data.devices);
  let showAddForm = $state(false);
  let showPendingInvites = $state(false);
  let addingUser = $state(false);
  let showFilter = $state<"all" | "active" | "invited">("all");

  let filteredUsers = $derived(
    showFilter === "all"
      ? users
      : showFilter === "invited"
        ? users.filter((u) => u.hasInvite)
        : users.filter((u) => !u.hasInvite),
  );

  // Add form state
  let newName = $state("");
  let newEmail = $state("");
  let newPassword = $state("");
  let newSendInvite = $state(true);
  let newApproved = $state(true);
  let newStaff = $state(false);
  let newAdmin = $state(false);
  let newPlan = $state("explorer");
  let newPlanMonths = $state(12);
  let newDeviceIds = $state<number[]>([]);

  function resetAddForm() {
    showAddForm = false;
    newName = "";
    newEmail = "";
    newPassword = "";
    newSendInvite = true;
    newApproved = true;
    newStaff = false;
    newAdmin = false;
    newPlan = "explorer";
    newPlanMonths = 12;
    newDeviceIds = [];
  }

  function toggleDevice(id: number) {
    newDeviceIds = newDeviceIds.includes(id)
      ? newDeviceIds.filter((d) => d !== id)
      : [...newDeviceIds, id];
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

  // Only ?/create returns this (grants applied immediately) — the union from
  // the other actions has no `warning`, hence the `in` check.
  let grantWarning = $derived(
    form && "warning" in form ? (form.warning as string) : null,
  );

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
      {#if grantWarning}
        <p class="text-green-700/80 text-xs mt-1 dark:text-green-400/80">
          {grantWarning}
        </p>
      {/if}
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

      <!-- Plan + device grants (applied on acceptance for invites) -->
      <div class="mt-4 pt-4 border-t border-[var(--dash-border)] space-y-4">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label
              for="new-plan"
              class="block text-sm font-medium text-[var(--dash-text)] mb-1"
            >
              Plan
            </label>
            <select
              id="new-plan"
              name="plan"
              bind:value={newPlan}
              class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md bg-[var(--dash-bg)] text-[var(--dash-text)] capitalize focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
            >
              {#each data.planOptions as plan}
                <option value={plan}>
                  {plan === "explorer" ? "Explorer (free — no grant)" : plan}
                </option>
              {/each}
            </select>
          </div>
          {#if newPlan !== "explorer"}
            <div>
              <label
                for="new-plan-months"
                class="block text-sm font-medium text-[var(--dash-text)] mb-1"
              >
                Plan length
              </label>
              <select
                id="new-plan-months"
                name="plan_months"
                bind:value={newPlanMonths}
                class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-md bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent"
              >
                {#each data.planDurations as months}
                  <option value={months}>
                    {months} month{months === 1 ? "" : "s"}
                  </option>
                {/each}
              </select>
              <p class="mt-1 text-xs text-[var(--dash-text-muted)]">
                {#if newSendInvite}
                  Counted from when they accept, not from today.
                {:else}
                  Counted from today.
                {/if}
              </p>
            </div>
          {/if}
        </div>

        <div>
          <span class="block text-sm font-medium text-[var(--dash-text)] mb-1">
            Share my devices
          </span>
          {#if devices.length === 0}
            <p class="text-xs text-[var(--dash-text-muted)]">
              You have no connected devices to share. Set one up under
              <code>/jobs/import/devices</code>.
            </p>
          {:else}
            <div class="flex flex-wrap gap-x-4 gap-y-2">
              {#each devices as device}
                <label
                  class="flex items-center gap-2 text-sm text-[var(--dash-text)]"
                >
                  <input
                    type="checkbox"
                    name="device_ids"
                    value={device.id}
                    checked={newDeviceIds.includes(device.id)}
                    onchange={() => toggleDevice(device.id)}
                    class="rounded border-[var(--dash-border)]"
                  />
                  {device.name}
                </label>
              {/each}
            </div>
            {#if newDeviceIds.length > 0}
              <p class="mt-1 text-xs text-[var(--dash-text-muted)]">
                They'll become an accepted contact of yours so the shared
                {newDeviceIds.length === 1 ? "device shows" : "devices show"}
                up under their imports.
              </p>
            {/if}
          {/if}
        </div>
      </div>

      {#if newSendInvite}
        <p class="mt-3 text-xs text-[var(--dash-text-muted)]">
          An invitation email will be sent. The user will set their own
          password. Any plan and devices above are granted when they accept.
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

  <!-- Pending Invitations -->
  {#if pendingInvitations.length > 0}
    <div class="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800/30 rounded-lg">
      <button
        type="button"
        class="w-full flex items-center justify-between p-4 text-sm font-medium text-orange-700 dark:text-orange-400 cursor-pointer"
        onclick={() => showPendingInvites = !showPendingInvites}
      >
        <span>Pending Invitations ({pendingInvitations.length})</span>
        <svg class="w-4 h-4 transition-transform {showPendingInvites ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {#if showPendingInvites}
        <div class="space-y-2 px-4 pb-4">
          {#each pendingInvitations as invite}
            <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 text-sm">
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-[var(--dash-text)] font-medium">{invite.name || invite.email}</span>
                  {#if invite.is_admin}
                    <span class="px-1.5 py-0.5 text-xs rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400">Admin</span>
                  {/if}
                  {#if invite.is_staff}
                    <span class="px-1.5 py-0.5 text-xs rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400">Staff</span>
                  {/if}
                  {#if invite.plan && invite.plan !== "explorer"}
                    <span class="px-1.5 py-0.5 text-xs rounded-full capitalize bg-[var(--dash-primary)]/15 text-[var(--dash-primary)]">
                      {invite.plan}{invite.planMonths ? ` · ${invite.planMonths}mo` : ""}
                    </span>
                  {/if}
                  {#each invite.deviceNames as deviceName}
                    <span class="px-1.5 py-0.5 text-xs rounded-full bg-teal-500/15 text-teal-600 dark:text-teal-400">
                      {deviceName}
                    </span>
                  {/each}
                </div>
                {#if invite.name}
                  <div class="text-[var(--dash-text-muted)] text-xs">{invite.email}</div>
                {/if}
              </div>
              <form
                method="POST"
                action="?/update_invite_expiry"
                use:enhance={() => {
                  return async ({ update }) => { await update(); };
                }}
                class="flex items-center gap-1.5 flex-shrink-0"
              >
                <input type="hidden" name="email" value={invite.email} />
                <span class="text-xs text-[var(--dash-text-muted)]">Expires</span>
                <input
                  type="date"
                  name="expiresAt"
                  value={new Date(invite.expiresAt).toISOString().split("T")[0]}
                  onchange={(e) => e.currentTarget.form?.requestSubmit()}
                  class="text-xs text-[var(--dash-text-muted)] bg-transparent border-b border-dashed border-[var(--dash-text-muted)]/40 hover:border-[var(--dash-primary)] focus:border-[var(--dash-primary)] focus:outline-none cursor-pointer px-0.5"
                />
              </form>
              <form
                method="POST"
                action="?/revoke_invite"
                use:enhance={({ cancel }) => {
                  if (!confirm(`Revoke invitation for ${invite.email}?`)) { cancel(); return; }
                  return async ({ update }) => { await update(); };
                }}
              >
                <input type="hidden" name="email" value={invite.email} />
                <button
                  type="submit"
                  class="text-xs text-[var(--dash-error)]/60 hover:text-[var(--dash-error)] transition-colors"
                >Revoke</button>
              </form>
            </div>
          {/each}
        </div>
      {/if}
    </div>
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
      {#each filteredUsers as user (user.id)}
        <a
          href="/admin/users/{user.id}"
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
