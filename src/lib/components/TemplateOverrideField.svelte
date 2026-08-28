<script lang="ts">
	/**
	 * What one field says when a particular presentation template renders it.
	 *
	 * Sits under the field it overrides rather than in a template-settings page:
	 * the value only means anything next to the one it replaces, and "what does
	 * Citrus call this role" is a question you have while looking at the role.
	 *
	 * Empty means "use my own value" — saving an empty box deletes the row, so
	 * there is no third state to explain and no sentinel to store. The profile's
	 * own value is the placeholder, so an unset box already shows what will print.
	 */
	import { BASE_LOCALE } from '$lib/resume-translations';

	interface Props {
		entity: string;
		id: number;
		field: string;
		/** The profile's own value, shown as the placeholder. */
		base: string;
		/** The profile's presentation templates; nothing renders when there are none. */
		templates: { id: number; name: string }[];
		/** Existing overrides for this entity, any field. */
		overrides: { template_id: number; field: string; locale: string; value: string }[];
		label?: string;
		hint?: string;
	}

	let { entity, id, field, base, templates, overrides, label, hint }: Props = $props();

	type SaveState = 'idle' | 'saving' | 'saved' | 'error';

	// The editor writes the base language; other locales fall back to it at
	// render time (see server/profile/template-overrides.ts), so a second
	// language switcher here would be a control for a case that has not come up.
	function storedValues(): Record<number, string> {
		const byTemplate = new Map(
			overrides
				.filter((o) => o.field === field && o.locale === BASE_LOCALE)
				.map((o) => [o.template_id, o.value])
		);
		return Object.fromEntries(templates.map((t) => [t.id, byTemplate.get(t.id) ?? '']));
	}

	/** What the server holds, so an unchanged box does not PUT on every blur. */
	let saved = $state<Record<number, string>>(storedValues());
	let values = $state<Record<number, string>>({ ...saved });
	let status = $state<Record<number, SaveState>>({});

	// The role editor is one route, so moving from /work-experience/8 to /9 swaps
	// these props under a component that is never torn down — without this the
	// second role would be editing the first one's values.
	let loadedFor = id;
	$effect(() => {
		if (loadedFor === id) return;
		loadedFor = id;
		saved = storedValues();
		values = { ...saved };
		status = {};
	});

	const canOverride = $derived(Number.isInteger(id) && id > 0 && templates.length > 0);

	async function save(templateId: number) {
		const value = (values[templateId] ?? '').trim();
		if (value === (saved[templateId] ?? '')) return;

		status[templateId] = 'saving';
		try {
			const res = await fetch('/api/template-overrides', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ templateId, entity, id, field, locale: BASE_LOCALE, value })
			});
			if (!res.ok) throw new Error(String(res.status));
			// An emptied box deleted the row, so what the server holds is '' either
			// way — the next blur on an untouched box then stays silent.
			saved[templateId] = value;
			status[templateId] = 'saved';
		} catch {
			status[templateId] = 'error';
		}
	}
</script>

{#if canOverride}
	<div class="rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-3 py-2">
		<p class="text-xs font-medium text-[var(--dash-text-muted)]">
			{label ?? 'On a template'}
		</p>
		<div class="mt-1.5 space-y-1.5">
			{#each templates as template (template.id)}
				<div class="flex items-center gap-2">
					<span
						class="w-24 shrink-0 truncate text-xs text-[var(--dash-text-muted)]"
						title={template.name}
					>
						{template.name}
					</span>
					<input
						type="text"
						autocomplete="off"
						placeholder={base}
						aria-label="{label ?? 'Override'} on {template.name}"
						bind:value={values[template.id]}
						onblur={() => save(template.id)}
						class="min-w-0 flex-1 rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-2 py-1 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
					<span
						class="w-14 shrink-0 text-right text-xs {status[template.id] === 'error'
							? 'text-[var(--dash-error)]'
							: 'text-[var(--dash-text-muted)]'}"
					>
						{status[template.id] === 'saving'
							? 'Saving…'
							: status[template.id] === 'saved'
								? 'Saved'
								: status[template.id] === 'error'
									? 'Failed'
									: ''}
					</span>
				</div>
			{/each}
		</div>
		{#if hint}
			<p class="mt-1.5 text-xs text-[var(--dash-text-muted)]">{hint}</p>
		{/if}
	</div>
{/if}
