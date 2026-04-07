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
  } from "@fortawesome/free-solid-svg-icons";
  import type { IconDefinition } from "@fortawesome/free-solid-svg-icons";

  const planIcons: Record<string, { icon: IconDefinition; color: string }> = {
    explorer: { icon: faCompass, color: "text-green-500" },
    seeker: { icon: faBinoculars, color: "text-blue-500" },
    hunter: { icon: faCrosshairs, color: "text-amber-500" },
    agency: { icon: faBuilding, color: "text-purple-500" },
  };

  let { data } = $props();
  let { subscription, plans } = $derived(data);
  let loading = $state("");
  let successMsg = $state($page.url.searchParams.get("success") || "");

  function formatPrice(cents: number): string {
    return `$${(cents / 100).toFixed(0)}`;
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
  <h1 class="text-xl font-semibold text-[var(--dash-text)]">Plan</h1>

  {#if successMsg}
    <div class="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm flex items-center gap-2">
      <FontAwesomeIcon icon={faCheck} class="w-4 h-4" />
      {successMsg === "subscription" ? "Subscription activated!" : "Credits added!"}
    </div>
  {/if}

  <!-- Current Plan -->
  <div class="bg-[var(--dash-card)] border border-[var(--dash-border)] rounded-xl p-5">
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-base font-semibold text-[var(--dash-text)]">Current Plan</h2>
        <div class="flex items-center gap-2 mt-1">
          <span class="px-2.5 py-0.5 bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] text-sm font-medium rounded-full capitalize">
            {subscription.plan}
          </span>
          {#if subscription.status === "past_due"}
            <span class="px-2.5 py-0.5 bg-red-100 text-red-600 text-xs font-medium rounded-full">
              Payment issue
            </span>
          {/if}
          {#if subscription.cancelAtPeriodEnd}
            <span class="px-2.5 py-0.5 bg-amber-100 text-amber-600 text-xs font-medium rounded-full">
              Canceling at period end
            </span>
          {/if}
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
  </div>

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

          <div class="space-y-2.5 mb-4 text-xs">
            <div class="text-[var(--dash-text)]">
              <span class="font-semibold">{plan.limits.profiles === -1 ? "Unlimited" : plan.limits.profiles}</span> profile{plan.limits.profiles === 1 ? "" : "s"}
            </div>
            <div>
              <div class="text-[var(--dash-text)]">
                <span class="font-semibold">{plan.limits.creditsPerMonth.toLocaleString()}</span> credits/mo
              </div>
              <ul class="mt-1 ml-3 space-y-0.5 text-[var(--dash-text-muted)] list-disc">
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
