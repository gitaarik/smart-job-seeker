<script lang="ts">
  import { page } from "$app/stores";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import {
    faCommentDots,
    faMinus,
    faPaperclip,
    faPaperPlane,
    faCheck,
    faTrash,
  } from "@fortawesome/free-solid-svg-icons";
  import { feedbackState } from "./feedback-state.svelte";

  let isOpen = $derived(feedbackState.open);
  let isMinimized = $derived(feedbackState.minimized);
  let message = $state("");
  let category = $state("other");
  let files = $state<File[]>([]);
  let submitting = $state(false);
  let submitted = $state(false);
  let errorMsg = $state("");

  let hasDraft = $derived(message.trim().length > 0 || files.length > 0);

  const categories = [
    { value: "bug", label: "Bug" },
    { value: "feature", label: "Feature" },
    { value: "ui", label: "UI / Design" },
    { value: "question", label: "Question" },
    { value: "other", label: "Other" },
  ];

  function reset() {
    message = "";
    category = "other";
    files = [];
    errorMsg = "";
  }

  function minimize() {
    feedbackState.open = false;
    feedbackState.minimized = true;
  }

  function restore() {
    feedbackState.minimized = false;
    feedbackState.open = true;
  }

  function close() {
    feedbackState.open = false;
    feedbackState.minimized = false;
    if (submitted) {
      submitted = false;
    }
    reset();
  }

  function removeFile(index: number) {
    files = files.filter((_, i) => i !== index);
  }

  async function submit() {
    if (!message.trim()) {
      errorMsg = "Please enter a message.";
      return;
    }
    errorMsg = "";
    submitting = true;

    const formData = new FormData();
    formData.set("message", message.trim());
    formData.set("category", category);
    formData.set("page_url", $page.url.pathname + $page.url.search);
    const profileId = ($page.data as any).selectedProfile?.id;
    if (profileId) formData.set("profile_id", String(profileId));
    for (const file of files) {
      formData.append("files", file);
    }

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        errorMsg = data?.message || "Something went wrong.";
        return;
      }
      submitted = true;
    } catch {
      errorMsg = "Failed to send. Please try again.";
    } finally {
      submitting = false;
    }
  }
</script>

<!-- Minimized pill — shows when there's a draft -->
{#if isMinimized && hasDraft}
  <button
    type="button"
    onclick={restore}
    class="fixed z-40 bottom-6 right-6 max-lg:bottom-4 max-lg:right-4 flex items-center gap-2 px-3 py-2 bg-[var(--dash-primary)] text-white rounded-full shadow-lg hover:bg-[var(--dash-primary-hover)] transition-all hover:scale-105"
    aria-label="Restore feedback draft"
  >
    <FontAwesomeIcon icon={faCommentDots} class="w-4 h-4" />
    <span class="text-xs font-medium">Draft saved</span>
  </button>
{/if}

<!-- Feedback panel -->
{#if isOpen}
  <!-- Backdrop -->
  <button
    type="button"
    class="fixed inset-0 z-30 bg-black/40"
    onclick={minimize}
    aria-label="Minimize feedback"
  ></button>

  <div class="fixed z-40 bottom-6 right-6 w-96 max-lg:inset-x-4 max-lg:top-1/2 max-lg:-translate-y-1/2 max-lg:bottom-auto max-lg:w-auto bg-[var(--dash-card)] rounded-xl shadow-[0_0_30px_rgba(0,0,0,0.3)] ring-[3px] ring-[var(--dash-primary)]/60">
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-[var(--dash-border)]">
      <h3 class="text-sm font-semibold text-[var(--dash-text)]">Send Feedback</h3>
      <button
        type="button"
        onclick={minimize}
        class="p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-text)] transition-colors"
        aria-label="Minimize"
      >
        <FontAwesomeIcon icon={faMinus} class="w-4 h-4" />
      </button>
    </div>

    <div class="p-4">
      {#if submitted}
        <!-- Success state -->
        <div class="text-center py-6">
          <div class="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-3">
            <FontAwesomeIcon icon={faCheck} class="w-6 h-6" />
          </div>
          <p class="text-sm font-medium text-[var(--dash-text)]">Thanks for your feedback!</p>
          <p class="text-xs text-[var(--dash-text-muted)] mt-1">We'll look into it.</p>
          <div class="flex items-center justify-center gap-3 mt-4">
            <a
              href="/feedback"
              onclick={close}
              class="px-4 py-1.5 text-sm text-[var(--dash-primary)] hover:bg-[var(--dash-primary)]/10 rounded-lg transition-colors"
            >
              View your feedback
            </a>
            <button
              type="button"
              onclick={close}
              class="px-4 py-1.5 text-sm text-[var(--dash-text-muted)] hover:bg-[var(--dash-bg)] rounded-lg transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      {:else}
        <!-- Category selector -->
        <div class="flex flex-wrap gap-1.5 mb-3">
          {#each categories as cat}
            <button
              type="button"
              onclick={() => (category = cat.value)}
              class="px-2.5 py-1 text-xs rounded-full border transition-colors {category === cat.value
                ? 'border-[var(--dash-primary)] bg-[var(--dash-primary)]/10 text-[var(--dash-primary)] font-medium'
                : 'border-[var(--dash-border)] text-[var(--dash-text-muted)] hover:border-[var(--dash-text-muted)]'}"
            >
              {cat.label}
            </button>
          {/each}
        </div>

        <!-- Message -->
        <textarea
          bind:value={message}
          placeholder="What's on your mind?"
          rows="4"
          class="w-full px-3 py-2 border border-[var(--dash-border)] rounded-lg text-sm text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] bg-transparent focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent resize-none"
        ></textarea>

        <!-- Attached files -->
        {#if files.length > 0}
          <div class="mt-2 space-y-1">
            {#each files as file, i}
              <div class="flex items-center justify-between text-xs text-[var(--dash-text-secondary)] bg-[var(--dash-bg)] rounded px-2 py-1">
                <span class="truncate mr-2">{file.name}</span>
                <button type="button" onclick={() => removeFile(i)} class="text-[var(--dash-text-muted)] hover:text-[var(--dash-error)] flex-shrink-0">
                  <FontAwesomeIcon icon={faTrash} class="w-3 h-3" />
                </button>
              </div>
            {/each}
          </div>
        {/if}

        {#if errorMsg}
          <p class="text-xs text-[var(--dash-error)] mt-2">{errorMsg}</p>
        {/if}

        <!-- Actions -->
        <div class="flex items-center justify-between mt-3">
          <label class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-text-secondary)] cursor-pointer transition-colors">
            <FontAwesomeIcon icon={faPaperclip} class="w-3.5 h-3.5" />
            Attach
            <input
              type="file"
              multiple
              accept="image/*,video/*,.pdf"
              class="hidden"
              onchange={(e) => {
                const input = e.currentTarget as HTMLInputElement;
                if (input.files) {
                  files = [...files, ...Array.from(input.files)].slice(0, 5);
                  input.value = "";
                }
              }}
            />
          </label>
          <button
            type="button"
            onclick={submit}
            disabled={submitting || !message.trim()}
            class="flex items-center gap-2 px-4 py-1.5 text-sm bg-[var(--dash-primary)] text-white rounded-lg hover:bg-[var(--dash-primary-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {#if submitting}
              Sending...
            {:else}
              <FontAwesomeIcon icon={faPaperPlane} class="w-3.5 h-3.5" />
              Send
            {/if}
          </button>
        </div>
      {/if}
    </div>
  </div>
{/if}
