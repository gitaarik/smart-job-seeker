<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import Spinner from '$lib/components/Spinner.svelte';
	let { data, form }: { data: PageData; form: ActionData } = $props();

	let password = $state('');
	let confirmPassword = $state('');
	let loading = $state(false);

	function handleSubmit() {
		return async ({
			result,
			update
		}: {
			result: { type: string };
			update: () => Promise<void>;
		}) => {
			await update();
			loading = false;
		};
	}
</script>

<svelte:head>
	<title>Accept Invitation - Smart Job Seeker</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-[var(--dash-bg)] px-4 py-12 transition-colors sm:px-6 lg:px-8"
>
	<div class="w-full max-w-md space-y-8">
		{#if !data.valid}
			<div class="text-center">
				<h2 class="mt-6 text-3xl font-extrabold text-[var(--dash-text)]">Invalid Invitation</h2>
				<p class="mt-4 text-[var(--dash-text-secondary)]">
					{data.error}
				</p>
				<a
					href="/login"
					class="mt-6 inline-block font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
				>
					Go to login
				</a>
			</div>
		{:else}
			<div>
				<h2 class="mt-6 text-center text-3xl font-extrabold text-[var(--dash-text)]">
					Set Up Your Account
				</h2>
				<p class="mt-2 text-center text-sm text-[var(--dash-text-secondary)]">
					You've been invited to join Smart Job Seeker. Set a password to activate your account.
				</p>
			</div>

			<form
				method="POST"
				class="mt-8 space-y-6"
				use:enhance={() => {
					loading = true;
					return handleSubmit();
				}}
			>
				<input type="hidden" name="token" value={data.token} />

				{#if form?.error}
					<div class="rounded-md bg-[var(--dash-error-light)] p-4">
						<p class="text-sm text-[var(--dash-error)]">{form.error}</p>
					</div>
				{/if}

				<div class="space-y-4">
					<div>
						<label for="invite-name" class="block text-sm font-medium text-[var(--dash-text)]"
							>Name</label
						>
						<input
							id="invite-name"
							type="text"
							disabled
							value={data.name}
							class="mt-1 block w-full cursor-not-allowed rounded-md border border-[var(--dash-border-input)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text-muted)] sm:text-sm"
						/>
					</div>
					<div>
						<label for="invite-email" class="block text-sm font-medium text-[var(--dash-text)]"
							>Email</label
						>
						<input
							id="invite-email"
							type="email"
							disabled
							value={data.email}
							class="mt-1 block w-full cursor-not-allowed rounded-md border border-[var(--dash-border-input)] bg-[var(--dash-bg)] px-3 py-2 text-[var(--dash-text-muted)] sm:text-sm"
						/>
					</div>
					<div>
						<label for="invite-password" class="block text-sm font-medium text-[var(--dash-text)]"
							>Password</label
						>
						<input
							id="invite-password"
							name="password"
							type="password"
							autocomplete="new-password"
							bind:value={password}
							required
							minlength="8"
							class="mt-1 block w-full rounded-md border border-[var(--dash-border-input)] bg-[var(--dash-card)] px-3 py-2 text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:border-[var(--dash-primary)] focus:ring-[var(--dash-primary)] focus:outline-none sm:text-sm"
							placeholder="At least 8 characters"
						/>
					</div>
					<div>
						<label
							for="invite-confirm-password"
							class="block text-sm font-medium text-[var(--dash-text)]">Confirm password</label
						>
						<input
							id="invite-confirm-password"
							name="confirm_password"
							type="password"
							autocomplete="new-password"
							bind:value={confirmPassword}
							required
							minlength="8"
							class="mt-1 block w-full rounded-md border border-[var(--dash-border-input)] bg-[var(--dash-card)] px-3 py-2 text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:border-[var(--dash-primary)] focus:ring-[var(--dash-primary)] focus:outline-none sm:text-sm"
							placeholder="Repeat your password"
						/>
					</div>
				</div>

				<div>
					<button
						type="submit"
						disabled={loading}
						class="flex w-full justify-center rounded-md border border-transparent bg-[var(--dash-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--dash-primary-hover)] focus:ring-2 focus:ring-[var(--dash-primary)] focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if loading}
							<Spinner size="w-4 h-4" class="mr-2" />
							Creating account...
						{:else}
							Activate Account
						{/if}
					</button>
				</div>
			</form>
		{/if}
	</div>
</div>
