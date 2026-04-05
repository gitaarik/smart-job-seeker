<script lang="ts">
  import { page } from "$app/stores";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCreditCard,
    faFileInvoice,
    faArrowUp,
    faArrowDown,
    faCheck,
    faBolt,
    faExternalLinkAlt,
  } from "@fortawesome/free-solid-svg-icons";

  let { data } = $props();
  let { summary, plans, creditPacks } = $derived(data);
  let loading = $state("");
  let successMsg = $state($page.url.searchParams.get("success") || "");

  const featureLabels: Record<string, string> = {
    ai_generations: "AI Generations",
    ai_followups: "AI Follow-ups",
    job_matches: "Job Matches",
    scrape_runs: "Search Runs",
    pdf_exports: "PDF Exports",
    resume_parses: "Resume Imports",
  };

  function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(0)}`;
  }

  function getStatusColor(percentage: number): string {
    if (percentage >= 90) return "bg-red-500";
    if (percentage >= 75) return "bg-amber-500";
    return "bg-[var(--dash-primary)]";
  }

  async function handleCheckout(priceId: string, type: string = "subscription") {
    loading = priceId;
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, type: type === "credit" ? "credit" : undefined }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // Silently fail — user can retry
    } finally {
      loading = "";
    }
  }

  async function openPortal() {
    loading = "portal";
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // Silently fail
    } finally {
      loading = "";
    }
  }

  // Clear success message after a few seconds
  $effect(() => {
    if (successMsg) {
      const timer = setTimeout(() => (successMsg = ""), 5000);
      return () => clearTimeout(timer);
    }
  });
</script>

<div class="space-y-6">
  <h1 class="text-xl font-semibold text-[var(--dash-text)]">Billing & Subscription</h1>

  <!-- Success message -->
  {#if successMsg}
    <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
      <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
      {successMsg === "subscription" ? "Subscription activated!" : "Credits added!"}
    </div>
  {/if}

  <!-- Current Plan -->
  <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-5">
    <div class="flex items-center justify-between mb-4">
      <div>
        <h2 class="text-base font-semibold text-[var(--dash-text)]">Current Plan</h2>
        <div class="flex items-center gap-2 mt-1">
          <span class="px-2.5 py-0.5 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] text-sm font-medium rounded-full capitalize">
            {summary.plan}
          </span>
          {#if summary.status === "past_due"}
            <span class="px-2.5 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded-full">
              Payment issue
            </span>
          {/if}
          {#if summary.cancelAtPeriodEnd}
            <span class="px-2.5 py-0.5 bg-amber-100 text-amber-600 text-xs font-medium rounded-full">
              Canceling at period end
            </span>
          {/if}
        </div>
      </div>
      {#if summary.plan !== "free"}
        <button
          onclick={openPortal}
          disabled={loading === "portal"}
          class="flex items-center gap-2 px-3 py-1.5 text-sm border border-[var(--dash-border)] rounded-lg text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)] transition-colors disabled:opacity-50"
        >
          <FontAwesomeIcon icon={faCreditCard} class="w-3.5 h-3.5" />
          {loading === "portal" ? "Loading..." : "Manage Billing"}
        </button>
      {/if}
    </div>

    {#if summary.currentPeriodEnd}
      <p class="text-xs text-[var(--dash-text-muted)] mb-4">
        Current period ends {new Date(summary.currentPeriodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
      </p>
    {/if}

    <!-- Usage meters -->
    <div class="space-y-3">
      {#each summary.usage as item}
        {@const totalLimit = item.limit === -1 ? -1 : item.limit + item.extra}
        <div>
          <div class="flex items-center justify-between text-sm mb-1">
            <span class="text-[var(--dash-text-secondary)]">{featureLabels[item.feature] || item.feature}</span>
            <span class="text-[var(--dash-text)]">
              {#if item.limit === -1}
                {item.used} used <span class="text-[var(--dash-text-muted)]">(unlimited)</span>
              {:else}
                {item.used} / {totalLimit}
                {#if item.extra > 0}
                  <span class="text-[var(--dash-text-muted)]">(+{item.extra} extra)</span>
                {/if}
              {/if}
            </span>
          </div>
          {#if item.limit !== -1}
            <div class="h-2 bg-[var(--dash-bg)] rounded-full overflow-hidden">
              <div
                class="{getStatusColor(item.percentage)} h-full rounded-full transition-all"
                style="width: {Math.min(item.percentage, 100)}%"
              ></div>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </div>

  <!-- Extra Credits -->
  {#if summary.plan !== "free" && creditPacks.some((p) => p.stripePriceId)}
    <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-5">
      <h2 class="text-base font-semibold text-[var(--dash-text)] mb-1">Extra Credits</h2>
      <p class="text-xs text-[var(--dash-text-muted)] mb-4">Need more this month? Buy extra credits — they apply to the current billing period.</p>

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
                onclick={() => handleCheckout(pack.stripePriceId, "credit")}
                disabled={loading === pack.stripePriceId}
                class="w-full px-3 py-1.5 text-xs bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] rounded-lg hover:bg-[var(--dash-primary)]/20 transition-colors disabled:opacity-50 font-medium"
              >
                {loading === pack.stripePriceId ? "Loading..." : "Buy"}
              </button>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  {/if}

  <!-- Plan Comparison -->
  <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-5">
    <h2 class="text-base font-semibold text-[var(--dash-text)] mb-4">Plans</h2>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {#each plans as plan}
        {@const isCurrent = plan.id === summary.plan}
        {@const isUpgrade = plans.indexOf(plan) > plans.findIndex((p) => p.id === summary.plan)}
        {@const isDowngrade = plans.indexOf(plan) < plans.findIndex((p) => p.id === summary.plan)}

        <div class="border rounded-xl p-4 {isCurrent ? 'border-[var(--dash-primary)] ring-2 ring-[var(--dash-primary)]/20' : 'border-[var(--dash-border)]'}">
          <div class="mb-3">
            <h3 class="text-sm font-semibold text-[var(--dash-text)]">{plan.name}</h3>
            <p class="text-xs text-[var(--dash-text-muted)] mt-0.5">{plan.description}</p>
          </div>

          <div class="mb-4">
            {#if plan.priceMonthly === 0}
              <span class="text-2xl font-bold text-[var(--dash-text)]">Free</span>
            {:else}
              <span class="text-2xl font-bold text-[var(--dash-text)]">{formatPrice(plan.priceMonthly)}</span>
              <span class="text-xs text-[var(--dash-text-muted)]">/month</span>
            {/if}
          </div>

          <ul class="space-y-1.5 mb-4 text-xs text-[var(--dash-text-secondary)]">
            <li>{plan.limits.profiles} profile{plan.limits.profiles > 1 ? "s" : ""}</li>
            <li>{plan.limits.resumeVersions === -1 ? "Unlimited" : plan.limits.resumeVersions} resume versions</li>
            <li>{plan.limits.aiGenerations} AI generations/mo</li>
            <li>{plan.limits.aiFollowups} AI follow-ups/mo</li>
            <li>{plan.limits.jobMatches.toLocaleString()} job matches/mo</li>
            {#if plan.limits.scrapeRuns > 0}
              <li>{plan.limits.scrapeRuns} search runs/mo</li>
            {:else}
              <li class="text-[var(--dash-text-muted)]">No scraping</li>
            {/if}
            <li>{plan.limits.pdfExports === -1 ? "Unlimited" : plan.limits.pdfExports} PDF exports/mo</li>
          </ul>

          {#if isCurrent}
            <div class="w-full px-3 py-1.5 text-sm text-center text-[var(--dash-primary)] font-medium bg-[var(--dash-primary)]/10 rounded-lg">
              Current Plan
            </div>
          {:else if plan.id === "free"}
            <!-- Can't "buy" free — they cancel via portal -->
          {:else if plan.stripePriceId}
            <button
              onclick={() => handleCheckout(plan.stripePriceId!)}
              disabled={!!loading}
              class="w-full px-3 py-1.5 text-sm rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5
                {isUpgrade
                  ? 'bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)]'
                  : 'border border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:bg-[var(--dash-bg)]'}"
            >
              {#if isUpgrade}
                <FontAwesomeIcon icon={faArrowUp} class="w-3 h-3" />
                Upgrade
              {:else}
                <FontAwesomeIcon icon={faArrowDown} class="w-3 h-3" />
                Downgrade
              {/if}
            </button>
          {/if}
        </div>
      {/each}
    </div>
  </div>
</div>
