<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faCheck } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../../components/Card.svelte";
  import Spinner from "$lib/components/Spinner.svelte";

  let { data }: { data: PageData } = $props();

  let digestEnabled = $state(data.emailDigest.enabled);
  let digestFrequency = $state(data.emailDigest.frequency_days);
  let digestMinScore = $state(data.emailDigest.min_score);
  let digestSaving = $state(false);
  let digestSaved = $state(false);
  let digestError = $state("");

  const hasEmail = $derived(!!data.emailDigest.email_address);

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
    {#if data.emailDigest.email_address}
      Emails will be sent to <strong>{data.emailDigest.email_address}</strong>.
    {/if}
  </p>

  {#if !hasEmail}
    <div
      class="rounded-lg border p-4 mb-4"
      style="background-color: var(--dash-warning-light); border-color: var(--dash-warning-border);"
    >
      <p class="text-sm" style="color: var(--dash-warning);">
        This profile doesn't have an email address. Add one in
        <a href="/dashboard/profile/edit" class="underline font-medium">Profile Data</a>
        to enable email digests.
      </p>
    </div>
  {/if}

  <div class="space-y-4">
    <!-- Enable toggle -->
    <label class="flex items-center gap-3 cursor-pointer">
      <button
        type="button"
        role="switch"
        aria-checked={digestEnabled}
        disabled={!hasEmail}
        onclick={() => (digestEnabled = !digestEnabled)}
        class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed {digestEnabled ? 'bg-[var(--dash-primary)]' : 'bg-[var(--dash-border)]'}"
        style="--tw-ring-color: var(--dash-primary); --tw-ring-offset-color: var(--dash-card);"
      >
        <span
          class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform {digestEnabled ? 'translate-x-6' : 'translate-x-1'}"
        ></span>
      </button>
      <span class="text-sm font-medium text-[var(--dash-text)]">
        {digestEnabled ? "Enabled" : "Disabled"}
      </span>
    </label>

    {#if digestEnabled}
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
      disabled={digestSaving || !hasEmail}
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
