<script lang="ts">
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faExclamationTriangle, faQuestionCircle } from '@fortawesome/free-solid-svg-icons';
	import { portalToBody } from '$lib/actions/portal';

	interface Props {
		isOpen: boolean;
		title?: string;
		message?: string;
		confirmLabel?: string;
		cancelLabel?: string;
		variant?: 'destructive' | 'primary';
		onConfirm: () => void;
		onCancel: () => void;
	}

	let {
		isOpen,
		title = 'Confirm',
		message = 'Are you sure?',
		confirmLabel = 'Confirm',
		cancelLabel = 'Cancel',
		variant = 'destructive',
		onConfirm,
		onCancel
	}: Props = $props();

	const iconBg = $derived(
		variant === 'destructive' ? 'bg-[var(--dash-error-light)]' : 'bg-[var(--dash-primary)]/10'
	);
	const iconColor = $derived(
		variant === 'destructive' ? 'text-[var(--dash-error)]' : 'text-[var(--dash-primary)]'
	);
	const icon = $derived(variant === 'destructive' ? faExclamationTriangle : faQuestionCircle);
	const btnClass = $derived(
		variant === 'destructive'
			? 'bg-[var(--dash-error)] text-white'
			: 'bg-[var(--dash-primary)] text-white'
	);
</script>

{#if isOpen}
	<!-- Backdrop -->
	<div
		use:portalToBody
		class="fixed inset-0 z-40 bg-black/50"
		onclick={onCancel}
		role="button"
		tabindex="-1"
		aria-label="Close modal"
	></div>

	<!-- Modal -->
	<div
		use:portalToBody={{ onClose: onCancel }}
		class="fixed inset-0 z-50 flex items-center justify-center p-4"
		role="dialog"
		aria-modal="true"
		aria-labelledby="modal-title"
	>
		<div
			class="w-full max-w-md rounded-xl bg-[var(--dash-card)] p-6 shadow-xl"
			onclick={(e) => e.stopPropagation()}
			onkeydown={() => {}}
			role="document"
		>
			<div class="flex items-start gap-4">
				<div class="h-10 w-10 rounded-full {iconBg} flex flex-shrink-0 items-center justify-center">
					<FontAwesomeIcon {icon} class="h-5 w-5 {iconColor}" />
				</div>
				<div>
					<h3 id="modal-title" class="mb-2 text-lg font-semibold text-[var(--dash-text)]">
						{title}
					</h3>
					<p class="text-sm whitespace-pre-line text-[var(--dash-text-secondary)]">{message}</p>
				</div>
			</div>

			<div class="mt-6 flex justify-end gap-3">
				<button
					type="button"
					onclick={onCancel}
					class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
				>
					{cancelLabel}
				</button>
				<button
					type="button"
					onclick={onConfirm}
					class="px-4 py-2 {btnClass} rounded-lg transition-colors hover:opacity-90"
				>
					{confirmLabel}
				</button>
			</div>
		</div>
	</div>
{/if}
