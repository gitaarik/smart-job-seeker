<script lang="ts">
	import { authClient } from '$lib/auth-client';

	let email = $state('');
	let error = $state('');
	let success = $state(false);
	let loading = $state(false);

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			const result = await authClient.requestPasswordReset({
				email,
				redirectTo: '/reset-password'
			});

			if (result.error) {
				error = result.error.message || 'Failed to send reset email';
				return;
			}

			success = true;
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Forgot Password - Smart Job Seeker</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-[var(--dash-bg)] px-4 py-12 transition-colors sm:px-6 lg:px-8"
>
	<div class="w-full max-w-md space-y-8">
		<div>
			<h2 class="mt-6 text-center text-3xl font-extrabold text-[var(--dash-text)]">
				Reset your password
			</h2>
			<p class="mt-2 text-center text-sm text-[var(--dash-text-secondary)]">
				Enter your email and we'll send you a link to reset your password.
			</p>
		</div>

		{#if success}
			<div class="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
				<p class="text-sm text-green-700 dark:text-green-400">
					If an account exists with that email, we've sent you a password reset link. Check your
					inbox.
				</p>
			</div>
			<div class="text-center">
				<a
					href="/login"
					class="font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
				>
					Back to sign in
				</a>
			</div>
		{:else}
			<form class="mt-8 space-y-6" onsubmit={handleSubmit}>
				{#if error}
					<div class="rounded-md bg-red-50 p-4">
						<p class="text-sm text-red-700">{error}</p>
					</div>
				{/if}

				<div>
					<label for="email" class="sr-only">Email address</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						bind:value={email}
						required
						class="relative block w-full appearance-none rounded-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] transition-colors focus:z-10 focus:border-[var(--dash-primary)] focus:ring-[var(--dash-primary)] focus:outline-none sm:text-sm"
						placeholder="Email address"
					/>
				</div>

				<div>
					<button
						type="submit"
						disabled={loading}
						class="group relative flex w-full justify-center rounded-md border border-transparent bg-[var(--dash-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--dash-primary-hover)] focus:ring-2 focus:ring-[var(--dash-primary)] focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
					>
						{#if loading}
							Sending...
						{:else}
							Send reset link
						{/if}
					</button>
				</div>

				<div class="text-center">
					<a
						href="/login"
						class="font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
					>
						Back to sign in
					</a>
				</div>
			</form>
		{/if}
	</div>
</div>
