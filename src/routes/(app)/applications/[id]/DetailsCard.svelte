<script lang="ts">
  /**
   * The details pulled out of this application's activity entries, grouped by
   * kind.
   *
   * The entries themselves are long and on another tab; the summary is three to
   * six sentences about where things stand. Neither can hold "two mandatory
   * office days" or "they'll send the take-home Monday" — the first buries it,
   * the second would become a list instead of a position. This is the shelf
   * those go on.
   *
   * Each row links back to the entry it came from where the model named one
   * that exists, because a fact stated on the overview page reads as the app
   * asserting it, and the cheapest form of trust is being able to go and look.
   */
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faListCheck,
    faWandMagicSparkles,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../components/Card.svelte";
  import { groupDetails, type StoredDetail } from "$lib/application-details";
  import { timeAgo } from "$lib/format";

  let { details, updatedAt, activityHref }: {
    details: StoredDetail[];
    updatedAt: Date | string | null;
    activityHref: string;
  } = $props();

  let groups = $derived(groupDetails(details ?? []));
</script>

{#if groups.length > 0}
  <Card padding="lg">
    <div class="space-y-4">
      <div class="flex items-center gap-2">
        <FontAwesomeIcon
          icon={faListCheck}
          class="w-4 h-4 text-[var(--dash-text-secondary)]"
        />
        <h2
          class="text-sm font-semibold text-[var(--dash-text)] uppercase tracking-wide"
        >
          Worth remembering
        </h2>
      </div>

      {#each groups as group (group.category)}
        <div class="space-y-1.5">
          <p
            class="text-xs font-medium text-[var(--dash-text-muted)] uppercase tracking-wide"
          >
            {group.label}
          </p>
          <ul class="space-y-1.5">
            {#each group.items as item (item.label)}
              <li class="text-sm leading-relaxed">
                <span class="text-[var(--dash-text)] font-medium"
                >{item.label}</span>
                <span class="text-[var(--dash-text-muted)]"> — </span>
                <span class="text-[var(--dash-text-secondary)]"
                >{item.value}</span>
                {#if item.record_id != null}
                  <a
                    href="{activityHref}#r{item.record_id}"
                    class="ml-1 text-xs text-[var(--dash-text-muted)] underline hover:text-[var(--dash-primary)] transition-colors whitespace-nowrap"
                    title="The entry this came from"
                  >source</a>
                {/if}
              </li>
            {/each}
          </ul>
        </div>
      {/each}

      <p
        class="flex flex-wrap items-center gap-1.5 text-xs text-[var(--dash-text-muted)] pt-1"
      >
        <FontAwesomeIcon icon={faWandMagicSparkles} class="w-3 h-3" />
        <span>
          Picked out of your
          <a
            href={activityHref}
            class="underline hover:text-[var(--dash-primary)] transition-colors"
          >activity entries</a>{#if updatedAt}<span
            >, {timeAgo(updatedAt)}</span
          >{/if}
        </span>
      </p>
    </div>
  </Card>
{/if}
