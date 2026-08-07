<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faTags, faTimes, faPlus } from '@fortawesome/free-solid-svg-icons';
	import SectionSaveButton from '$lib/components/SectionSaveButton.svelte';

	type SaveState = 'idle' | 'saving' | 'saved' | 'error';

	let {
		tags = $bindable([]),
		apiUrl,
		section
	}: {
		tags: string[];
		apiUrl: string;
		section?: string;
	} = $props();

	let savedTags = $state<string[]>([...tags]);
	let saveState = $state<SaveState>('idle');
	let versionSlugs = $state<string[]>([]);
	let loaded = $state(false);

	const builtinTags = ['resume', 'cv'];

	let allSuggestions = $derived.by(() => {
		const all = [
			...builtinTags,
			...versionSlugs.filter((v) => !builtinTags.includes(v.toLowerCase()))
		];
		return all.filter((s) => !tags.some((t) => t.toLowerCase() === s.toLowerCase()));
	});

	let isDirty = $derived(JSON.stringify(tags) !== JSON.stringify(savedTags));

	$effect(() => {
		if (!loaded) {
			loadVersions();
		}
	});

	async function loadVersions() {
		if (loaded) return;
		try {
			const res = await fetch('/api/profile-versions');
			if (res.ok) {
				versionSlugs = await res.json();
			}
		} catch {
			// ignore
		}
		loaded = true;
	}

	function removeTag(tag: string) {
		tags = tags.filter((t) => t !== tag);
	}

	function addTag(tag: string) {
		const trimmed = tag.trim();
		if (trimmed && !tags.some((t) => t.toLowerCase() === trimmed.toLowerCase())) {
			tags = [...tags, trimmed];
		}
	}

	function cancel() {
		tags = [...savedTags];
	}

	async function save() {
		saveState = 'saving';
		try {
			const body: Record<string, unknown> = {
				tags: tags.length > 0 ? tags : null
			};
			if (section) {
				body.section = section;
			}
			const response = await fetch(apiUrl, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});

			if (response.ok) {
				savedTags = [...tags];
				saveState = 'saved';
				setTimeout(() => (saveState = 'idle'), 2000);
			} else {
				saveState = 'error';
				setTimeout(() => (saveState = 'idle'), 3000);
			}
		} catch {
			saveState = 'error';
			setTimeout(() => (saveState = 'idle'), 3000);
		}
	}
</script>

{#if loaded && versionSlugs.length > 0}
	<div class="rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-6">
		<h2 class="mb-1 text-lg font-semibold text-[var(--dash-text)]">
			<FontAwesomeIcon icon={faTags} class="mr-1.5 h-4 w-4 text-[var(--dash-text-secondary)]" />
			Resume / CV Versions
		</h2>
		<p class="mb-3 text-sm text-[var(--dash-text-secondary)]">
			Control which versions of your CV or resume include this item. No tags means it appears in all
			versions.
		</p>

		<!-- Current tags -->
		{#if tags.length > 0}
			<div class="mb-3 flex flex-wrap gap-1.5">
				{#each tags as tag}
					<button
						type="button"
						onclick={() => removeTag(tag)}
						class="inline-flex cursor-pointer items-center gap-1 rounded-md border border-[var(--dash-primary)]/20 bg-[var(--dash-primary)]/10 px-2.5 py-1 text-xs text-[var(--dash-primary)] transition-colors hover:border-red-500/30 hover:bg-red-500/15 hover:text-red-500"
					>
						{tag}
						<FontAwesomeIcon icon={faTimes} class="h-2.5 w-2.5" />
					</button>
				{/each}
			</div>
		{:else}
			<p class="mb-3 text-sm text-[var(--dash-text-muted)] italic">All versions</p>
		{/if}

		<!-- Suggestions -->
		{#if allSuggestions.length > 0}
			<div class="mb-3 flex flex-wrap gap-1.5">
				{#each allSuggestions as suggestion}
					<button
						type="button"
						onclick={() => addTag(suggestion)}
						class="inline-flex items-center gap-1 rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] px-2.5 py-1 text-xs text-[var(--dash-text-secondary)] transition-colors hover:border-[var(--dash-primary)]/40 hover:text-[var(--dash-primary)]"
					>
						<FontAwesomeIcon icon={faPlus} class="h-2.5 w-2.5" />
						{suggestion}
					</button>
				{/each}
			</div>
		{/if}

		<!-- Save / Cancel -->
		<div class="flex items-center justify-end gap-2">
			{#if isDirty}
				<button
					type="button"
					onclick={cancel}
					class="rounded-lg border border-[var(--dash-border)] px-3 py-1.5 text-sm text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					Cancel
				</button>
			{/if}
			<SectionSaveButton state={saveState} onClick={save} disabled={!isDirty} />
		</div>
	</div>
{/if}
