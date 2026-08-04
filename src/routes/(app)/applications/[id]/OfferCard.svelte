<script lang="ts">
  /**
   * The offer terms the summariser pulled out of this application's activity
   * entries, on the overview page.
   *
   * These have existed in `applications.offer_terms` since the comparison spine
   * shipped, read only by the assistant's prompt — so `respond_by`, a hard
   * deadline sitting in the database, could only be reached by asking the chat.
   * This card is that data addressed to the person it belongs to.
   *
   * Everything here was read out of free text by a model, so the card says
   * where it came from and links to the entries: a figure printed on the
   * overview page reads as the app asserting it, which is a stronger claim than
   * the same figure in a chat bubble, and someone will act on it without going
   * back to the transcript.
   */
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faFileSignature,
    faTriangleExclamation,
    faWandMagicSparkles,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../components/Card.svelte";
  import {
    deadlineState,
    formatOfferAmount,
    type OfferTerms,
  } from "$lib/application-offer";
  import { formatDate } from "$lib/format-date";
  import { timeAgo } from "$lib/format";

  let { offer, activityHref, extractedAt }: {
    offer: OfferTerms;
    activityHref: string;
    extractedAt: Date | string | null;
  } = $props();

  let amount = $derived(formatOfferAmount(offer));
  let deadline = $derived(deadlineState(offer.respond_by));

  /** Only the terms that were actually stated — no "not specified" rows. */
  let terms = $derived(
    [
      { label: "Bonus", value: offer.bonus },
      { label: "Equity", value: offer.equity },
      {
        label: "Starts",
        value: offer.start_date
          ? formatDate(offer.start_date, { fallback: "" })
          : null,
      },
    ].filter((t) => !!t.value),
  );

  const deadlineTone: Record<string, string> = {
    passed:
      "bg-[var(--dash-error-light)] text-[var(--dash-error)] border-[var(--dash-error)]",
    urgent:
      "bg-[var(--dash-error-light)] text-[var(--dash-error)] border-[var(--dash-error)]",
    soon:
      "bg-[var(--dash-warning-light)] text-[var(--dash-warning)] border-[var(--dash-warning)]",
    normal:
      "bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] border-[var(--dash-border)]",
  };
</script>

<Card padding="lg">
  <div class="space-y-4">
    <div class="flex items-center gap-2">
      <FontAwesomeIcon
        icon={faFileSignature}
        class="w-4 h-4 text-[var(--dash-text-secondary)]"
      />
      <h2
        class="text-sm font-semibold text-[var(--dash-text)] uppercase tracking-wide"
      >
        Offer
      </h2>
    </div>

    {#if amount}
      <p class="text-2xl font-bold text-[var(--dash-text)]">{amount}</p>
    {/if}

    {#if deadline && offer.respond_by}
      <div
        class="flex flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 rounded-lg border text-sm font-medium {deadlineTone[deadline.tone]}"
      >
        {#if deadline.tone !== "normal"}
          <FontAwesomeIcon
            icon={faTriangleExclamation}
            class="w-3.5 h-3.5 flex-shrink-0"
          />
        {/if}
        <span>
          {deadline.tone === "passed" ? "Was due" : "Respond by"}
          {formatDate(offer.respond_by, { fallback: offer.respond_by })}
        </span>
        <span class="opacity-80">&middot; {deadline.label}</span>
      </div>
    {/if}

    {#if terms.length > 0}
      <dl class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {#each terms as term (term.label)}
          <dt class="text-[var(--dash-text-muted)]">{term.label}</dt>
          <dd class="text-[var(--dash-text)]">{term.value}</dd>
        {/each}
      </dl>
    {/if}

    {#if offer.notes}
      <p
        class="text-sm text-[var(--dash-text-secondary)] whitespace-pre-wrap leading-relaxed"
      >
        {offer.notes}
      </p>
    {/if}

    <p
      class="flex flex-wrap items-center gap-1.5 text-xs text-[var(--dash-text-muted)] pt-1"
    >
      <FontAwesomeIcon icon={faWandMagicSparkles} class="w-3 h-3" />
      <span>
        Read from your
        <a
          href={activityHref}
          class="underline hover:text-[var(--dash-primary)] transition-colors"
        >activity entries</a>{#if extractedAt}<span
          >, {timeAgo(extractedAt)}</span
        >{/if}
      </span>
    </p>
  </div>
</Card>
