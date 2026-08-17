<script lang="ts">
	import AutoGrowTextarea from '$lib/components/AutoGrowTextarea.svelte';
	import { LOCALES, BASE_LOCALE } from '$lib/resume-translations';
	import { translations } from '$lib/stores/translations.svelte';

	interface Props {
		entity: string;
		id: number;
		field: string;
		label?: string;
		/** The English base value — owned by the parent form (bindable). */
		value: string;
		multiline?: boolean;
		/** Minimum visible rows; multiline fields grow past this as you type. */
		rows?: number;
		/** Cap the growth so a long value can't push the save button off-screen. */
		maxRows?: number;
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
		maxRows = 12,
		placeholder,
		hint,
		required = false,
		onkeydown
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
		'w-full px-3 py-2 border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent';

	const status = $derived(canTranslate ? translations.statusFor(entity, id, field) : 'idle');

	function editTranslation(v: string) {
		translations.edit(entity, id, field, v);
	}
	function flush() {
		translations.flush(entity, id, field);
	}

	let aiBusy = $state(false);
	async function aiTranslate() {
		if (aiBusy) return;
		// Don't silently clobber an existing translation — confirm first.
		if (
			translations.get(entity, id, field).trim() &&
			!confirm('Replace the current translation with a new AI translation?')
		) {
			return;
		}
		aiBusy = true;
		try {
			const res = await fetch('/api/translations/auto', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ entity, id, field, locale: active })
			});
			if (res.ok) {
				const data = await res.json();
				const v = data.translations?.[0]?.value;
				if (typeof v === 'string') translations.setLocal(entity, id, field, v);
			}
		} catch {
			// best-effort; the field just stays as-is
		} finally {
			aiBusy = false;
		}
	}
</script>

<div>
	<div class="mb-1 flex items-center justify-between gap-2">
		{#if label}
			<span class="block text-sm font-medium text-[var(--dash-text)]">
				{label}{#if required}<span class="text-[var(--dash-error)]">*</span>{/if}
			</span>
		{/if}
		{#if canTranslate}
			<div
				class="inline-flex shrink-0 overflow-hidden rounded-md border border-[var(--dash-border)]"
				role="tablist"
			>
				{#each LOCALES as loc (loc.code)}
					<button
						type="button"
						role="tab"
						aria-selected={active === loc.code}
						title={loc.label}
						onclick={() => translations.setActive(loc.code)}
						class="px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase transition-colors
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
			<AutoGrowTextarea
				minRows={rows}
				{maxRows}
				{required}
				{placeholder}
				{onkeydown}
				lang={BASE_LOCALE}
				bind:value
				class={inputClass}
			/>
		{:else}
			<input
				type="text"
				{required}
				{placeholder}
				{onkeydown}
				lang={BASE_LOCALE}
				bind:value
				class={inputClass}
			/>
		{/if}
	{:else}
		<!-- English source, shown while translating so you don't have to look it up. -->
		{#if value}
			<p
				class="mb-1.5 rounded border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2 py-1.5 text-xs whitespace-pre-wrap text-[var(--dash-text-muted)]"
			>
				{value}
			</p>
		{/if}
		{#if multiline}
			<AutoGrowTextarea
				minRows={rows}
				{maxRows}
				placeholder="Translation…"
				lang={active}
				value={translations.get(entity, id, field)}
				oninput={(e) => editTranslation(e.currentTarget.value)}
				onblur={flush}
				class={inputClass}
			/>
		{:else}
			<input
				type="text"
				placeholder="Translation…"
				lang={active}
				value={translations.get(entity, id, field)}
				oninput={(e) => editTranslation(e.currentTarget.value)}
				onblur={flush}
				class={inputClass}
			/>
		{/if}
	{/if}

	<div class="mt-1 flex items-center justify-between gap-2">
		<div class="flex min-w-0 items-center gap-2">
			{#if !onBase && canTranslate}
				<button
					type="button"
					onclick={aiTranslate}
					disabled={aiBusy}
					class="shrink-0 text-xs text-[var(--dash-primary)] hover:underline disabled:no-underline disabled:opacity-50"
				>
					{aiBusy ? 'Translating…' : '✨ Auto-translate'}
				</button>
			{/if}
			{#if hint}
				<p class="truncate text-xs text-[var(--dash-text-muted)]">{hint}</p>
			{/if}
		</div>
		{#if !onBase && canTranslate}
			<span
				class="shrink-0 text-xs {status === 'error'
					? 'text-[var(--dash-error)]'
					: 'text-[var(--dash-text-muted)]'}"
			>
				{status === 'saving'
					? 'Saving…'
					: status === 'saved'
						? 'Saved'
						: status === 'error'
							? 'Save failed'
							: ''}
			</span>
		{/if}
	</div>
</div>
