<script lang="ts">
  import { page } from "$app/stores";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCreditCard,
    faArrowUp,
    faArrowDown,
    faCheck,
    faCompass,
    faBinoculars,
    faCrosshairs,
    faBuilding,
    faBolt,
  } from "@fortawesome/free-solid-svg-icons";
  import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";

  const planIcons: Record<string, { icon: IconDefinition; color: string; bg: string }> = {
    explorer: { icon: faCompass, color: "text-green-500", bg: "bg-green-500/10" },
    seeker: { icon: faBinoculars, color: "text-blue-500", bg: "bg-blue-500/10" },
    hunter: { icon: faCrosshairs, color: "text-amber-500", bg: "bg-amber-500/10" },
    contractor: { icon: faBuilding, color: "text-purple-500", bg: "bg-purple-500/10" },
  };

  let { data } = $props();
  let { subscription, plans, creditBalance, creditPacks } = $derived(data);
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
        body: JSON.stringify({ priceId }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch {
      // Silently fail — user can retry
    } finally {
      loading = "";
    }
  }

  async function handleCreditCheckout(priceId: string) {
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

  $effect(() => {
    if (successMsg) {
      const timer = setTimeout(() => (successMsg = ""), 5000);
      return () => clearTimeout(timer);
    }
  });
</script>

<div class="space-y-6">
  <h1 class="text-xl font-semibold text-[var(--dash-text)]">Plan & Usage</h1>

  {#if successMsg}
    <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
      <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
      {successMsg === "subscription" ? "Subscription activated!" : "Usage topped up!"}
    </div>
  {/if}

  <!-- Current Plan & Usage -->
  <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-5">
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-3">
        <div class="w-9 h-9 rounded-lg flex items-center justify-center {planIcons[subscription.plan]?.color || 'text-[var(--dash-text)]'} {planIcons[subscription.plan]?.bg || 'bg-[var(--dash-bg)]'}">
          <FontAwesomeIcon icon={planIcons[subscription.plan]?.icon || faCompass} class="w-4.5 h-4.5" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-base font-semibold {planIcons[subscription.plan]?.color || 'text-[var(--dash-text)]'} capitalize">{subscription.plan}</h2>
            {#if subscription.status === "past_due"}
              <span class="px-2 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded-full">
                Payment issue
              </span>
            {/if}
            {#if subscription.cancelAtPeriodEnd}
              <span class="px-2 py-0.5 bg-amber-100 text-amber-600 text-xs font-medium rounded-full">
                Canceling at period end
              </span>
            {/if}
          </div>
          <p class="text-xs text-[var(--dash-text-secondary)] mt-0.5">Current Plan</p>
        </div>
      </div>
      {#if subscription.plan !== "explorer"}
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

    {#if creditBalance}
      {@const total = creditBalance.allowance + creditBalance.extra}
      {@const usedPct = total > 0 ? Math.min(100, Math.round((creditBalance.used / total) * 100)) : 0}
      {@const daysLeft = creditBalance.periodEnd ? Math.max(0, Math.ceil((new Date(creditBalance.periodEnd).getTime() - Date.now()) / 86400000)) : null}
      <div class="mt-4 pt-4 border-t border-[var(--dash-border)]">
        <div class="flex items-center justify-between mb-2">
          <p class="text-sm text-[var(--dash-text)]">
            <span class="font-semibold">{usedPct}%</span>
            <span class="text-[var(--dash-text-secondary)]"> used</span>
          </p>
          {#if creditBalance.periodEnd}
            <span class="text-xs text-[var(--dash-text-secondary)]">
              Resets {new Date(creditBalance.periodEnd).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
              {#if daysLeft != null}
                · {daysLeft} {daysLeft === 1 ? 'day' : 'days'} left
              {/if}
            </span>
          {/if}
        </div>
        <div class="h-2.5 bg-[var(--dash-bg)] rounded-full overflow-hidden">
          <div
            class="{getUsageColor(usedPct)} h-full rounded-full transition-all"
            style="width: {usedPct}%"
          ></div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Top Up Usage -->
  {#if creditPacks.some((p) => p.stripePriceId)}
    <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-5">
      <h2 class="text-base font-semibold text-[var(--dash-text)] mb-1">Top Up Usage</h2>
      <p class="text-xs text-[var(--dash-text-muted)] mb-4">Running low? Add more usage instantly.</p>

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
                onclick={() => handleCreditCheckout(pack.stripePriceId)}
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

  <!-- Plan Comparison -->
  <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-5">
    <h2 class="text-base font-semibold text-[var(--dash-text)] mb-4">Plans</h2>

    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {#each plans as plan}
        {@const isCurrent = plan.id === subscription.plan}
        {@const isUpgrade = plans.indexOf(plan) > plans.findIndex((p) => p.id === subscription.plan)}

        <div class="border rounded-xl p-4 {isCurrent ? 'border-[var(--dash-primary)] ring-2 ring-[var(--dash-primary)]/20' : 'border-[var(--dash-border)]'}">
          <div class="mb-3">
            <div class="flex items-center gap-2 {planIcons[plan.id].color}">
              <FontAwesomeIcon icon={planIcons[plan.id].icon} class="w-4 h-4" />
              <h3 class="text-sm font-semibold">{plan.name}</h3>
            </div>
            <p class="text-xs text-[var(--dash-text-secondary)] mt-0.5">{plan.description}</p>
          </div>

          <div class="mb-4">
            {#if plan.priceMonthly === 0}
              <span class="text-2xl font-bold text-[var(--dash-text)]">Free</span>
            {:else}
              <span class="text-2xl font-bold text-[var(--dash-text)]">{formatPrice(plan.priceMonthly)}</span>
              <span class="text-xs text-[var(--dash-text-secondary)]">/month</span>
            {/if}
          </div>

          <div class="space-y-2.5 mb-4 text-xs">
            <div class="text-[var(--dash-text)]">
              <span class="font-semibold">{plan.limits.profiles === -1 ? "Unlimited" : plan.limits.profiles}</span> profile{plan.limits.profiles === 1 ? "" : "s"}
            </div>
            <div>
              <div class="text-[var(--dash-text)]">
                <span class="font-semibold">{plan.limits.creditsPerMonth.toLocaleString()}</span> usage/mo
              </div>
              <ul class="mt-1 ml-3 space-y-0.5 text-[var(--dash-text-secondary)] list-disc">
                {#each plan.usageExample as example}
                  <li>{example}</li>
                {/each}
              </ul>
            </div>
          </div>

          {#if isCurrent}
            <div class="w-full px-3 py-1.5 text-sm text-center text-[var(--dash-primary)] font-medium bg-[var(--dash-primary)]/10 rounded-lg">
              Current Plan
            </div>
          {:else if plan.id === "explorer"}
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
