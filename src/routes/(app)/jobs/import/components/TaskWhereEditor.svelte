<script lang="ts">
	/**
	 * An import task's "where" on its page (planning/STRUCTURED-LOCATIONS.md,
	 * Phase 3), auto-saved as one PATCH: places, text and the remote flag.
	 *
	 * A feed task picks any number of places, plus "remote postings from any
	 * country too". A text typed before the picker shows as its parts, still
	 * read as countries, to pick again and remove; the word "remote" in it
	 * becomes the checkbox on the first save. A browser task picks one place
	 * for the site's location box (its board has one), or keeps a text as
	 * typed when no place fits.
	 */
	import { untrack } from 'svelte';
	import PlacePicker from '$lib/components/PlacePicker.svelte';
	import { autoSaveField } from '$lib/components/auto-save.svelte';
	import AutoSaveIndicator from '$lib/components/AutoSaveIndicator.svelte';
	import { armOn } from '$lib/actions/arm-on';
	import type { Place, PreferredPlace } from '$lib/data/places';

	export interface TaskWhere {
		search_places: PreferredPlace[] | null;
		search_location: string | null;
		search_remote_anywhere: boolean;
	}

	interface Props {
		taskId: number;
		feed: boolean;
		initial: TaskWhere;
		onSaved?: (saved: TaskWhere) => void;
	}

	let { taskId, feed, initial, onSaved }: Props = $props();

	type Where = { places: PreferredPlace[]; text: string | null; remote: boolean };
	const REMOTE_WORD = /^(remote|anywhere|worldwide|global)$/i;
	const textParts = (text: string | null | undefined) =>
		(text ?? '')
			.split(/[,;\n]+/)
			.map((t) => t.trim())
			.filter(Boolean);

	function whereOf(row: TaskWhere, isFeed: boolean): Where {
		const places = [...(row.search_places ?? [])];
		if (!isFeed) {
			return {
				places: places.slice(0, 1),
				text: row.search_location?.trim() || null,
				remote: row.search_remote_anywhere
			};
		}
		const parts = textParts(row.search_location);
		return {
			places,
			text: parts.filter((t) => !REMOTE_WORD.test(t)).join(', ') || null,
			remote: row.search_remote_anywhere || parts.some((t) => REMOTE_WORD.test(t))
		};
	}

	// The page keys this component on the task id, so the first values are the task's.
	const first = untrack(() => whereOf(initial, feed));
	let places = $state<PreferredPlace[]>(first.places);
	let place = $state<Place | null>(first.places[0] ?? null);
	let text = $state<string | null>(first.text);
	let remote = $state(first.remote);

	const field = autoSaveField<Where>({
		armOnInteraction: true,
		initial: first,
		save: async (v) => {
			const body: TaskWhere = {
				search_places: v.places.length ? v.places : null,
				search_location: v.text,
				search_remote_anywhere: v.remote
			};
			const res = await fetch(`/api/import-tasks/${taskId}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) throw new Error((await res.text()) || `Save failed (${res.status})`);
			onSaved?.(body);
		},
		equal: (a, b) =>
			a.places.map((p) => p.id).join() === b.places.map((p) => p.id).join() &&
			(a.text ?? '') === (b.text ?? '') &&
			a.remote === b.remote
	});
	$effect(() => {
		field.set({
			places: feed ? [...places] : place ? [place] : [],
			text,
			remote: feed ? remote : first.remote
		});
	});

	function removePart(part: string) {
		text =
			textParts(text)
				.filter((t) => t !== part)
				.join(', ') || null;
	}
</script>

<div use:armOn={() => field.arm()}>
	<label
		class="mb-1 block text-xs font-medium text-[var(--dash-text-secondary)]"
		for="edit-where-{taskId}"
		>Where <span class="font-normal text-[var(--dash-text-muted)]">(optional)</span></label
	>
	{#if feed}
		{#if text}
			<div class="mb-2">
				<p class="mb-1.5 text-xs text-[var(--dash-text-secondary)]">
					Typed before places could be picked, still read as countries: pick the place below and
					remove these.
				</p>
				<div class="flex flex-wrap gap-2">
					{#each textParts(text) as part (part)}
						<span
							class="flex items-center gap-2 rounded-lg border border-dashed border-[var(--dash-border)] px-3 py-1 text-sm text-[var(--dash-text-secondary)]"
						>
							{part}
							<button
								type="button"
								onclick={() => removePart(part)}
								class="transition-colors hover:text-[var(--dash-error)]"
								aria-label="Remove {part}"
							>
								&times;
							</button>
						</span>
					{/each}
				</div>
			</div>
		{/if}
		<PlacePicker
			id="edit-where-{taskId}"
			multiple
			bind:places
			placeholder="Add a city, country or region..."
		/>
		<label class="mt-2 flex cursor-pointer items-center gap-2">
			<input
				type="checkbox"
				bind:checked={remote}
				class="h-4 w-4 rounded border-[var(--dash-border)] text-[var(--dash-primary)] focus:ring-[var(--dash-primary)]"
			/>
			<span class="text-sm text-[var(--dash-text-secondary)]"
				>Also remote postings from any country</span
			>
		</label>
		<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
			A city or a province counts as its country, a region as all of its countries. Empty means
			every country.
		</p>
	{:else}
		<PlacePicker
			id="edit-where-{taskId}"
			allowText
			bind:value={place}
			bind:text
			placeholder="Search a city, country or region..."
		/>
		<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
			Typed into the site's own location box, on sites that have one. Empty searches wherever the
			site does by default.
		</p>
	{/if}
	{#if field.status !== 'idle'}
		<div class="mt-2">
			<AutoSaveIndicator {field} />
		</div>
	{/if}
</div>
