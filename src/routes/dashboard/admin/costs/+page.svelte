<script lang="ts">
  import type { PageData } from "./$types";
  import {
    faChartLine,
  } from "@fortawesome/free-solid-svg-icons";
  import SectionHeader from "../../profile/components/SectionHeader.svelte";
  import Card from "../../components/Card.svelte";

  let { data }: { data: PageData } = $props();

  function formatUsd(value: number): string {
    return value < 0.01 && value > 0
      ? `$${value.toFixed(4)}`
      : `$${value.toFixed(2)}`;
  }

  function formatNumber(value: number): string {
    return value.toLocaleString();
  }

  function planLabel(plan: string): string {
    return plan.charAt(0).toUpperCase() + plan.slice(1);
  }
</script>

<div class="space-y-6">
  <SectionHeader title="Cost Analysis" icon={faChartLine} />

  <!-- Period selector -->
  <div class="flex items-center gap-3 flex-wrap">
    <span class="text-sm text-[var(--dash-text-muted)]">Period:</span>
    {#each data.availableMonths as month}
      <a
        href="?period={month.value}"
        class="text-sm px-3 py-1 rounded-md transition-colors {data.currentPeriod === month.value
          ? 'bg-[var(--dash-accent)] text-white'
          : 'bg-[var(--dash-card)] border border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:border-[var(--dash-accent)]'}"
      >
        {month.label}
      </a>
    {/each}
    <a
      href="?period=all"
      class="text-sm px-3 py-1 rounded-md transition-colors {data.currentPeriod === 'all'
        ? 'bg-[var(--dash-accent)] text-white'
        : 'bg-[var(--dash-card)] border border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:border-[var(--dash-accent)]'}"
    >
      All time
    </a>
  </div>

  <!-- Summary cards -->
  <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
    <Card padding="md">
      <div class="text-sm text-[var(--dash-text-muted)]">Revenue</div>
      <div class="text-2xl font-semibold text-[var(--dash-text)]">{formatUsd(data.summary.totalRevenueUsd)}</div>
      <div class="text-xs text-[var(--dash-text-muted)]">{data.periodLabel}</div>
    </Card>
    <Card padding="md">
      <div class="text-sm text-[var(--dash-text-muted)]">LLM Cost</div>
      <div class="text-2xl font-semibold text-[var(--dash-text)]">{formatUsd(data.summary.totalCostUsd)}</div>
      <div class="text-xs text-[var(--dash-text-muted)]">{formatNumber(data.summary.totalTransactions)} API calls</div>
    </Card>
    <Card padding="md">
      <div class="text-sm text-[var(--dash-text-muted)]">Margin</div>
      <div class="text-2xl font-semibold {data.summary.totalRevenueUsd - data.summary.totalCostUsd >= 0 ? 'text-green-500' : 'text-red-500'}">
        {formatUsd(data.summary.totalRevenueUsd - data.summary.totalCostUsd)}
      </div>
      <div class="text-xs text-[var(--dash-text-muted)]">LLM costs only, excl. infra</div>
    </Card>
    <Card padding="md">
      <div class="text-sm text-[var(--dash-text-muted)]">Data Coverage</div>
      <div class="text-2xl font-semibold text-[var(--dash-text)]">
        {data.summary.totalTransactions > 0
          ? Math.round(((data.summary.totalTransactions - data.summary.totalMissingCost) / data.summary.totalTransactions) * 100)
          : 0}%
      </div>
      <div class="text-xs text-[var(--dash-text-muted)]">
        {data.summary.totalMissingCost > 0 ? `${formatNumber(data.summary.totalMissingCost)} missing cost data` : 'All transactions have cost data'}
      </div>
    </Card>
  </div>

  <!-- Cost by plan -->
  <Card padding="responsive">
    <h3 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Cost by Plan</h3>
    {#if data.planStats.length === 0}
      <p class="text-sm text-[var(--dash-text-muted)]">No AI transactions in this period.</p>
    {:else}
      <div class="space-y-3">
        {#each data.planStats as plan}
          <div class="flex items-center justify-between py-2 border-b border-[var(--dash-border)] last:border-0">
            <div>
              <span class="font-medium text-[var(--dash-text)]">{planLabel(plan.plan)}</span>
              <span class="text-sm text-[var(--dash-text-muted)] ml-2">
                {plan.userCount} user{plan.userCount !== 1 ? 's' : ''}
              </span>
            </div>
            <div class="text-right">
              <div class="flex items-center gap-4">
                <div class="text-sm text-[var(--dash-text-muted)]">
                  Revenue: <span class="text-[var(--dash-text)]">{formatUsd(plan.revenueUsd)}</span>
                </div>
                <div class="text-sm text-[var(--dash-text-muted)]">
                  Cost: <span class="text-[var(--dash-text)]">{formatUsd(plan.totalCostUsd)}</span>
                </div>
                <div class="text-sm font-medium {plan.revenueUsd - plan.totalCostUsd >= 0 ? 'text-green-500' : 'text-red-500'}">
                  {formatUsd(plan.revenueUsd - plan.totalCostUsd)}
                </div>
              </div>
              <div class="text-xs text-[var(--dash-text-muted)]">
                {formatNumber(plan.transactions)} calls, {formatNumber(plan.totalCredits)} credits
                {#if plan.missingCost > 0}
                  <span class="text-amber-500">({plan.missingCost} missing cost)</span>
                {/if}
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </Card>

  <!-- Cost by provider/model -->
  <Card padding="responsive">
    <h3 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Cost by Provider</h3>
    {#if data.providerStats.length === 0}
      <p class="text-sm text-[var(--dash-text-muted)]">No provider data available. Run the backfill script or wait for new transactions.</p>
    {:else}
      <div class="space-y-3">
        {#each data.providerStats as ps}
          <div class="flex items-center justify-between py-2 border-b border-[var(--dash-border)] last:border-0">
            <div>
              <span class="font-medium text-[var(--dash-text)]">{ps.provider}</span>
              <span class="text-sm text-[var(--dash-text-muted)] ml-1">/ {ps.model}</span>
            </div>
            <div class="text-right">
              <div class="text-sm text-[var(--dash-text)]">{formatUsd(ps.totalCostUsd)}</div>
              <div class="text-xs text-[var(--dash-text-muted)]">
                {formatNumber(ps.transactions)} calls, {formatNumber(ps.totalTokens)} tokens
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </Card>

  <!-- Top users by cost -->
  <Card padding="responsive">
    <h3 class="text-lg font-semibold text-[var(--dash-text)] mb-4">Top Users by Cost</h3>
    {#if data.topUsers.length === 0}
      <p class="text-sm text-[var(--dash-text-muted)]">No user cost data available.</p>
    {:else}
      <div class="space-y-3">
        {#each data.topUsers as user, i}
          <div class="flex items-center justify-between py-2 border-b border-[var(--dash-border)] last:border-0">
            <div class="flex items-center gap-3">
              <span class="text-sm text-[var(--dash-text-muted)] w-6 text-right">{i + 1}.</span>
              <div>
                <span class="font-medium text-[var(--dash-text)]">{user.name || user.email}</span>
                <span class="text-xs text-[var(--dash-text-muted)] ml-2 capitalize">{user.plan}</span>
              </div>
            </div>
            <div class="text-right">
              <div class="text-sm text-[var(--dash-text)]">{formatUsd(user.costUsd)}</div>
              <div class="text-xs text-[var(--dash-text-muted)]">
                {formatNumber(user.transactions)} calls, {formatNumber(user.credits)} credits
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </Card>
</div>
