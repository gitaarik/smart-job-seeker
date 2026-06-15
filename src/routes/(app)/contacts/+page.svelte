<script lang="ts">
  import type { PageData } from "./$types";
  import { invalidateAll } from "$app/navigation";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faEnvelope,
    faLaptop,
    faPlus,
    faTimes,
    faTrash,
    faUserPlus,
  } from "@fortawesome/free-solid-svg-icons";

  import Card from "../components/Card.svelte";

  let { data }: { data: PageData } = $props();

  let contacts = $state(data.contacts);
  let showAddForm = $state(false);
  let inviteEmail = $state("");
  let isSubmitting = $state(false);
  let errorMessage = $state<string | null>(null);
  let successMessage = $state<string | null>(null);

  // Split contacts into categories
  let pendingReceived = $derived(
    contacts.filter((c) =>
      c.status === "pending" && c.direction === "received"
    ),
  );
  let pendingSent = $derived(
    contacts.filter((c) => c.status === "pending" && c.direction === "sent"),
  );
  let accepted = $derived(contacts.filter((c) => c.status === "accepted"));

  async function sendRequest() {
    if (!inviteEmail.trim()) return;
    isSubmitting = true;
    errorMessage = null;
    successMessage = null;

    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail.trim() }),
      });

      const result = await res.json();

      if (!res.ok) {
        errorMessage = result.error || "Failed to send contact request";
        return;
      }

      successMessage = `Contact request sent to ${inviteEmail.trim()}`;
      inviteEmail = "";
      showAddForm = false;
      await invalidateAll();
      contacts = data.contacts;
    } catch {
      errorMessage = "Failed to send contact request";
    } finally {
      isSubmitting = false;
    }
  }

  async function acceptContact(contactId: number) {
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accept" }),
      });

      if (res.ok) {
        await invalidateAll();
        contacts = data.contacts;
      }
    } catch {
      errorMessage = "Failed to accept contact request";
    }
  }

  async function declineContact(contactId: number) {
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "decline" }),
      });

      if (res.ok) {
        await invalidateAll();
        contacts = data.contacts;
      }
    } catch {
      errorMessage = "Failed to decline contact request";
    }
  }

  async function removeContact(contactId: number, name: string) {
    if (!confirm(`Remove ${name || "this contact"}?`)) return;

    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        await invalidateAll();
        contacts = data.contacts;
      }
    } catch {
      errorMessage = "Failed to remove contact";
    }
  }
</script>

<svelte:head>
  <title>Contacts - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-bold text-[var(--dash-text)]">Contacts</h1>
      <p class="text-sm text-[var(--dash-text-secondary)] mt-1">
        Add contacts to share devices and collaborate.
      </p>
    </div>
    <button
      type="button"
      onclick={() => {
        showAddForm = !showAddForm;
        errorMessage = null;
        successMessage = null;
      }}
      class="flex items-center justify-center gap-2 p-3 sm:px-4 sm:py-2 text-sm font-medium rounded-lg bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)] transition-colors"
    >
      <FontAwesomeIcon
        icon={showAddForm ? faTimes : faPlus}
        class="w-5 h-5 sm:w-4 sm:h-4"
      />
      <span class="hidden sm:inline">{
        showAddForm ? "Cancel" : "Add Contact"
      }</span>
    </button>
  </div>

  <!-- Messages -->
  {#if errorMessage}
    <div
      class="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400"
    >
      {errorMessage}
    </div>
  {/if}
  {#if successMessage}
    <div
      class="px-4 py-3 rounded-lg bg-green-500/10 border border-green-500/20 text-sm text-green-400"
    >
      {successMessage}
    </div>
  {/if}

  <!-- Add Contact Form -->
  {#if showAddForm}
    <Card padding="md">
      <form
        onsubmit={(e) => {
          e.preventDefault();
          sendRequest();
        }}
        class="flex flex-col sm:flex-row gap-3"
      >
        <div class="flex-1 flex items-center gap-2">
          <FontAwesomeIcon
            icon={faEnvelope}
            class="w-4 h-4 text-[var(--dash-text-muted)] shrink-0"
          />
          <input
            type="email"
            bind:value={inviteEmail}
            placeholder="Enter their email address"
            class="flex-1 bg-[var(--dash-bg)] border border-[var(--dash-border)] rounded-lg px-3 py-2 text-sm text-[var(--dash-text)] placeholder:text-[var(--dash-text-muted)] focus:outline-none focus:border-[var(--dash-primary)]"
            required
          />
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !inviteEmail.trim()}
          class="px-4 py-2 text-sm font-medium rounded-lg bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSubmitting ? "Sending..." : "Send Request"}
        </button>
      </form>
    </Card>
  {/if}

  <!-- Pending Requests (received) -->
  {#if pendingReceived.length > 0}
    <Card>
      <div class="px-4 py-3 border-b border-[var(--dash-border)]">
        <h2 class="font-medium text-[var(--dash-text)]">
          Pending Requests
          <span
            class="ml-2 px-2 py-0.5 text-xs rounded-full bg-[var(--dash-primary)]/20 text-[var(--dash-primary)]"
          >
            {pendingReceived.length}
          </span>
        </h2>
      </div>
      <div class="divide-y divide-[var(--dash-border)]">
        {#each pendingReceived as contact (contact.id)}
          <div class="px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 rounded-full bg-[var(--dash-primary)]/20 flex items-center justify-center text-sm font-medium text-[var(--dash-primary)]"
              >
                {(contact.user.name || contact.user.email)[0].toUpperCase()}
              </div>
              <div>
                <p class="text-sm font-medium text-[var(--dash-text)]">
                  {contact.user.name || contact.user.email}
                </p>
                {#if contact.user.name}
                  <p class="text-xs text-[var(--dash-text-secondary)]">
                    {contact.user.email}
                  </p>
                {/if}
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                onclick={() => acceptContact(contact.id)}
                class="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--dash-success)]/20 text-[var(--dash-success)] hover:bg-[var(--dash-success)]/30 transition-colors"
              >
                <FontAwesomeIcon icon={faCheck} class="w-3 h-3" />
                Accept
              </button>
              <button
                type="button"
                onclick={() => declineContact(contact.id)}
                class="flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--dash-text-muted)]/20 text-[var(--dash-text-secondary)] hover:bg-red-500/20 hover:text-red-400 transition-colors"
              >
                <FontAwesomeIcon icon={faTimes} class="w-3 h-3" />
                Decline
              </button>
            </div>
          </div>
        {/each}
      </div>
    </Card>
  {/if}

  <!-- Accepted Contacts -->
  <Card>
    <div class="px-4 py-3 border-b border-[var(--dash-border)]">
      <h2 class="font-medium text-[var(--dash-text)]">
        My Contacts
        {#if accepted.length > 0}
          <span
            class="ml-2 text-sm font-normal text-[var(--dash-text-secondary)]"
          >
            ({accepted.length})
          </span>
        {/if}
      </h2>
    </div>
    {#if accepted.length === 0}
      <div class="px-4 py-8 text-center">
        <FontAwesomeIcon
          icon={faUserPlus}
          class="w-8 h-8 text-[var(--dash-text-muted)] mb-3"
        />
        <p class="text-sm text-[var(--dash-text-secondary)]">
          No contacts yet. Add someone to share devices and collaborate.
        </p>
      </div>
    {:else}
      <div class="divide-y divide-[var(--dash-border)]">
        {#each accepted as contact (contact.id)}
          {@const devices = data.sharedDevices[contact.user.id] ?? []}
          <div class="px-4 py-3 flex items-start justify-between">
            <div class="flex items-start gap-3 min-w-0">
              <div
                class="w-8 h-8 shrink-0 rounded-full bg-[var(--dash-primary)]/20 flex items-center justify-center text-sm font-medium text-[var(--dash-primary)]"
              >
                {(contact.user.name || contact.user.email)[0].toUpperCase()}
              </div>
              <div class="min-w-0">
                <p class="text-sm font-medium text-[var(--dash-text)]">
                  {contact.user.name || contact.user.email}
                </p>
                {#if contact.user.name}
                  <p class="text-xs text-[var(--dash-text-secondary)]">
                    {contact.user.email}
                  </p>
                {/if}
                {#if devices.length > 0}
                  <div class="flex flex-wrap items-center gap-1.5 mt-2">
                    <span class="text-xs text-[var(--dash-text-muted)]"
                    >Shared:</span>
                    {#each devices as device (device.id)}
                      <a
                        href="/jobs/import/devices"
                        class="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/20 transition-colors"
                        title="Manage on the Devices page"
                      >
                        <FontAwesomeIcon icon={faLaptop} class="w-3 h-3" />
                        {device.name}
                      </a>
                    {/each}
                  </div>
                {/if}
              </div>
            </div>
            <button
              type="button"
              onclick={() => removeContact(contact.id, contact.user.name || contact.user.email)}
              class="p-2 shrink-0 text-[var(--dash-text-muted)] hover:text-red-400 transition-colors"
              title="Remove contact"
            >
              <FontAwesomeIcon icon={faTrash} class="w-3.5 h-3.5" />
            </button>
          </div>
        {/each}
      </div>
    {/if}
  </Card>

  <!-- Pending Sent -->
  {#if pendingSent.length > 0}
    <Card>
      <div class="px-4 py-3 border-b border-[var(--dash-border)]">
        <h2 class="font-medium text-[var(--dash-text)]">Sent Requests</h2>
      </div>
      <div class="divide-y divide-[var(--dash-border)]">
        {#each pendingSent as contact (contact.id)}
          <div class="px-4 py-3 flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div
                class="w-8 h-8 rounded-full bg-[var(--dash-text-muted)]/20 flex items-center justify-center text-sm font-medium text-[var(--dash-text-muted)]"
              >
                {(contact.user.name || contact.user.email)[0].toUpperCase()}
              </div>
              <div>
                <p class="text-sm font-medium text-[var(--dash-text)]">
                  {contact.user.name || contact.user.email}
                </p>
                <p class="text-xs text-[var(--dash-text-muted)]">Pending</p>
              </div>
            </div>
            <button
              type="button"
              onclick={() => removeContact(contact.id, contact.user.name || contact.user.email)}
              class="p-2 text-[var(--dash-text-muted)] hover:text-red-400 transition-colors"
              title="Cancel request"
            >
              <FontAwesomeIcon icon={faTimes} class="w-3.5 h-3.5" />
            </button>
          </div>
        {/each}
      </div>
    </Card>
  {/if}
</div>
