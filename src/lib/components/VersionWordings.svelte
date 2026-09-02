<!--
	Which wording one version uses for each of the profile's scalar fields.

	This is where an alternative actually reaches a document. The library of
	alternatives is edited on the profile's Basic Info page
	(FieldVariants.svelte); here they are only chosen between, which is why
	there is no way to add or edit one from this screen: a version picking a
	wording and a wording existing are different decisions, and mixing them
	makes it unclear which documents an edit is about to change.

	Fields with no alternatives are not shown at all. The whole control
	disappears for a profile that has never made one, rather than showing four
	rows of "Default" with nothing to switch to.
-->
<script lang="ts">
	import { VARIANT_FIELDS, variantPreview, type FieldVariant } from '$lib/field-variants';
	import { groupVariantsByField } from '$lib/field-variants';

	interface Props {
		versionId: number;
		/** The whole library; this component shows only the fields that have one. */
		variants: FieldVariant[];
		/** variantId per field, as this version currently picks them. */
		picks: Record<string, number | null>;
		/** The profile's own values, shown as the default option. */
		defaults: Record<string, string>;
		/** Called after a pick is saved, so the parent can refresh a preview. */
		onchange?: () => void;
	}

	let { versionId, variants, picks: initialPicks, defaults, onchange }: Props = $props();

	// Owned locally after the first render so a pick shows immediately rather
	// than after a round trip; the server is the authority, and a failed save
	// puts the previous value back.
	let picks = $state<Record<string, number | null>>({ ...initialPicks });
	let saving = $state<string | null>(null);
	let error = $state('');

	const grouped = $derived(groupVariantsByField(variants));
	const fields = $derived(VARIANT_FIELDS.filter((f) => (grouped.get(f.field) ?? []).length > 0));

	async function pick(field: string, variantId: number | null) {
		const previous = picks[field] ?? null;
		picks[field] = variantId;
		saving = field;
		error = '';
		try {
			const res = await fetch('/api/field-variants/pick', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ versionId, field, variantId })
			});
			if (!res.ok) {
				picks[field] = previous;
				error = (await res.text().catch(() => '')) || 'Could not save';
				return;
			}
			onchange?.();
		} catch {
			picks[field] = previous;
			error = 'Could not save';
		} finally {
			saving = null;
		}
	}
</script>

{#if fields.length > 0}
	<div class="space-y-4">
		{#each fields as f (f.field)}
			{@const options = grouped.get(f.field) ?? []}
			<fieldset>
				<legend class="mb-1.5 text-sm font-medium text-[var(--dash-text)]">
					{f.label}
					{#if saving === f.field}
						<span class="ml-1 text-xs font-normal text-[var(--dash-text-muted)]">Saving…</span>
					{/if}
				</legend>

				<div class="space-y-1">
					<label
						class="flex cursor-pointer items-start gap-2 rounded-md border p-2 transition-colors
							{(picks[f.field] ?? null) === null
							? 'border-[var(--dash-primary)] bg-[var(--dash-bg)]'
							: 'border-[var(--dash-border)] hover:bg-[var(--dash-bg)]'}"
					>
						<input
							type="radio"
							name={`wording-${f.field}`}
							checked={(picks[f.field] ?? null) === null}
							onchange={() => pick(f.field, null)}
							class="mt-0.5 accent-[var(--dash-primary)]"
						/>
						<span class="min-w-0 flex-1">
							<span class="block text-xs font-medium text-[var(--dash-text)]">
								Your own {f.label.toLowerCase()}
							</span>
							<span class="block text-xs text-[var(--dash-text-muted)]">
								{variantPreview(defaults[f.field] ?? '') || 'Not set'}
							</span>
						</span>
					</label>

					{#each options as v (v.id)}
						<label
							class="flex cursor-pointer items-start gap-2 rounded-md border p-2 transition-colors
								{picks[f.field] === v.id
								? 'border-[var(--dash-primary)] bg-[var(--dash-bg)]'
								: 'border-[var(--dash-border)] hover:bg-[var(--dash-bg)]'}"
						>
							<input
								type="radio"
								name={`wording-${f.field}`}
								checked={picks[f.field] === v.id}
								onchange={() => pick(f.field, v.id)}
								class="mt-0.5 accent-[var(--dash-primary)]"
							/>
							<span class="min-w-0 flex-1">
								<span class="block text-xs font-medium text-[var(--dash-text)]">{v.label}</span>
								<span class="block text-xs text-[var(--dash-text-muted)]">
									{variantPreview(v.value)}
								</span>
								{#if v.note}
									<span class="block text-[11px] text-[var(--dash-text-secondary)] italic">
										Use for: {v.note}
									</span>
								{/if}
							</span>
						</label>
					{/each}
				</div>
			</fieldset>
		{/each}

		{#if error}
			<p class="text-xs text-[var(--dash-error)]">{error}</p>
		{/if}
	</div>
{/if}
