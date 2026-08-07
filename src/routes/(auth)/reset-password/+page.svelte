<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let password = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let success = $state(false);
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		if (!data.token) {
			error = 'Invalid or missing reset token';
			return;
		}

		loading = true;

		try {
			const result = await authClient.resetPassword({
				newPassword: password,
				token: data.token
			});

			if (result.error) {
				error = result.error.message || 'Failed to reset password';
				return;
			}

			success = true;
			// Redirect to login after a short delay
			setTimeout(() => goto('/login'), 2000);
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Reset Password - Smart Job Seeker</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-[var(--dash-bg)] px-4 py-12 transition-colors sm:px-6 lg:px-8"
>
	<div class="w-full max-w-md space-y-8">
		<div>
			<h2 class="mt-6 text-center text-3xl font-extrabold text-[var(--dash-text)]">
				Set new password
			</h2>
			<p class="mt-2 text-center text-sm text-[var(--dash-text-secondary)]">
				Enter your new password below.
			</p>
		</div>

		{#if !data.token}
			<div class="rounded-md bg-red-50 p-4">
				<p class="text-sm text-red-700">
					Invalid or missing reset token. Please request a new password reset link.
				</p>
			</div>
			<div class="text-center">
				<a
					href="/forgot-password"
					class="font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
				>
					Request new reset link
				</a>
			</div>
		{:else if success}
			<div class="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
				<p class="text-sm text-green-700 dark:text-green-400">
					Your password has been reset successfully. Redirecting to sign in...
				</p>
			</div>
		{:else}
			<form class="mt-8 space-y-6" onsubmit={handleSubmit}>
				{#if error}
					<div class="rounded-md bg-red-50 p-4">
						<p class="text-sm text-red-700">{error}</p>
					</div>
				{/if}

				<div class="-space-y-px rounded-md shadow-sm">
					<div>
						<label for="password" class="sr-only">New password</label>
						<input
							id="password"
							name="password"
							type="password"
							autocomplete="new-password"
							bind:value={password}
							required
							minlength="8"
							class="relative block w-full appearance-none rounded-none rounded-t-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] transition-colors focus:z-10 focus:border-[var(--dash-primary)] focus:ring-[var(--dash-primary)] focus:outline-none sm:text-sm"
							placeholder="New password (min 8 characters)"
						/>
					</div>
					<div>
						<label for="confirmPassword" class="sr-only">Confirm new password</label>
						<input
							id="confirmPassword"
							name="confirmPassword"
							type="password"
							autocomplete="new-password"
							bind:value={confirmPassword}
							required
							minlength="8"
							class="relative block w-full appearance-none rounded-none rounded-b-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] transition-colors focus:z-10 focus:border-[var(--dash-primary)] focus:ring-[var(--dash-primary)] focus:outline-none sm:text-sm"
							placeholder="Confirm new password"
						/>
					</div>
				</div>

				<div>
					<button
						type="submit"
						disabled={loading}
						class="group relative flex w-full justify-center rounded-md border border-transparent bg-[var(--dash-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--dash-primary-hover)] focus:ring-2 focus:ring-[var(--dash-primary)] focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if loading}
							Resetting...
						{:else}
							Reset password
						{/if}
					</button>
				</div>
			</form>
		{/if}
	</div>
</div>
