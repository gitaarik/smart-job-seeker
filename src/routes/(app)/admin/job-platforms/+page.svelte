<script lang="ts">
  import type { PageData } from "./$types";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faExternalLinkAlt,
    faMinus,
    faPenToSquare,
  } from "@fortawesome/free-solid-svg-icons";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Job Platforms - Admin - Smart Job Seeker</title>
</svelte:head>

<div class="space-y-4">
  <div class="flex items-center justify-between">
    <h1 class="text-2xl font-semibold text-[var(--dash-text)]">Job Platforms</h1>
    <p class="text-sm text-[var(--dash-text-secondary)]">
      {data.platforms.length} total · {
        data.platforms.filter((p) => p.suggestion_priority !== null).length
      } in suggest pool
    </p>
  </div>

  <p class="text-sm text-[var(--dash-text-secondary)]">
    Platforms with a <code>suggestion_priority</code> and <code>search_url_template</code>
    show up in the AI suggestion flow at <code>/jobs/import/tasks</code>. Edit a row to
    change templates, priority, or hint, or to mark a broken platform as out of the pool.
  </p>

  <div class="overflow-x-auto bg-[var(--dash-card)] rounded-lg border border-[var(--dash-border)]">
    <table class="w-full text-sm">
      <thead
        class="text-xs uppercase tracking-wide text-[var(--dash-text-secondary)] bg-[var(--dash-bg)]"
      >
        <tr>
          <th class="text-left px-3 py-2">Priority</th>
          <th class="text-left px-3 py-2">Name</th>
          <th class="text-left px-3 py-2">Key</th>
          <th class="text-left px-3 py-2">Status</th>
          <th class="text-left px-3 py-2">Suggestable</th>
          <th class="text-left px-3 py-2">Template</th>
          <th class="text-left px-3 py-2">Edits</th>
          <th class="text-right px-3 py-2"></th>
        </tr>
      </thead>
      <tbody>
        {#each data.platforms as platform (platform.id)}
          {@const inPool = platform.suggestion_priority !== null
            && platform.search_url_template !== null}
          <tr class="border-t border-[var(--dash-border)]">
            <td class="px-3 py-2 text-[var(--dash-text-secondary)] tabular-nums">
              {platform.suggestion_priority ?? "—"}
            </td>
            <td class="px-3 py-2 font-medium">
              <a
                href="/admin/job-platforms/{platform.id}"
                class="text-[var(--dash-primary)] hover:underline"
              >{platform.name}</a>
              <a
                href={platform.url}
                target="_blank"
                rel="noopener noreferrer"
                class="text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] ml-1"
                title="Open base URL"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} class="w-3 h-3" />
              </a>
            </td>
            <td class="px-3 py-2 text-[var(--dash-text-secondary)] font-mono text-xs">
              {platform.key}
            </td>
            <td class="px-3 py-2">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs {platform.status === 'published'
                  ? 'bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}"
              >{platform.status}</span>
            </td>
            <td class="px-3 py-2">
              {#if inPool}
                <FontAwesomeIcon
                  icon={faCheck}
                  class="w-3 h-3 text-green-600 dark:text-green-400"
                />
              {:else}
                <FontAwesomeIcon
                  icon={faMinus}
                  class="w-3 h-3 text-[var(--dash-text-muted)]"
                />
              {/if}
            </td>
            <td
              class="px-3 py-2 max-w-md truncate font-mono text-xs text-[var(--dash-text-secondary)]"
              title={platform.search_url_template ?? ""}
            >
              {platform.search_url_template ?? "—"}
            </td>
            <td
              class="px-3 py-2 text-[var(--dash-text-secondary)] tabular-nums"
            >{platform.change_count}</td>
            <td class="px-3 py-2 text-right">
              <a
                href="/admin/job-platforms/{platform.id}"
                class="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-[var(--dash-border)] text-[var(--dash-text)] hover:bg-[var(--dash-bg)]"
              >
                <FontAwesomeIcon icon={faPenToSquare} class="w-3 h-3" />
                Edit
              </a>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
