<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faBell,
    faBookmark,
    faChartBar,
    faStar,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "./Card.svelte";

  interface Stats {
    total: number;
    strong: number;
    strongThreshold: number;
    saved: number;
    newUnreviewed: number;
  }

  interface Props {
    stats: Stats;
  }

  let { stats }: Props = $props();

  const items = $derived([
    {
      label: "Total Matches",
      value: stats.total,
      icon: faChartBar,
      href: "/dashboard/jobs?minScore=1",
      color: "text-[var(--dash-text-muted)]",
    },
    {
      label: `Strong (${stats.strongThreshold}+)`,
      value: stats.strong,
      icon: faStar,
      href: `/dashboard/jobs?minScore=${stats.strongThreshold}`,
      color: "text-amber-500",
    },
    {
      label: "Saved Jobs",
      value: stats.saved,
      icon: faBookmark,
      href: "/dashboard/jobs?status=saved",
      color: "text-green-500",
    },
    {
      label: "New to Review",
      value: stats.newUnreviewed,
      icon: faBell,
      href: "/dashboard/jobs?minScore=1",
      color: "text-blue-500",
      highlight: stats.newUnreviewed > 0,
    },
  ]);
</script>

<div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
  {#each items as item (item.label)}
    <a href={item.href} class="block group">
      <Card padding="sm">
        <div class="flex items-center gap-2.5">
          <div
            class="w-8 h-8 rounded-lg bg-[var(--dash-bg)] flex items-center justify-center shrink-0 group-hover:bg-[var(--dash-border)] transition-colors"
          >
            <FontAwesomeIcon icon={item.icon} class="w-4 h-4 {item.color}" />
          </div>
          <div class="min-w-0">
            <div class="flex items-center gap-1.5">
              <p class="text-lg font-semibold text-[var(--dash-text)]">
                {item.value}
              </p>
              {#if item.highlight}
                <span
                  class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"
                ></span>
              {/if}
            </div>
            <p
              class="text-xs text-[var(--dash-text-secondary)] truncate group-hover:text-[var(--dash-primary)] transition-colors"
            >
              {item.label}
            </p>
          </div>
        </div>
      </Card>
    </a>
  {/each}
</div>
