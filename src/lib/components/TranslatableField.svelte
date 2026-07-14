<script lang="ts">
  import { LOCALES, BASE_LOCALE } from "$lib/resume-translations";
  import { translations } from "$lib/stores/translations.svelte";

  interface Props {
    entity: string;
    id: number;
    field: string;
    label?: string;
    /** The English base value — owned by the parent form (bindable). */
    value: string;
    multiline?: boolean;
    rows?: number;
    placeholder?: string;
    /** Small helper text under the field. */
    hint?: string;
    required?: boolean;
    /** Passed through to the base (English) input, e.g. Enter/Escape handling. */
    onkeydown?: (e: KeyboardEvent) => void;
  }

  let {
    entity,
    id,
    field,
    label,
    value = $bindable(),
    multiline = false,
    rows = 3,
    placeholder,
    hint,
    required = false,
    onkeydown,
  }: Props = $props();

  // A translation needs a persisted row id; disable tabs until the entity is
  // saved (e.g. on a freshly-created record).
  const canTranslate = $derived(Number.isInteger(id) && id > 0);

  $effect(() => {
    if (canTranslate) void translations.ensureLoaded();
  });

  const active = $derived(translations.activeLocale);
  const onBase = $derived(active === BASE_LOCALE);

  const inputClass =
    "w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent";

  const status = $derived(
    canTranslate ? translations.statusFor(entity, id, field) : "idle",
  );

  function editTranslation(v: string) {
    translations.edit(entity, id, field, v);
  }
  function flush() {
    translations.flush(entity, id, field);
  }
</script>

<div>
  <div class="flex items-center justify-between gap-2 mb-1">
    {#if label}
      <span class="block text-sm font-medium text-[var(--dash-text)]">
        {label}{#if required}<span class="text-[var(--dash-error)]">*</span>{/if}
      </span>
    {/if}
    {#if canTranslate}
      <div
        class="inline-flex rounded-md border border-[var(--dash-border)] overflow-hidden shrink-0"
        role="tablist"
      >
        {#each LOCALES as loc (loc.code)}
          <button
            type="button"
            role="tab"
            aria-selected={active === loc.code}
            title={loc.label}
            onclick={() => translations.setActive(loc.code)}
            class="px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide transition-colors
              {active === loc.code
              ? 'bg-[var(--dash-primary)] text-white'
              : 'text-[var(--dash-text-muted)] hover:bg-[var(--dash-bg)]'}"
          >
            {loc.code}
          </button>
        {/each}
      </div>
    {/if}
  </div>

  {#if onBase || !canTranslate}
    {#if multiline}
      <textarea
        {rows}
        {required}
        {placeholder}
        {onkeydown}
        bind:value
        class="{inputClass} resize-y"
      ></textarea>
    {:else}
      <input
        type="text"
        {required}
        {placeholder}
        {onkeydown}
        bind:value
        class={inputClass}
      />
    {/if}
  {:else}
    <!-- English source, shown while translating so you don't have to look it up. -->
    {#if value}
      <p
        class="text-xs text-[var(--dash-text-muted)] mb-1.5 whitespace-pre-wrap bg-[var(--dash-bg)] rounded px-2 py-1.5 border border-[var(--dash-border)]"
      >
        {value}
      </p>
    {/if}
    {#if multiline}
      <textarea
        {rows}
        placeholder="Translation…"
        value={translations.get(entity, id, field)}
        oninput={(e) => editTranslation(e.currentTarget.value)}
        onblur={flush}
        class="{inputClass} resize-y"
      ></textarea>
    {:else}
      <input
        type="text"
        placeholder="Translation…"
        value={translations.get(entity, id, field)}
        oninput={(e) => editTranslation(e.currentTarget.value)}
        onblur={flush}
        class={inputClass}
      />
    {/if}
  {/if}

  <div class="flex items-center justify-between gap-2 mt-1">
    {#if hint}
      <p class="text-xs text-[var(--dash-text-muted)]">{hint}</p>
    {:else}
      <span></span>
    {/if}
    {#if !onBase && canTranslate}
      <span
        class="text-xs {status === 'error'
          ? 'text-[var(--dash-error)]'
          : 'text-[var(--dash-text-muted)]'}"
      >
        {status === "saving"
          ? "Saving…"
          : status === "saved"
            ? "Saved"
            : status === "error"
              ? "Save failed"
              : ""}
      </span>
    {/if}
  </div>
</div>
