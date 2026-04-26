<script lang="ts">
  import type { PageData } from "./$types";
  import { page } from "$app/stores";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCog, faCheck, faEye, faEyeSlash, faPencil } from "@fortawesome/free-solid-svg-icons";
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
  let emailOpen = $state(false);

  const originalEmail = $page.data.user.email;
  const emailChanged = $derived(email !== originalEmail);

  // Password
  let currentPassword = $state("");
  let newPassword = $state("");
  let confirmPassword = $state("");
  let pwSaving = $state(false);
  let pwSaved = $state(false);
  let pwError = $state("");
  let pwOpen = $state(false);
  let showCurrentPassword = $state(false);
  let showNewPassword = $state(false);

  const MIN_PASSWORD_LENGTH = 8;
  const pwValid = $derived(
    currentPassword.length > 0 &&
    newPassword.length >= MIN_PASSWORD_LENGTH &&
    newPassword === confirmPassword
  );
  const pwMismatch = $derived(
    confirmPassword.length > 0 && newPassword !== confirmPassword
  );

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

  async function changePassword() {
    if (!pwValid) return;

    pwSaving = true;
    pwError = "";
    pwSaved = false;

    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });

      if (result.error) {
        pwError = result.error.message || "Failed to change password";
        return;
      }

      pwSaved = true;
      currentPassword = "";
      newPassword = "";
      confirmPassword = "";
      setTimeout(() => (pwSaved = false), 5000);
    } catch {
      pwError = "Network error, please try again";
    } finally {
      pwSaving = false;
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
      <!-- Email row -->
      {#if !emailOpen}
        <div class="flex items-center gap-3">
          <p class="text-sm font-medium text-[var(--dash-text)] w-20 shrink-0">Email</p>
          <p class="text-sm text-[var(--dash-text-muted)]">{originalEmail}</p>
          <button
            type="button"
            onclick={() => (emailOpen = true)}
            class="text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
            title="Change email"
          >
            <FontAwesomeIcon icon={faPencil} class="w-3 h-3" />
          </button>
        </div>
      {:else}
        <div class="space-y-4">
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
              A verification email will be sent to confirm any changes.
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

          <div class="flex items-center gap-3">
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
            <button
              type="button"
              onclick={() => { emailOpen = false; email = originalEmail; emailError = ""; }}
              class="px-4 py-2 text-sm font-medium text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      {/if}

      <hr class="border-[var(--dash-border)]" />

      <!-- Password row -->
      {#if !pwOpen}
        <div class="flex items-center gap-3">
          <p class="text-sm font-medium text-[var(--dash-text)] w-20 shrink-0">Password</p>
          <p class="text-sm text-[var(--dash-text-muted)] tracking-wider">••••••••••••</p>
          <button
            type="button"
            onclick={() => (pwOpen = true)}
            class="text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
            title="Change password"
          >
            <FontAwesomeIcon icon={faPencil} class="w-3 h-3" />
          </button>
        </div>
      {:else}
        <div class="space-y-4">
          <div>
            <label for="current-password" class="block text-sm font-medium text-[var(--dash-text)] mb-1.5">
              Current password
            </label>
            <div class="relative w-full max-w-sm">
              <input
                type={showCurrentPassword ? "text" : "password"}
                id="current-password"
                bind:value={currentPassword}
                autocomplete="current-password"
                class="w-full px-3 py-2 pr-10 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style="--tw-ring-color: var(--dash-primary);"
              />
              <button
                type="button"
                onclick={() => (showCurrentPassword = !showCurrentPassword)}
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
                tabindex={-1}
              >
                <FontAwesomeIcon icon={showCurrentPassword ? faEyeSlash : faEye} class="w-4 h-4" />
              </button>
            </div>
          </div>

          <div>
            <label for="new-password" class="block text-sm font-medium text-[var(--dash-text)] mb-1.5">
              New password
            </label>
            <div class="relative w-full max-w-sm">
              <input
                type={showNewPassword ? "text" : "password"}
                id="new-password"
                bind:value={newPassword}
                autocomplete="new-password"
                class="w-full px-3 py-2 pr-10 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] text-sm focus:outline-none focus:ring-2 focus:border-transparent"
                style="--tw-ring-color: var(--dash-primary);"
              />
              <button
                type="button"
                onclick={() => (showNewPassword = !showNewPassword)}
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)]"
                tabindex={-1}
              >
                <FontAwesomeIcon icon={showNewPassword ? faEyeSlash : faEye} class="w-4 h-4" />
              </button>
            </div>
            {#if newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH}
              <p class="mt-1 text-xs" style="color: var(--dash-error);">
                Password must be at least {MIN_PASSWORD_LENGTH} characters
              </p>
            {/if}
          </div>

          <div>
            <label for="confirm-password" class="block text-sm font-medium text-[var(--dash-text)] mb-1.5">
              Confirm new password
            </label>
            <input
              type="password"
              id="confirm-password"
              bind:value={confirmPassword}
              autocomplete="new-password"
              class="w-full max-w-sm px-3 py-2 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] text-sm focus:outline-none focus:ring-2 focus:border-transparent"
              style="--tw-ring-color: var(--dash-primary);"
            />
            {#if pwMismatch}
              <p class="mt-1 text-xs" style="color: var(--dash-error);">
                Passwords don't match
              </p>
            {/if}
          </div>

          {#if pwError}
            <p class="text-sm" style="color: var(--dash-error);">{pwError}</p>
          {/if}

          {#if pwSaved}
            <p class="text-sm" style="color: var(--dash-success);">
              Password updated successfully.
            </p>
          {/if}

          <div class="flex items-center gap-3">
            <button
              type="button"
              onclick={changePassword}
              disabled={pwSaving || !pwValid}
              class="px-4 py-2 text-sm text-white font-medium rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 bg-[var(--dash-primary)]"
            >
              {#if pwSaving}
                <Spinner size="w-4 h-4" />
                Updating...
              {:else if pwSaved}
                <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
                Updated
              {:else}
                Update password
              {/if}
            </button>
            <button
              type="button"
              onclick={() => { pwOpen = false; currentPassword = ""; newPassword = ""; confirmPassword = ""; pwError = ""; }}
              class="px-4 py-2 text-sm font-medium text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      {/if}
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
