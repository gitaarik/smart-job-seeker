<script lang="ts">
  import type { PageData } from "./$types";
  import { page } from "$app/stores";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCog, faCheck } from "@fortawesome/free-solid-svg-icons";
  import { authClient } from "$lib/auth-client";
  import Card from "../components/Card.svelte";
  import SectionHeader from "../profile/components/SectionHeader.svelte";
  import Spinner from "$lib/components/Spinner.svelte";
  import { TIMEZONE_OPTIONS, formatTzLabel } from "$lib/timezone";
  import { defaultTimeFormat, resolveTimeFormat, isHour12 } from "$lib/format-date";
  import type { TimeFormat } from "$lib/format-date";

  let { data }: { data: PageData } = $props();

  // Email
  let email = $state($page.data.user.email);
  let emailSaving = $state(false);
  let emailSaved = $state(false);
  let emailError = $state("");

  const originalEmail = $page.data.user.email;
  const emailChanged = $derived(email !== originalEmail);

  // Timezone
  let timezone = $state(data.timezone || "");
  let tzSaving = $state(false);
  let tzSaved = $state(false);
  let tzError = $state("");

  const originalTimezone = data.timezone || "";

  // Time format: null = auto, "12h", "24h"
  let timeFormat = $state<string | null>(data.timeFormatRaw);

  const originalTimeFormat = data.timeFormatRaw;

  const settingsChanged = $derived(
    timezone !== originalTimezone || timeFormat !== originalTimeFormat,
  );

  // Resolved format for display (never null)
  const resolvedFormat = $derived(
    resolveTimeFormat(timeFormat, timezone),
  );

  const autoLabel = $derived(
    `Auto (${defaultTimeFormat(timezone) === "12h" ? "12-hour" : "24-hour"})`,
  );

  // Live clock for selected timezone
  let currentTime = $state("");

  $effect(() => {
    if (!timezone) {
      currentTime = "";
      return;
    }
    const fmt = resolvedFormat;
    function updateTime() {
      try {
        currentTime = new Intl.DateTimeFormat("en-US", {
          timeZone: timezone,
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          weekday: "short",
          hour12: isHour12(fmt),
        }).format(new Date());
      } catch {
        currentTime = "";
      }
    }
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  });

  // Auto-detect timezone from browser if none is saved
  $effect(() => {
    if (!timezone) {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detected) timezone = detected;
      } catch {
        // ignore
      }
    }
  });

  async function saveEmail() {
    if (!emailChanged || !email.trim()) return;

    emailSaving = true;
    emailError = "";
    emailSaved = false;

    try {
      const result = await authClient.changeEmail({
        newEmail: email.trim(),
        callbackURL: "/settings",
      });

      if (result.error) {
        emailError = result.error.message || "Failed to update email";
        return;
      }

      emailSaved = true;
      setTimeout(() => (emailSaved = false), 5000);
    } catch {
      emailError = "Network error, please try again";
    } finally {
      emailSaving = false;
    }
  }

  async function saveSettings() {
    if (!settingsChanged || !timezone) return;

    tzSaving = true;
    tzError = "";
    tzSaved = false;

    try {
      const res = await fetch("/api/account", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timezone, time_format: timeFormat }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Failed to save" }));
        tzError = body.message || `Error ${res.status}`;
        return;
      }

      tzSaved = true;
      setTimeout(() => (tzSaved = false), 3000);
    } catch {
      tzError = "Network error, please try again";
    } finally {
      tzSaving = false;
    }
  }
</script>

<svelte:head>
  <title>Account Settings - Smart Job Seeker</title>
</svelte:head>

<SectionHeader title="Account Settings" icon={faCog} />

<div class="space-y-6">
  <Card padding="lg">
    <div class="space-y-5">
      <div>
        <label for="account-email" class="block text-sm font-medium text-[var(--dash-text)] mb-1.5">
          Email address
        </label>
        <input
          type="email"
          id="account-email"
          bind:value={email}
          class="w-full max-w-sm px-3 py-2 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] text-sm focus:outline-none focus:ring-2 focus:border-transparent"
          style="--tw-ring-color: var(--dash-primary);"
          placeholder="your@email.com"
        />
        <p class="mt-1 text-xs text-[var(--dash-text-muted)]">
          Used for login and account notifications. A verification email will be sent to confirm any changes.
        </p>
      </div>

      {#if emailError}
        <p class="text-sm" style="color: var(--dash-error);">{emailError}</p>
      {/if}

      {#if emailSaved}
        <p class="text-sm" style="color: var(--dash-success);">
          Verification email sent to <strong>{email}</strong>. Please check your inbox to confirm the change.
        </p>
      {/if}

      <button
        type="button"
        onclick={saveEmail}
        disabled={emailSaving || !emailChanged || !email.trim()}
        class="px-4 py-2 text-sm text-white font-medium rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 bg-[var(--dash-primary)]"
      >
        {#if emailSaving}
          <Spinner size="w-4 h-4" />
          Saving...
        {:else if emailSaved}
          <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
          Saved
        {:else}
          Save
        {/if}
      </button>
    </div>
  </Card>

  <div id="timezone">
  <Card padding="lg">
    <div class="space-y-5">
      <div>
        <label for="account-timezone" class="block text-sm font-medium text-[var(--dash-text)] mb-1.5">
          Timezone
        </label>
        <select
          id="account-timezone"
          bind:value={timezone}
          class="w-full max-w-xs px-3 py-2 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] text-sm focus:outline-none focus:ring-2 focus:border-transparent"
          style="--tw-ring-color: var(--dash-primary);"
        >
          <option value="">Select timezone...</option>
          {#each TIMEZONE_OPTIONS as group}
            <optgroup label={group.group}>
              {#each group.zones as tz}
                <option value={tz}>{formatTzLabel(tz)}</option>
              {/each}
            </optgroup>
          {/each}
        </select>
        {#if currentTime}
          <p class="mt-2 text-sm text-[var(--dash-text)]">
            Current time: <span class="font-medium">{currentTime}</span>
          </p>
        {/if}
        <p class="mt-1 text-xs text-[var(--dash-text-muted)]">
          Used for email digest scheduling. Applies to all your profiles.
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-[var(--dash-text)] mb-1.5">
          Time format
        </label>
        <div class="inline-flex rounded-lg border border-[var(--dash-border-input)] overflow-hidden">
          <button
            type="button"
            onclick={() => (timeFormat = null)}
            class="px-3 py-1.5 text-sm transition-colors {timeFormat === null
              ? 'bg-[var(--dash-primary)] text-white'
              : 'bg-[var(--dash-card)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
          >
            {autoLabel}
          </button>
          <button
            type="button"
            onclick={() => (timeFormat = "12h")}
            class="px-3 py-1.5 text-sm border-x border-[var(--dash-border-input)] transition-colors {timeFormat === '12h'
              ? 'bg-[var(--dash-primary)] text-white'
              : 'bg-[var(--dash-card)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
          >
            12-hour
          </button>
          <button
            type="button"
            onclick={() => (timeFormat = "24h")}
            class="px-3 py-1.5 text-sm transition-colors {timeFormat === '24h'
              ? 'bg-[var(--dash-primary)] text-white'
              : 'bg-[var(--dash-card)] text-[var(--dash-text)] hover:bg-[var(--dash-bg-hover)]'}"
          >
            24-hour
          </button>
        </div>
        <p class="mt-1 text-xs text-[var(--dash-text-muted)]">
          Controls how times are displayed across the app.
        </p>
      </div>

      {#if tzError}
        <p class="text-sm" style="color: var(--dash-error);">{tzError}</p>
      {/if}

      <button
        type="button"
        onclick={saveSettings}
        disabled={tzSaving || !settingsChanged || !timezone}
        class="px-4 py-2 text-sm text-white font-medium rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 bg-[var(--dash-primary)]"
      >
        {#if tzSaving}
          <Spinner size="w-4 h-4" />
          Saving...
        {:else if tzSaved}
          <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
          Saved
        {:else}
          Save
        {/if}
      </button>
    </div>
  </Card>
  </div>
</div>
