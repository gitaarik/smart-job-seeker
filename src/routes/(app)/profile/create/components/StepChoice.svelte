<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faEdit, faFileImport, faFileUpload } from '@fortawesome/free-solid-svg-icons';

	interface Props {
		onChoose: (method: 'upload' | 'manual' | 'import') => void;
	}

	let { onChoose }: Props = $props();
</script>

<div class="space-y-4">
	<div class="grid gap-4 md:grid-cols-2">
		<button
			type="button"
			onclick={() => onChoose('upload')}
			class="group rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4 text-left transition-all hover:border-[var(--dash-primary)] sm:p-6"
		>
			<div
				class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--dash-bg)] group-hover:bg-[var(--dash-primary)]/10 sm:mb-4"
			>
				<FontAwesomeIcon
					icon={faFileUpload}
					class="h-5 w-5 text-[var(--dash-text-muted)] group-hover:text-[var(--dash-primary)]"
				/>
			</div>
			<h3 class="mb-1 text-base font-semibold text-[var(--dash-text)] sm:mb-2 sm:text-lg">
				Upload CV/Resume
			</h3>
			<p class="text-xs text-[var(--dash-text-secondary)] sm:text-sm">
				Upload your CV or resume and we'll extract your information using AI.
			</p>
			<p class="mt-2 text-xs text-[var(--dash-text-muted)] sm:mt-3">PDF, DOCX, HTML</p>
		</button>

		<button
			type="button"
			onclick={() => onChoose('manual')}
			class="group rounded-lg border border-[var(--dash-border)] bg-[var(--dash-card)] p-4 text-left transition-all hover:border-[var(--dash-primary)] sm:p-6"
		>
			<div
				class="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--dash-bg)] group-hover:bg-[var(--dash-primary)]/10 sm:mb-4"
			>
				<FontAwesomeIcon
					icon={faEdit}
					class="h-5 w-5 text-[var(--dash-text-muted)] group-hover:text-[var(--dash-primary)]"
				/>
			</div>
			<h3 class="mb-1 text-base font-semibold text-[var(--dash-text)] sm:mb-2 sm:text-lg">
				Create Manually
			</h3>
			<p class="text-xs text-[var(--dash-text-secondary)] sm:text-sm">
				Start with a blank profile and enter your information manually.
			</p>
			<p class="mt-2 text-xs text-[var(--dash-text-muted)] sm:mt-3">Basic fields</p>
		</button>
	</div>

	<div class="border-t border-[var(--dash-border)] pt-2">
		<button
			type="button"
			onclick={() => onChoose('import')}
			class="flex w-full items-center justify-center gap-2 py-2 text-sm text-[var(--dash-text-secondary)] transition-colors hover:text-[var(--dash-primary)]"
		>
			<FontAwesomeIcon icon={faFileImport} class="h-4 w-4" />
			<span>Import from a previous export</span>
		</button>
	</div>
</div>
