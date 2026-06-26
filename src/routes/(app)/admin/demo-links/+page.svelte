<script lang="ts">
  import type { ActionData, PageData } from "./$types";
  import { enhance } from "$app/forms";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const TTL_OPTIONS = [
    { label: "1 day", seconds: 86400 },
    { label: "3 days", seconds: 259200 },
    { label: "7 days", seconds: 604800 },
    { label: "30 days", seconds: 2592000 },
  ];

  let copied = $state<string | null>(null);

  async function copy(text: string) {
    await navigator.clipboard.writeText(text);
    copied = text;
    setTimeout(() => (copied = null), 1500);
  }

  function linkUrl(token: string) {
    return `${data.origin}/demo/${token}`;
  }

  function isExpired(expiresAt: string | Date) {
    return new Date(expiresAt).getTime() <= Date.now();
  }

  function statusLabel(link: PageData["links"][number]) {
    if (link.status === "revoked") return "revoked";
    if (isExpired(link.expires_at)) return "expired";
    return link.demo_user_id ? "active · opened" : "active";
  }
</script>

<svelte:head>
  <title>Demo Links - Admin - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-6">
  <div>
    <h1 class="text-2xl font-semibold text-[var(--dash-text)]">Demo Links</h1>
    <p class="mt-1 text-sm text-[var(--dash-text-secondary)]">
      Each link mints one throwaway demo account on first open (Seeker plan,
      pre-filled profile), auto-logs the visitor in, and grants access to the
      devices you pick so scraping works immediately. Re-opening within the TTL
      resumes the same account.
    </p>
  </div>

  {#if form?.error}
    <p class="text-sm text-red-500">{form.error}</p>
  {/if}

  {#if form?.created}
    <div
      class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4 space-y-2"
    >
      <p class="text-sm font-medium text-[var(--dash-text)]">
        Link created — share it:
      </p>
      <div class="flex items-center gap-2">
        <input
          readonly
          value={form.created}
          class="flex-1 px-3 py-2 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
        <button
          type="button"
          onclick={() => copy(form.created!)}
          class="px-3 py-2 text-sm rounded bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)]"
        >
          {copied === form.created ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  {/if}

  <!-- Create form -->
  <form
    method="POST"
    action="?/create"
    use:enhance
    class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4 space-y-4"
  >
    <h2 class="text-lg font-medium text-[var(--dash-text)]">New demo link</h2>

    <fieldset>
      <legend class="text-sm font-medium text-[var(--dash-text)] mb-2">
        Devices to share
      </legend>
      {#if data.devices.length === 0}
        <p class="text-sm text-[var(--dash-text-secondary)]">
          You have no connected devices to share. Set one up first under
          <code>/jobs/import/devices</code>.
        </p>
      {:else}
        <div class="space-y-1">
          {#each data.devices as device}
            <label class="flex items-center gap-2 text-sm text-[var(--dash-text)]">
              <input type="checkbox" name="device_ids" value={device.id} />
              {device.name}
            </label>
          {/each}
        </div>
      {/if}
    </fieldset>

    <div class="flex flex-wrap gap-4">
      <label class="text-sm text-[var(--dash-text)]">
        Expires after
        <select
          name="ttl_seconds"
          class="mt-1 block px-3 py-2 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)]"
        >
          {#each TTL_OPTIONS as opt}
            <option value={opt.seconds} selected={opt.seconds === 604800}>
              {opt.label}
            </option>
          {/each}
        </select>
      </label>

      <label class="text-sm text-[var(--dash-text)]">
        Max scrape runs (blank = no cap)
        <input
          name="max_runs"
          type="number"
          min="1"
          value="20"
          class="mt-1 block w-40 px-3 py-2 text-sm rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] text-[var(--dash-text)]"
        />
      </label>
    </div>

    <button
      type="submit"
      class="px-4 py-2 text-sm rounded bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)]"
    >
      Create link
    </button>
  </form>

  <!-- Existing links -->
  <div
    class="overflow-x-auto bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)]"
  >
    <table class="w-full text-sm">
      <thead class="text-left text-[var(--dash-text-secondary)]">
        <tr>
          <th class="px-4 py-2 font-medium">Status</th>
          <th class="px-4 py-2 font-medium">Devices</th>
          <th class="px-4 py-2 font-medium">Expires</th>
          <th class="px-4 py-2 font-medium">Max runs</th>
          <th class="px-4 py-2 font-medium">Link</th>
          <th class="px-4 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each data.links as link}
          <tr class="border-t border-[var(--dash-border)] text-[var(--dash-text)]">
            <td class="px-4 py-2">{statusLabel(link)}</td>
            <td class="px-4 py-2">
              {link.deviceNames.length ? link.deviceNames.join(", ") : "—"}
            </td>
            <td class="px-4 py-2">
              {new Date(link.expires_at).toLocaleDateString()}
            </td>
            <td class="px-4 py-2">{link.max_runs ?? "∞"}</td>
            <td class="px-4 py-2">
              <button
                type="button"
                onclick={() => copy(linkUrl(link.token))}
                class="text-[var(--dash-primary)] hover:underline"
              >
                {copied === linkUrl(link.token) ? "Copied!" : "Copy link"}
              </button>
            </td>
            <td class="px-4 py-2 text-right">
              {#if link.status === "active" && !isExpired(link.expires_at)}
                <form method="POST" action="?/revoke" use:enhance>
                  <input type="hidden" name="link_id" value={link.id} />
                  <button
                    type="submit"
                    class="text-[var(--dash-text-muted)] hover:text-red-500"
                  >
                    Revoke
                  </button>
                </form>
              {/if}
            </td>
          </tr>
        {:else}
          <tr>
            <td
              colspan="6"
              class="px-4 py-6 text-center text-[var(--dash-text-secondary)]"
            >
              No demo links yet.
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
