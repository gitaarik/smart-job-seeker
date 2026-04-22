<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCheck, faPenToSquare, faPencil } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../../components/Card.svelte";
  import Checkbox from "../../../components/Checkbox.svelte";
  import ToggleSwitch from "../../../components/ToggleSwitch.svelte";
  import Spinner from "$lib/components/Spinner.svelte";

  let { data }: { data: PageData } = $props();

  let digestEnabled = $state(data.emailDigest.enabled);
  let digestFrequency = $state(data.emailDigest.frequency_days);
  let digestMinScore = $state(data.emailDigest.min_score);
  let digestPreferredHour = $state(data.emailDigest.preferred_hour);
  let sendToProfile = $state(
    data.emailDigest.send_to === "profile" || data.emailDigest.send_to === "both",
  );
  let sendToAccount = $state(
    data.emailDigest.send_to === "account" || data.emailDigest.send_to === "both",
  );
  let digestTimezone = $state(data.emailDigest.timezone || "");
  let sendToExpanded = $state(false);
  let digestSaving = $state(false);
  let digestSaved = $state(false);
  let digestError = $state("");

  const hasEmail = $derived(!!data.emailDigest.email_address);
  const hasAnyEmail = $derived(hasEmail || !!data.emailDigest.account_email);
  const digestSendTo = $derived(
    sendToProfile && sendToAccount ? "both" :
    sendToAccount ? "account" : "profile",
  );
  const canEnable = $derived(
    digestSendTo === "account" ? !!data.emailDigest.account_email : hasEmail,
  );
  const sendToSummary = $derived.by(() => {
    const emails: string[] = [];
    if (sendToProfile && data.emailDigest.email_address) emails.push(data.emailDigest.email_address);
    if (sendToAccount && data.emailDigest.account_email) emails.push(data.emailDigest.account_email);
    // deduplicate if same email
    return [...new Set(emails)].join(", ") || "No email selected";
  });

  const FREQUENCY_OPTIONS = [
    { value: 1, label: "Every day" },
    { value: 2, label: "Every 2 days" },
    { value: 3, label: "Every 3 days" },
    { value: 5, label: "Every 5 days" },
    { value: 7, label: "Every week" },
    { value: 14, label: "Every 2 weeks" },
  ];

  const SCORE_OPTIONS = [
    { value: 50, label: "50+ (all decent matches)" },
    { value: 60, label: "60+ (moderate matches)" },
    { value: 70, label: "70+ (good matches)" },
    { value: 80, label: "80+ (strong matches)" },
    { value: 90, label: "90+ (excellent matches only)" },
  ];

  const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
    const ampm = i < 12 ? "AM" : "PM";
    const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
    return { value: i, label: `${h12}:00 ${ampm}` };
  });

  // Common timezones grouped by region
  const TIMEZONE_OPTIONS = [
    { group: "Americas", zones: [
      "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
      "America/Anchorage", "America/Toronto", "America/Vancouver",
      "America/Mexico_City", "America/Bogota", "America/Lima",
      "America/Sao_Paulo", "America/Argentina/Buenos_Aires",
    ]},
    { group: "Europe", zones: [
      "Europe/London", "Europe/Dublin", "Europe/Paris", "Europe/Berlin",
      "Europe/Amsterdam", "Europe/Brussels", "Europe/Madrid", "Europe/Rome",
      "Europe/Zurich", "Europe/Vienna", "Europe/Stockholm", "Europe/Oslo",
      "Europe/Copenhagen", "Europe/Helsinki", "Europe/Warsaw", "Europe/Prague",
      "Europe/Bucharest", "Europe/Athens", "Europe/Istanbul", "Europe/Moscow",
      "Europe/Lisbon",
    ]},
    { group: "Asia & Pacific", zones: [
      "Asia/Dubai", "Asia/Kolkata", "Asia/Bangkok", "Asia/Singapore",
      "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Tokyo", "Asia/Seoul",
      "Asia/Jakarta", "Asia/Karachi", "Asia/Dhaka", "Asia/Taipei",
      "Australia/Sydney", "Australia/Melbourne", "Australia/Perth",
      "Pacific/Auckland",
    ]},
    { group: "Africa & Middle East", zones: [
      "Africa/Cairo", "Africa/Lagos", "Africa/Johannesburg", "Africa/Nairobi",
      "Africa/Casablanca", "Asia/Jerusalem", "Asia/Riyadh",
    ]},
  ];

  function formatTzLabel(tz: string): string {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName: "shortOffset",
      });
      const parts = formatter.formatToParts(now);
      const offset = parts.find((p) => p.type === "timeZoneName")?.value ?? "";
      const city = tz.split("/").pop()?.replace(/_/g, " ") ?? tz;
      return `${city} (${offset})`;
    } catch {
      return tz;
    }
  }

  // Auto-detect timezone from browser if none is saved
  $effect(() => {
    if (!digestTimezone) {
      try {
        const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
        if (detected) digestTimezone = detected;
      } catch {
        // ignore
      }
    }
  });

  async function saveDigestSettings() {
    digestSaving = true;
    digestError = "";
    digestSaved = false;

    try {
      const res = await fetch(`/api/profile/${data.profileId}/email-digest`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: digestEnabled,
          frequency_days: digestFrequency,
          min_score: digestMinScore,
          preferred_hour: digestPreferredHour,
          send_to: digestSendTo,
          timezone: digestTimezone || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: "Failed to save" }));
        digestError = body.message || `Error ${res.status}`;
        return;
      }

      digestSaved = true;
      setTimeout(() => (digestSaved = false), 3000);
    } catch {
      digestError = "Network error, please try again";
    } finally {
      digestSaving = false;
    }
  }
</script>

<svelte:head>
  <title>Email Digest - Smart Job Seeker</title>
</svelte:head>

<Card padding="lg">
  <p class="text-sm text-[var(--dash-text-secondary)] mb-5">
    Receive periodic emails with your top job matches.
  </p>

  {#if !hasAnyEmail}
    <div
      class="rounded-lg border p-4 mb-4"
      style="background-color: var(--dash-warning-light); border-color: var(--dash-warning-border);"
    >
      <p class="text-sm" style="color: var(--dash-warning);">
        No email address available. Add one in
        <a href="/dashboard/profile/edit" class="underline font-medium">Profile Data</a>
        to enable email digests.
      </p>
    </div>
  {/if}

  <div class="space-y-5">
    <ToggleSwitch
      bind:checked={digestEnabled}
      disabled={!canEnable}
      label="Email digest"
      description="Send periodic emails with your top job matches"
    />

    {#if digestEnabled}
      <!-- Send to -->
      <div>
        <span class="block text-sm font-medium text-[var(--dash-text)] mb-1.5">Send to</span>
        <button
          type="button"
          onclick={() => sendToExpanded = !sendToExpanded}
          class="inline-flex items-center gap-1.5 text-sm text-[var(--dash-text)] hover:text-[var(--dash-primary)] transition-colors"
        >
          <span>{sendToSummary}</span>
          <FontAwesomeIcon icon={faPencil} class="w-3 h-3 opacity-50" />
        </button>
        {#if sendToExpanded}
          <div class="flex flex-col gap-2 mt-2">
            {#if data.emailDigest.email_address}
              <div class="flex items-center gap-1.5">
                <Checkbox
                  bind:checked={sendToProfile}
                  label="{data.emailDigest.email_address} (profile)"
                />
                <a
                  href="/dashboard/profile/edit#email_address"
                  class="text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] transition-colors"
                  title="Edit profile email"
                >
                  <FontAwesomeIcon icon={faPenToSquare} class="w-3 h-3" />
                </a>
              </div>
            {/if}
            {#if data.emailDigest.account_email}
              <div class="flex items-center gap-1.5">
                <Checkbox
                  bind:checked={sendToAccount}
                  label="{data.emailDigest.account_email} (account)"
                />
                <a
                  href="/dashboard/settings#account-email"
                  class="text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] transition-colors"
                  title="Edit account email"
                >
                  <FontAwesomeIcon icon={faPenToSquare} class="w-3 h-3" />
                </a>
              </div>
            {/if}
          </div>
        {/if}
        {#if digestSendTo === "profile" && !hasEmail}
          <p class="mt-1.5 text-xs" style="color: var(--dash-warning);">
            This profile doesn't have an email address. Add one in
            <a href="/dashboard/profile/edit" class="underline">Profile Data</a>
            or switch to account email.
          </p>
        {/if}
      </div>

      <!-- Frequency -->
      <div>
        <label for="digest-frequency" class="block text-sm font-medium text-[var(--dash-text)] mb-1.5">
          Frequency
        </label>
        <select
          id="digest-frequency"
          bind:value={digestFrequency}
          class="w-full max-w-xs px-3 py-2 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] text-sm focus:outline-none focus:ring-2 focus:border-transparent"
          style="--tw-ring-color: var(--dash-primary);"
        >
          {#each FREQUENCY_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
      </div>

      <!-- Time & Timezone -->
      <div>
        <span class="block text-sm font-medium text-[var(--dash-text)] mb-1.5">Time</span>
        <div class="flex flex-wrap gap-3">
          <select
            id="digest-hour"
            bind:value={digestPreferredHour}
            class="px-3 py-2 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] text-sm focus:outline-none focus:ring-2 focus:border-transparent"
            style="--tw-ring-color: var(--dash-primary);"
          >
            {#each HOUR_OPTIONS as opt}
              <option value={opt.value}>{opt.label}</option>
            {/each}
          </select>
          <select
            id="digest-timezone"
            bind:value={digestTimezone}
            class="px-3 py-2 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] text-sm focus:outline-none focus:ring-2 focus:border-transparent"
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
        </div>
        <p class="mt-1 text-xs text-[var(--dash-text-muted)]">
          Timezone applies to all your profiles.
        </p>
      </div>

      <!-- Minimum Score -->
      <div>
        <label for="digest-min-score" class="block text-sm font-medium text-[var(--dash-text)] mb-1.5">
          Minimum match score
        </label>
        <select
          id="digest-min-score"
          bind:value={digestMinScore}
          class="w-full max-w-xs px-3 py-2 border border-[var(--dash-border-input)] rounded-md bg-[var(--dash-card)] text-[var(--dash-text)] text-sm focus:outline-none focus:ring-2 focus:border-transparent"
          style="--tw-ring-color: var(--dash-primary);"
        >
          {#each SCORE_OPTIONS as opt}
            <option value={opt.value}>{opt.label}</option>
          {/each}
        </select>
        <p class="mt-1 text-xs text-[var(--dash-text-muted)]">
          Only jobs scoring at or above this threshold will be included.
        </p>
      </div>
    {/if}

    {#if digestError}
      <p class="text-sm" style="color: var(--dash-error);">{digestError}</p>
    {/if}

    <!-- Save button -->
    <button
      type="button"
      onclick={saveDigestSettings}
      disabled={digestSaving}
      class="px-4 py-2 text-sm text-white font-medium rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 bg-[var(--dash-primary)]"
    >
      {#if digestSaving}
        <Spinner size="w-4 h-4" />
      {:else if digestSaved}
        <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
      {/if}
      {digestSaved ? "Saved" : "Save"}
    </button>

    {#if data.emailDigest.last_sent_at}
      <p class="text-xs text-[var(--dash-text-muted)]">
        Last digest sent: {new Date(data.emailDigest.last_sent_at).toLocaleDateString(undefined, { dateStyle: "medium" })}
      </p>
    {/if}
  </div>
</Card>
