<script lang="ts">
	import { enhance } from '$app/forms';
	import Spinner from '$lib/components/Spinner.svelte';
	import Card from '../../../components/Card.svelte';

	interface Props {
		isLoading: boolean;
		error: string | null;
		onBack: () => void;
		onLoadingChange: (loading: boolean) => void;
	}

	let { isLoading, error, onBack, onLoadingChange }: Props = $props();

	let name = $state('');
	let title = $state('');
	let email = $state('');
	let phone = $state('');
</script>

<Card padding="responsive">
	<h3 class="mb-1 font-medium text-[var(--dash-text)]">Create Your Profile</h3>
	<p class="mb-4 text-sm text-[var(--dash-text-secondary)]">
		Enter your basic information to get started
	</p>

	<form
		method="POST"
		action="?/manual"
		use:enhance={() => {
			onLoadingChange(true);
			return async ({ update }) => {
				onLoadingChange(false);
				await update();
			};
		}}
		class="space-y-4"
	>
		{#if error}
			<div class="rounded-lg border border-[var(--dash-error)] bg-[var(--dash-error-light)] p-4">
				<p class="text-sm text-[var(--dash-error)]">{error}</p>
			</div>
		{/if}

		<div>
			<label for="name" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
				Full Name <span class="text-[var(--dash-error)]">*</span>
			</label>
			<input
				id="name"
				name="name"
				type="text"
				bind:value={name}
				required
				class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				placeholder="John Doe"
			/>
		</div>

		<div>
			<label for="title" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
				Professional Title
			</label>
			<input
				id="title"
				name="title"
				type="text"
				bind:value={title}
				class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
				placeholder="Software Engineer"
			/>
			<p class="mt-1 text-xs text-[var(--dash-text-muted)]">
				This will appear below your name on your profile.
			</p>
		</div>

		<div class="grid gap-4 md:grid-cols-2">
			<div>
				<label for="email" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					Email
				</label>
				<input
					id="email"
					name="email"
					type="email"
					bind:value={email}
					class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					placeholder="john@example.com"
				/>
			</div>

			<div>
				<label for="phone" class="mb-1 block text-sm font-medium text-[var(--dash-text)]">
					Phone
				</label>
				<input
					id="phone"
					name="phone"
					type="tel"
					bind:value={phone}
					class="w-full rounded-md border border-[var(--dash-border)] px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-[var(--dash-primary)] focus:outline-none"
					placeholder="+1 (555) 123-4567"
				/>
			</div>
		</div>

		<div class="flex justify-end gap-2 pt-2">
			<button
				type="button"
				onclick={onBack}
				class="rounded-lg border border-[var(--dash-border)] px-4 py-2 text-[var(--dash-text)] transition-colors hover:bg-[var(--dash-bg)]"
			>
				Back
			</button>

			<button
				type="submit"
				disabled={!name.trim() || isLoading}
				class="flex items-center gap-2 rounded-lg bg-[var(--dash-primary)] px-4 py-2 text-white transition-colors hover:bg-[var(--dash-primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if isLoading}
					<Spinner size="w-4 h-4" />
					Creating...
				{:else}
					Create Profile
				{/if}
			</button>
		</div>
	</form>
</Card>
