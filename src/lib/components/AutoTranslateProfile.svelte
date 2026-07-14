<script lang="ts">
  import { BASE_LOCALE, LOCALES } from "$lib/resume-translations";
  import { translations } from "$lib/stores/translations.svelte";

  const targets = LOCALES.filter((l) => l.code !== BASE_LOCALE);

  let locale = $state(targets[0]?.code ?? "nl");
  let overwrite = $state(false);
  let busy = $state(false);
  let message = $state("");

  async function run() {
    if (busy) return;
    busy = true;
    message = "";
    try {
      const res = await fetch("/api/translations/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale, overwrite }),
      });
      if (res.ok) {
        const data = await res.json();
        await translations.reload();
        translations.setActive(locale);
        message = data.count > 0
          ? `Translated ${data.count} field${data.count === 1 ? "" : "s"}. Switch a field's tab to review.`
          : "Nothing to translate — everything is already done.";
      } else {
        message = "Translation failed — check the AI provider is configured.";
      }
    } catch {
      message = "Translation failed.";
    } finally {
      busy = false;
    }
  }
</script>

<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4">
  <h3 class="text-sm font-semibold text-[var(--dash-text)] flex items-center gap-1.5">
    ✨ AI translation
  </h3>
  <p class="text-xs text-[var(--dash-text-muted)] mt-1 mb-3">
    Auto-translate every text field into another language. Fills the inline
    language tabs across your profile; existing translations are kept unless you
    overwrite them.
  </p>
  <div class="flex flex-wrap items-center gap-2">
    <select
      bind:value={locale}
      disabled={busy}
      class="px-2 py-1.5 text-sm border border-[var(--dash-border)] rounded-md bg-[var(--dash-bg)] text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)]"
    >
      {#each targets as l (l.code)}
        <option value={l.code}>{l.nativeLabel}</option>
      {/each}
    </select>

    <label class="flex items-center gap-1.5 text-xs text-[var(--dash-text-muted)] select-none">
      <input type="checkbox" bind:checked={overwrite} disabled={busy} />
      Overwrite existing
    </label>

    <button
      type="button"
      onclick={run}
      disabled={busy}
      class="px-3 py-1.5 text-sm font-medium rounded-md bg-[var(--dash-primary)] text-white hover:bg-[var(--dash-primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {busy ? "Translating…" : "Translate profile"}
    </button>

    {#if message}
      <span class="text-xs text-[var(--dash-text-muted)]">{message}</span>
    {/if}
  </div>
</div>
