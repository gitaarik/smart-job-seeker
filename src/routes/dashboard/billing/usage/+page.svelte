<script lang="ts">
  import { page } from "$app/stores";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCheck,
    faBolt,
  } from "@fortawesome/free-solid-svg-icons";

  let { data } = $props();
  let { creditBalance, transactions, subscription, creditPacks, creditCostExamples } = $derived(data);
  let loading = $state("");
  let successMsg = $state($page.url.searchParams.get("success") || "");

  function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(0)}`;
  }

  function getUsageColor(percentage: number): string {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-amber-500";
    return "bg-[var(--dash-primary)]";
  }

  async function handleCheckout(priceId: string) {
    loading = priceId;
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, type: "credit" }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // Silently fail — user can retry
    } finally {
      loading = "";
    }
  }

  $effect(() => {
    if (successMsg) {
      const timer = setTimeout(() => (successMsg = ""), 5000);
      return () => clearTimeout(timer);
    }
  });

  function formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }

  function formatOp(op: string): string {
    const labels: Record<string, string> = {
      ai_generation: "AI Generation",
      resume_parse_ai: "Resume Parse",
      pdf_export: "PDF Export",
      scrape: "Scrape",
      credit_purchase: "Credit Purchase",
    };
    return labels[op] || op;
  }
</script>

<div class="space-y-6">
  <h1 class="text-xl font-semibold text-[var(--dash-text)]">Credit Usage</h1>

  {#if successMsg}
    <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
      <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
      Credits added!
    </div>
  {/if}

  <!-- Credit Balance -->
  {#if creditBalance}
    {@const total = creditBalance.allowance + creditBalance.extra}
    {@const percentage = total > 0 ? Math.round((creditBalance.used / total) * 100) : 0}
    <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-5">
      <div class="flex items-center justify-between mb-3">
        <h2 class="text-base font-semibold text-[var(--dash-text)]">Credits</h2>
        {#if creditBalance.periodEnd}
          <span class="text-xs text-[var(--dash-text-muted)]">
            Resets {new Date(creditBalance.periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
          </span>
        {/if}
      </div>
      <div class="flex items-center justify-between text-sm mb-1">
        <span class="text-[var(--dash-text-secondary)]">
          <span class="font-semibold text-[var(--dash-text)]">{creditBalance.available}</span>
          <span class="text-[var(--dash-text-muted)]">
            / {creditBalance.allowance}{creditBalance.extra > 0 ? ` +${creditBalance.extra} extra` : ""} remaining
          </span>
        </span>
      </div>
      <div class="h-2.5 bg-[var(--dash-bg)] rounded-full overflow-hidden">
        <div
          class="{getUsageColor(percentage)} h-full rounded-full transition-all"
          style="width: {Math.min(percentage, 100)}%"
        ></div>
      </div>
    </div>
  {/if}

  <!-- What credits can do -->
  {#if creditCostExamples}
    <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-5">
      <h2 class="text-base font-semibold text-[var(--dash-text)] mb-3">What Can You Do with Credits?</h2>
      <div class="grid gap-2 sm:grid-cols-2">
        {#each Object.values(creditCostExamples) as example}
          <div class="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg hover:bg-[var(--dash-bg)]">
            <span class="text-[var(--dash-text-secondary)]">{example.label}</span>
            <span class="text-[var(--dash-text)] font-medium">
              {#if example.avgCredits === 0}
                <span class="text-green-600">Free</span>
              {:else}
                ~{example.avgCredits} cr
              {/if}
            </span>
          </div>
        {/each}
      </div>
      <p class="text-xs text-[var(--dash-text-muted)] mt-2">
        Actual costs vary based on content size and complexity. AI operations scale with token usage.
      </p>
    </div>
  {/if}

  <!-- Extra Credits -->
  {#if creditPacks.some((p) => p.stripePriceId)}
    <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-5">
      <h2 class="text-base font-semibold text-[var(--dash-text)] mb-1">Buy Extra Credits</h2>
      <p class="text-xs text-[var(--dash-text-muted)] mb-4">Need more credits this month? Top up instantly.</p>

      <div class="grid gap-3 sm:grid-cols-3">
        {#each creditPacks as pack}
          {#if pack.stripePriceId}
            <div class="border border-[var(--dash-border)] rounded-lg p-3">
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium text-[var(--dash-text)]">{pack.name}</span>
                <span class="text-sm font-semibold text-[var(--dash-primary)]">{formatPrice(pack.priceCents)}</span>
              </div>
              <p class="text-xs text-[var(--dash-text-muted)] mb-3">{pack.description}</p>
              <button
                onclick={() => handleCheckout(pack.stripePriceId)}
                disabled={loading === pack.stripePriceId}
                class="w-full px-3 py-1.5 text-xs bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] rounded-lg hover:bg-[var(--dash-primary)]/20 transition-colors disabled:opacity-50 font-medium"
              >
                <FontAwesomeIcon icon={faBolt} class="w-3 h-3" />
                {loading === pack.stripePriceId ? "Loading..." : "Buy"}
              </button>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <!-- Recent Activity -->
  {#if transactions && transactions.length > 0}
    <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-5">
      <h2 class="text-base font-semibold text-[var(--dash-text)] mb-3">Recent Activity</h2>
      <div class="space-y-1.5">
        {#each transactions as tx}
          <div class="flex items-center justify-between text-sm py-1.5 px-2 rounded-lg hover:bg-[var(--dash-bg)]">
            <div>
              <span class="text-[var(--dash-text-secondary)]">{formatOp(tx.operation)}</span>
              {#if tx.description}
                <span class="text-[var(--dash-text-muted)] text-xs ml-1">— {tx.description}</span>
              {/if}
            </div>
            <div class="flex items-center gap-3">
              <span class="font-medium {tx.amount > 0 ? 'text-green-600' : 'text-[var(--dash-text)]'}">
                {tx.amount > 0 ? "+" : ""}{tx.amount}
              </span>
              <span class="text-xs text-[var(--dash-text-muted)] w-24 text-right">{formatDate(tx.created_at)}</span>
            </div>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>
