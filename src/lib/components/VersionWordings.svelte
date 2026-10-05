<!--
	Which wording one version uses for each field that has alternatives: the
	profile's title, subtitle, headline and summary, and each role's position.

	This is where an alternative reaches a library version. The alternatives
	themselves are edited under the field they belong to (FieldVariants.svelte,
	on Basic Info and on a role's page); here they are only chosen between,
	which is why there is no way to add or edit one from this screen: a version
	picking a wording and a wording existing are different decisions, and mixing
	them makes it unclear which documents an edit is about to change.

	Fields with no alternatives are not shown at all — the page hands this only
	the ones that have some. The whole control disappears for a profile that has
	never made one, rather than showing rows of "Default" with nothing to switch
	to.

	A version that builds on another prints the wording that one picked until it
	picks its own, as it prints that version's items. So an inherited pick is
	shown selected, with where it comes from, and choosing anything here —
	including the profile's own value — is this version's own decision.
-->
<script lang="ts">
	import { untrack } from 'svelte';
	import { variantPreview, type WordingState } from '$lib/field-variants';

	interface Props {
		versionId: number;
		/** Every target that has alternatives, with what this version prints for it. */
		wordings: WordingState[];
		/** Called after a pick is saved, so the parent can refresh a preview. */
		onchange?: () => void;
	}

	let { versionId, wordings, onchange }: Props = $props();

	// Owned locally after the first render so a pick shows immediately rather
	// than after a round trip; the server is the authority, and a failed save
	// puts the previous value back. The page mounts this again for another
	// version (it is keyed on the version), so seeding once is right.
	let picks = $state<Record<string, number | null>>(
		untrack(() => Object.fromEntries(wordings.map((w) => [w.key, w.pickedId])))
	);
	// Targets this visit has chosen for. Until then an inherited pick is still
	// the other version's, and says so.
	let chosenHere = $state<string[]>([]);
	let saving = $state<string | null>(null);
	let error = $state('');

	const heading = (w: WordingState) => (w.context ? `${w.label} — ${w.context}` : w.label);

	async function pick(w: WordingState, variantId: number | null) {
		const previous = picks[w.key] ?? null;
		picks[w.key] = variantId;
		saving = w.key;
		error = '';
		try {
			const res = await fetch('/api/field-variants/pick', {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					versionId,
					entity: w.entity,
					entityId: w.entityId,
					field: w.field,
					variantId
				})
			});
			if (!res.ok) {
				picks[w.key] = previous;
				error = (await res.text().catch(() => '')) || 'Could not save';
				return;
			}
			if (!chosenHere.includes(w.key)) chosenHere = [...chosenHere, w.key];
			onchange?.();
		} catch {
			picks[w.key] = previous;
			error = 'Could not save';
		} finally {
			saving = null;
		}
	}
</script>

{#if wordings.length > 0}
	<div class="space-y-4">
		{#each wordings as w (w.key)}
			{@const inherited = w.from === 'inherited' && !chosenHere.includes(w.key)}
			<fieldset data-wording={w.key}>
				<legend class="mb-1.5 text-sm font-medium text-[var(--dash-text)]">
					{heading(w)}
					{#if saving === w.key}
						<span class="ml-1 text-xs font-normal text-[var(--dash-text-muted)]">Saving…</span>
					{/if}
				</legend>

				{#if inherited}
					<p class="mb-1.5 text-xs text-[var(--dash-text-secondary)]">
						Chosen on {w.inheritedFrom ? `“${w.inheritedFrom}”` : 'a version'}, which this version
						builds on. Choosing here changes it for this version only.
					</p>
				{/if}

				<div class="space-y-1">
					<label
						class="flex cursor-pointer items-start gap-2 rounded-md border p-2 transition-colors
							{(picks[w.key] ?? null) === null
							? 'border-[var(--dash-primary)] bg-[var(--dash-bg)]'
							: 'border-[var(--dash-border)] hover:bg-[var(--dash-bg)]'}"
					>
						<input
							type="radio"
							name={`wording-${w.key}`}
							checked={(picks[w.key] ?? null) === null}
							onchange={() => pick(w, null)}
							class="mt-0.5 accent-[var(--dash-primary)]"
						/>
						<span class="min-w-0 flex-1">
							<span class="block text-xs font-medium text-[var(--dash-text)]">
								Your own {w.label.toLowerCase()}
							</span>
							<span class="block text-xs text-[var(--dash-text-muted)]">
								{variantPreview(w.own) || 'Not set'}
							</span>
						</span>
					</label>

					{#each w.options as v (v.id)}
						<label
							class="flex cursor-pointer items-start gap-2 rounded-md border p-2 transition-colors
								{picks[w.key] === v.id
								? 'border-[var(--dash-primary)] bg-[var(--dash-bg)]'
								: 'border-[var(--dash-border)] hover:bg-[var(--dash-bg)]'}"
						>
							<input
								type="radio"
								name={`wording-${w.key}`}
								checked={picks[w.key] === v.id}
								onchange={() => pick(w, v.id)}
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
