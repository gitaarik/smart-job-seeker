<!--
	Alternative wordings for one profile field, shown under the field itself.

	Collapsed to a single line until there is something to see, because this is
	an advanced control on a page whose job is the basics: a profile with no
	variants should look exactly as it did, and the affordance should read as
	"you can have more than one of these" rather than as a section to fill in.

	It edits the LIBRARY, not any document. Nothing here changes what a resume
	says — that happens when a version picks one (VersionWordings.svelte), and
	the note under the list says so, because "add an alternative summary" would
	otherwise read as "change my summary".
-->
<script lang="ts">
	import { faPlus, faTrash, faPen, faCheck, faXmark } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import TranslatableField from '$lib/components/TranslatableField.svelte';
	import {
		FIELD_VARIANT_ENTITY,
		FIELD_VARIANT_VALUE,
		variantField,
		type FieldVariant
	} from '$lib/field-variants';

	interface Props {
		/** Which profile field these vary. */
		field: string;
		/** This field's variants, owned by the parent so one fetch feeds all four. */
		variants: FieldVariant[];
		/** The profile's own value, shown as the default at the top of the list. */
		defaultValue: string;
		onchange: () => void;
	}

	let { field, variants, defaultValue, onchange }: Props = $props();

	const spec = $derived(variantField(field));
	const multiline = $derived(spec?.multiline ?? false);
	const rows = $derived(spec?.rows ?? 3);

	let open = $state(false);
	let busy = $state(false);
	let error = $state('');

	// The row being edited, or 'new' while adding. One at a time: two open
	// editors on the same field is a way to lose the one you weren't looking at.
	let editing = $state<number | 'new' | null>(null);
	let draftLabel = $state('');
	let draftValue = $state('');
	let draftNote = $state('');

	const inputClass =
		'w-full px-2.5 py-1.5 text-sm border border-[var(--dash-border)] rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--dash-primary)] focus:border-transparent';

	function startAdd() {
		editing = 'new';
		draftLabel = '';
		// Seeded from the profile's own value, because an alternative is almost
		// always an edit of the default rather than a blank page.
		draftValue = defaultValue;
		draftNote = '';
		error = '';
	}

	function startEdit(v: FieldVariant) {
		editing = v.id;
		draftLabel = v.label;
		draftValue = v.value;
		draftNote = v.note ?? '';
		error = '';
	}

	function cancel() {
		editing = null;
		error = '';
	}

	async function send(method: string, body: unknown): Promise<boolean> {
		busy = true;
		error = '';
		try {
			const res = await fetch('/api/field-variants', {
				method,
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
			if (!res.ok) {
				error = (await res.text().catch(() => '')) || 'Could not save';
				return false;
			}
			onchange();
			return true;
		} catch {
			error = 'Could not save';
			return false;
		} finally {
			busy = false;
		}
	}

	async function save() {
		if (!draftValue.trim()) {
			error = 'An alternative needs some text';
			return;
		}
		const body = {
			field,
			label: draftLabel,
			value: draftValue,
			note: draftNote,
			...(editing === 'new' ? {} : { id: editing })
		};
		if (await send(editing === 'new' ? 'POST' : 'PUT', body)) editing = null;
	}

	async function remove(v: FieldVariant) {
		if (
			!confirm(
				`Delete the “${v.label}” alternative? Any version using it goes back to your own value.`
			)
		) {
			return;
		}
		await send('DELETE', { id: v.id });
	}

	// Opened automatically once there is something in it, so the four fields do
	// not all have to be expanded by hand on every visit.
	$effect(() => {
		if (variants.length > 0) open = true;
	});
</script>

<div class="mt-1.5">
	{#if !open && variants.length === 0}
		<button
			type="button"
			onclick={() => {
				open = true;
				startAdd();
			}}
			class="text-xs text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] hover:underline"
		>
			+ Add an alternative wording
		</button>
	{:else}
		<div class="rounded-md border border-[var(--dash-border)] bg-[var(--dash-bg)] p-2.5">
			<div class="mb-1.5 flex items-center justify-between gap-2">
				<span class="text-xs font-semibold text-[var(--dash-text-secondary)]">
					Alternative wordings
				</span>
				{#if editing === null}
					<button
						type="button"
						onclick={startAdd}
						disabled={busy}
						class="inline-flex items-center gap-1 text-xs text-[var(--dash-primary)] hover:underline disabled:opacity-50"
					>
						<FontAwesomeIcon icon={faPlus} class="h-2.5 w-2.5" /> Add
					</button>
				{/if}
			</div>

			<ul class="space-y-1">
				<!-- The default is a row in the same list, not a separate idea: it is
				     what a version gets when it picks nothing, so it belongs where the
				     alternatives to it are read. -->
				<li class="flex items-start gap-2 rounded px-1.5 py-1 text-xs">
					<span
						class="mt-px shrink-0 rounded bg-[var(--dash-border)] px-1.5 py-px text-[10px] font-semibold tracking-wide text-[var(--dash-text-secondary)] uppercase"
					>
						Default
					</span>
					<span class="min-w-0 flex-1 truncate text-[var(--dash-text-muted)]">
						{defaultValue || 'Not set'}
					</span>
				</li>

				{#each variants as v (v.id)}
					{#if editing === v.id}
						<li class="rounded border border-[var(--dash-primary)] p-2">
							{@render editor()}
						</li>
					{:else}
						<li
							class="group flex items-start gap-2 rounded px-1.5 py-1 hover:bg-[var(--dash-bg-secondary)]"
						>
							<span class="min-w-0 flex-1">
								<span class="block text-xs font-medium text-[var(--dash-text)]">{v.label}</span>
								<span class="block truncate text-xs text-[var(--dash-text-muted)]">{v.value}</span>
								{#if v.note}
									<span class="block truncate text-[11px] text-[var(--dash-text-secondary)] italic">
										Use for: {v.note}
									</span>
								{/if}
							</span>
							<span
								class="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100"
							>
								<button
									type="button"
									onclick={() => startEdit(v)}
									disabled={busy}
									aria-label="Edit alternative"
									class="rounded p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-primary)] disabled:opacity-50"
								>
									<FontAwesomeIcon icon={faPen} class="h-2.5 w-2.5" />
								</button>
								<button
									type="button"
									onclick={() => remove(v)}
									disabled={busy}
									aria-label="Delete alternative"
									class="rounded p-1 text-[var(--dash-text-muted)] hover:text-[var(--dash-error)] disabled:opacity-50"
								>
									<FontAwesomeIcon icon={faTrash} class="h-2.5 w-2.5" />
								</button>
							</span>
						</li>
					{/if}
				{/each}

				{#if editing === 'new'}
					<li class="rounded border border-[var(--dash-primary)] p-2">
						{@render editor()}
					</li>
				{/if}
			</ul>

			{#if error}
				<p class="mt-1.5 text-xs text-[var(--dash-error)]">{error}</p>
			{/if}

			<p class="mt-2 text-[11px] text-[var(--dash-text-secondary)]">
				Alternatives don't change any document on their own. Pick one on a resume version, or let a
				tailored version choose the one that fits the job.
			</p>
		</div>
	{/if}
</div>

{#snippet editor()}
	<div class="space-y-1.5">
		<input
			type="text"
			bind:value={draftLabel}
			placeholder="Name it — e.g. “Backend-leaning”"
			class={inputClass}
		/>
		<!-- The wording itself, through the same control every other translatable
		     field on this page uses. A variant carries its OWN translations (keyed
		     on its row, not on the field it stands in for), so without this the
		     only way to get one into Dutch would be the whole-profile
		     auto-translate — and hand-editing what it produced would be
		     impossible. On a variant not yet saved the id is 0 and the control
		     falls back to a plain input, which is what it already does for any
		     unsaved record. -->
		<TranslatableField
			entity={FIELD_VARIANT_ENTITY}
			id={typeof editing === 'number' ? editing : 0}
			field={FIELD_VARIANT_VALUE}
			{multiline}
			{rows}
			maxRows={10}
			bind:value={draftValue}
			placeholder={spec?.placeholder}
			autocomplete="off"
		/>
		<input
			type="text"
			bind:value={draftNote}
			placeholder="When to use it — e.g. “agency and consultancy roles”"
			class={inputClass}
		/>
		<p class="text-[11px] text-[var(--dash-text-secondary)]">
			The “when to use it” note is what a tailored version matches against the job, so it's worth
			writing even if you always pick by hand.
		</p>
		<div class="flex justify-end gap-1.5">
			<button
				type="button"
				onclick={cancel}
				disabled={busy}
				class="inline-flex items-center gap-1 rounded px-2 py-1 text-xs text-[var(--dash-text-muted)] hover:bg-[var(--dash-bg-secondary)] disabled:opacity-50"
			>
				<FontAwesomeIcon icon={faXmark} class="h-2.5 w-2.5" /> Cancel
			</button>
			<button
				type="button"
				onclick={save}
				disabled={busy}
				class="inline-flex items-center gap-1 rounded bg-[var(--dash-primary)] px-2 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
			>
				<FontAwesomeIcon icon={faCheck} class="h-2.5 w-2.5" /> Save
			</button>
		</div>
	</div>
{/snippet}
