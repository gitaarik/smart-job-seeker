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
	 *
	 * Collapsed unless the role already has an override: it is a rare thing to
	 * want, and open on every role it is a permanent empty box under a field that
	 * is usually right as it stands. An override that *is* set opens on its own,
	 * because a hidden one silently changes what the template prints.
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
		/** The overridden field's own label — "Position", not "Position on a template". */
		label: string;
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

	function anySet(vals: Record<number, string>): boolean {
		return Object.values(vals).some((v) => v !== '');
	}

	// Bound, not derived: an override opens the panel on arrival, and after that
	// only the reader decides. Clearing the last override while the panel is open
	// must not snap it shut under the cursor.
	let isOpen = $state(anySet(saved));

	// The role editor is one route, so moving from /work-experience/8 to /9 swaps
	// these props under a component that is never torn down — without this the
	// second role would be editing the first one's values.
	let loadedFor = id;
	$effect(() => {
		if (loadedFor === id) return;
		loadedFor = id;
		const stored = storedValues();
		saved = stored;
		values = { ...stored };
		status = {};
		isOpen = anySet(stored);
	});

	const canOverride = $derived(Number.isInteger(id) && id > 0 && templates.length > 0);

	// One template is the ordinary case, and then this is a single field: the
	// template's name reads better in the heading than in a column of its own,
	// which otherwise indents the only input to line up with nothing.
	const single = $derived(templates.length === 1);
	const heading = $derived(single ? `${label} on ${templates[0].name}` : `${label} on a template`);

	/** What a collapsed summary adds, so a set override cannot hide behind it. */
	const collapsedValues = $derived.by(() => {
		const set = templates.filter((t) => (saved[t.id] ?? '') !== '');
		if (set.length === 0) return '';
		return single ? `: ${saved[set[0].id]}` : ` (${set.length} set)`;
	});

	function statusText(templateId: number): string {
		switch (status[templateId]) {
			case 'saving':
				return 'Saving…';
			case 'saved':
				return 'Saved';
			case 'error':
				return 'Failed';
			default:
				return '';
		}
	}

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
	<details
		bind:open={isOpen}
		class="rounded-md open:border open:border-[var(--dash-border)] open:px-3 open:py-2"
	>
		<summary
			class="cursor-pointer text-xs text-[var(--dash-text-secondary)] select-none hover:text-[var(--dash-text)]"
		>
			{heading}{isOpen ? '' : collapsedValues}
			{#if single && statusText(templates[0].id)}
				<span
					class="ml-2 {status[templates[0].id] === 'error'
						? 'text-[var(--dash-error)]'
						: 'text-[var(--dash-text-muted)]'}"
				>
					{statusText(templates[0].id)}
				</span>
			{/if}
		</summary>
		<div class="mt-1.5 space-y-1.5">
			{#each templates as template (template.id)}
				<div class="flex items-center gap-2">
					{#if !single}
						<span
							class="w-24 shrink-0 truncate text-xs text-[var(--dash-text-muted)]"
							title={template.name}
						>
							{template.name}
						</span>
					{/if}
					<input
						type="text"
						autocomplete="off"
						placeholder={base}
						aria-label="{label} on {template.name}"
						bind:value={values[template.id]}
						onblur={() => save(template.id)}
						class="min-w-0 flex-1 rounded-md border border-[var(--dash-border)] px-3 py-1.5 text-sm focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					/>
					{#if !single}
						<span
							class="w-14 shrink-0 text-right text-xs {status[template.id] === 'error'
								? 'text-[var(--dash-error)]'
								: 'text-[var(--dash-text-muted)]'}"
						>
							{statusText(template.id)}
						</span>
					{/if}
				</div>
			{/each}
		</div>
		{#if hint}
			<p class="mt-1.5 text-xs text-[var(--dash-text-muted)]">{hint}</p>
		{/if}
	</details>
{/if}
