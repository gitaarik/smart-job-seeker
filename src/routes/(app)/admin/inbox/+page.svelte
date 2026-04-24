<script lang="ts">
  import type { PageData } from "./$types";
  import { enhance } from "$app/forms";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faEnvelope,
    faTrash,
    faChevronDown,
    faChevronUp,
    faLink,
    faKey,
  } from "@fortawesome/free-solid-svg-icons";
  import Card from "../../components/Card.svelte";
  import ConfirmModal from "../../profile/components/ConfirmModal.svelte";

  let { data }: { data: PageData } = $props();

  let emails = $derived((data as any).emails);
  let counts = $derived((data as any).counts);
  let page = $derived((data as any).page);
  let totalPages = $derived((data as any).totalPages);
  let total = $derived((data as any).total);
  let statusFilter = $derived((data as any).statusFilter);
  let handlerFilter = $derived((data as any).handlerFilter);

  let expandedId = $state<number | null>(null);
  let deleteId = $state<number | null>(null);
  let showHtml = $state(false);

  let statusTabs = $derived([
    { value: "", label: "All", count: counts.all },
    { value: "received", label: "Received", count: counts.received },
    { value: "matched", label: "Matched", count: counts.matched },
    { value: "applied", label: "Applied", count: counts.applied },
    { value: "dropped", label: "Dropped", count: counts.dropped },
  ]);

  const statusColors: Record<string, string> = {
    received: "bg-yellow-100 text-yellow-700",
    matched: "bg-blue-100 text-blue-700",
    applied: "bg-green-100 text-green-700",
    dropped: "bg-gray-100 text-gray-600",
  };

  const handlerLabels: Record<string, string> = {
    "verification-relay": "Verification",
    "noreply": "Noreply",
    "unhandled": "Unhandled",
  };

  function formatDate(date: string | Date | null): string {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function filterUrl(params: Record<string, string>): string {
    const parts = [];
    for (const [k, v] of Object.entries(params)) {
      if (v) parts.push(`${k}=${v}`);
    }
    return `/admin/inbox${parts.length ? "?" + parts.join("&") : ""}`;
  }

  function toggleExpand(id: number) {
    if (expandedId === id) {
      expandedId = null;
      showHtml = false;
    } else {
      expandedId = id;
      showHtml = false;
    }
  }
</script>

<div class="space-y-6">
  <div class="flex items-center gap-2">
    <FontAwesomeIcon icon={faEnvelope} class="w-5 h-5 text-[var(--dash-primary)]" />
    <h1 class="text-lg font-semibold text-[var(--dash-text)]">Inbound Email</h1>
    <span class="text-sm text-[var(--dash-text-muted)]">({total})</span>
  </div>

  <!-- Status filter tabs -->
  <div class="flex flex-wrap gap-2">
    {#each statusTabs as tab}
      <a
        href={filterUrl({ status: tab.value, handler: handlerFilter })}
        class="px-3 py-1.5 text-sm rounded-lg border transition-colors {statusFilter === tab.value
          ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] font-medium'
          : 'border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)]'}"
      >
        {tab.label}
        <span class="ml-1 text-xs opacity-70">{tab.count}</span>
      </a>
    {/each}
  </div>

  <!-- Handler filter -->
  <div class="flex flex-wrap gap-1.5">
    <a
      href={filterUrl({ status: statusFilter, handler: "" })}
      class="px-2 py-0.5 text-xs rounded-full border transition-colors {!handlerFilter
        ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
        : 'border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:border-[var(--dash-text-muted)]'}"
    >All handlers</a>
    {#each Object.entries(handlerLabels) as [value, label]}
      <a
        href={filterUrl({ status: statusFilter, handler: value })}
        class="px-2 py-0.5 text-xs rounded-full border transition-colors {handlerFilter === value
          ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)]'
          : 'border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:border-[var(--dash-text-muted)]'}"
      >{label}</a>
    {/each}
  </div>

  <!-- Email list -->
  {#if emails.length === 0}
    <Card padding="lg">
      <p class="text-sm text-[var(--dash-text-muted)] text-center py-8">No emails yet.</p>
    </Card>
  {:else}
    <div class="space-y-2">
      {#each emails as email (email.id)}
        <Card padding="sm">
          <div class="space-y-2">
            <!-- Header row (clickable to expand) -->
            <button
              type="button"
              onclick={() => toggleExpand(email.id)}
              class="w-full flex items-start gap-3 text-left"
            >
              <div class="flex-1 min-w-0">
                <div class="flex items-center flex-wrap gap-1.5">
                  <span class="text-xs px-1.5 py-0.5 rounded {statusColors[email.status] || statusColors.received}">
                    {email.status}
                  </span>
                  <span class="text-xs px-1.5 py-0.5 rounded bg-[var(--dash-bg)] text-[var(--dash-text-secondary)] border border-[var(--dash-border)]">
                    {handlerLabels[email.handler] || email.handler || "unknown"}
                  </span>
                  {#if email.extracted_code}
                    <span class="text-xs flex items-center gap-1 text-green-600">
                      <FontAwesomeIcon icon={faKey} class="w-2.5 h-2.5" />
                      code
                    </span>
                  {/if}
                  {#if email.extracted_link}
                    <span class="text-xs flex items-center gap-1 text-blue-600">
                      <FontAwesomeIcon icon={faLink} class="w-2.5 h-2.5" />
                      link
                    </span>
                  {/if}
                  {#if email.run_id}
                    <span class="text-xs text-[var(--dash-text-muted)]">run #{email.run_id}</span>
                  {/if}
                </div>
                <p class="text-sm font-medium text-[var(--dash-text)] mt-1 truncate">
                  {email.subject || "(no subject)"}
                </p>
                <div class="flex items-center gap-3 text-xs text-[var(--dash-text-muted)] mt-0.5">
                  <span>{email.from_address}</span>
                  <span>→ {email.recipient}</span>
                  <span>{formatDate(email.received_at)}</span>
                </div>
              </div>
              <FontAwesomeIcon
                icon={expandedId === email.id ? faChevronUp : faChevronDown}
                class="w-3.5 h-3.5 text-[var(--dash-text-muted)] mt-1 flex-shrink-0"
              />
            </button>

            <!-- Expanded details -->
            {#if expandedId === email.id}
              <div class="border-t border-[var(--dash-border)] pt-2 space-y-3">
                <!-- Extracted data -->
                {#if email.extracted_code || email.extracted_link}
                  <div class="bg-[var(--dash-bg)] rounded p-2 space-y-1">
                    {#if email.extracted_code}
                      <div class="flex items-center gap-2 text-xs">
                        <span class="font-medium text-[var(--dash-text-secondary)]">Code:</span>
                        <code class="px-1.5 py-0.5 bg-green-50 text-green-700 rounded font-mono">{email.extracted_code}</code>
                      </div>
                    {/if}
                    {#if email.extracted_link}
                      <div class="flex items-start gap-2 text-xs">
                        <span class="font-medium text-[var(--dash-text-secondary)] flex-shrink-0">Link:</span>
                        <a href={email.extracted_link} target="_blank" class="text-[var(--dash-primary)] hover:underline break-all">
                          {email.extracted_link.length > 80 ? email.extracted_link.slice(0, 80) + "..." : email.extracted_link}
                        </a>
                      </div>
                    {/if}
                    {#if email.applied_at}
                      <div class="text-xs text-green-600">Applied {formatDate(email.applied_at)}</div>
                    {/if}
                  </div>
                {/if}

                <!-- Body toggle and content -->
                <div class="space-y-1">
                  <div class="flex gap-2">
                    <button
                      type="button"
                      onclick={() => (showHtml = false)}
                      class="text-xs px-2 py-0.5 rounded transition-colors {!showHtml
                        ? 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] font-medium'
                        : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)]'}"
                    >Text</button>
                    <button
                      type="button"
                      onclick={() => (showHtml = true)}
                      class="text-xs px-2 py-0.5 rounded transition-colors {showHtml
                        ? 'bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] font-medium'
                        : 'text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)]'}"
                    >HTML</button>
                  </div>
                  {#if showHtml}
                    <!-- Rendered HTML in sandboxed iframe -->
                    {#if email.body_html}
                      <iframe
                        srcdoc={email.body_html}
                        sandbox=""
                        class="w-full h-64 border border-[var(--dash-border)] rounded bg-white"
                        title="Email HTML body"
                      ></iframe>
                    {:else}
                      <p class="text-xs text-[var(--dash-text-muted)] italic">No HTML body</p>
                    {/if}
                  {:else}
                    <pre class="text-xs text-[var(--dash-text-secondary)] whitespace-pre-wrap bg-[var(--dash-bg)] rounded p-2 max-h-64 overflow-auto">{email.body_text || "(no text body)"}</pre>
                  {/if}
                </div>

                <!-- Actions -->
                <div class="flex items-center gap-2 pt-1 border-t border-[var(--dash-border)]">
                  <button
                    type="button"
                    onclick={() => (deleteId = email.id)}
                    class="text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-error)] transition-colors flex items-center gap-1"
                  >
                    <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                    Delete
                  </button>
                </div>
              </div>
            {/if}
          </div>
        </Card>
      {/each}
    </div>

    <!-- Pagination -->
    {#if totalPages > 1}
      <div class="flex items-center justify-center gap-2 pt-2">
        {#if page > 1}
          <a
            href={filterUrl({ status: statusFilter, handler: handlerFilter, page: String(page - 1) })}
            class="px-3 py-1.5 text-sm rounded-lg border border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)] transition-colors"
          >Previous</a>
        {/if}
        <span class="text-sm text-[var(--dash-text-muted)]">
          Page {page} of {totalPages}
        </span>
        {#if page < totalPages}
          <a
            href={filterUrl({ status: statusFilter, handler: handlerFilter, page: String(page + 1) })}
            class="px-3 py-1.5 text-sm rounded-lg border border-[var(--dash-border)] text-[var(--dash-text-secondary)] hover:border-[var(--dash-text-muted)] transition-colors"
          >Next</a>
        {/if}
      </div>
    {/if}
  {/if}
</div>

<!-- Delete Confirmation -->
<ConfirmModal
  isOpen={deleteId !== null}
  title="Delete Email"
  message="Delete this email record? This cannot be undone."
  onCancel={() => (deleteId = null)}
  onConfirm={() => {
    if (deleteId !== null) {
      const form = document.createElement("form");
      form.method = "POST";
      form.action = "?/delete";
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = "id";
      input.value = String(deleteId);
      form.appendChild(input);
      document.body.appendChild(form);
      form.submit();
    }
  }}
/>
