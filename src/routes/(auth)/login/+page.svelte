<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	// Sign-in runs entirely in the client (better-auth has no server action
	// here), so before hydration the submit button has no handler. A click that
	// landed in that window triggered the browser's own form submission — a
	// plain POST to /login, a page route with no actions, which answers 405 and
	// drops the user on an error page. Gate the button on hydration instead:
	// $effect only runs client-side, so this stays false through SSR.
	let hydrated = $state(false);
	$effect(() => {
		hydrated = true;
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';
		loading = true;

		try {
			const result = await authClient.signIn.email({
				email,
				password
			});

			if (result.error) {
				error = result.error.message || 'Login failed';
				return;
			}

			// Redirect to the intended page or dashboard
			goto(data.redirectTo || '/home');
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Sign In - Smart Job Seeker</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-[var(--dash-bg)] px-4 py-12 transition-colors sm:px-6 lg:px-8"
>
	<div class="w-full max-w-md space-y-8">
		<div>
			<h2 class="mt-6 text-center text-3xl font-extrabold text-[var(--dash-text)]">
				Sign in to your account
			</h2>
		</div>

		<!-- No method="POST": submission is handled in JS, and a native POST here
         would only ever 405. Without it a stray submit re-renders the page. -->
		<form class="mt-8 space-y-6" onsubmit={handleSubmit}>
			{#if error}
				<div class="rounded-md bg-red-50 p-4">
					<p class="text-sm text-red-700">{error}</p>
				</div>
			{/if}

			<div class="-space-y-px rounded-md shadow-sm">
				<div>
					<label for="email" class="sr-only">Email address</label>
					<input
						id="email"
						type="email"
						autocomplete="email"
						bind:value={email}
						required
						class="relative block w-full appearance-none rounded-none rounded-t-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] transition-colors focus:z-10 focus:border-[var(--dash-primary)] focus:ring-[var(--dash-primary)] focus:outline-none sm:text-sm"
						placeholder="Email address"
					/>
				</div>
				<div>
					<label for="password" class="sr-only">Password</label>
					<input
						id="password"
						type="password"
						autocomplete="current-password"
						bind:value={password}
						required
						class="relative block w-full appearance-none rounded-none rounded-b-md border border-[var(--dash-border)] bg-[var(--dash-card)] px-3 py-2 text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] transition-colors focus:z-10 focus:border-[var(--dash-primary)] focus:ring-[var(--dash-primary)] focus:outline-none sm:text-sm"
						placeholder="Password"
					/>
				</div>
			</div>

			<div class="flex items-center justify-between">
				<div class="text-sm">
					<a
						href="/forgot-password"
						class="font-medium text-[var(--dash-primary)] hover:opacity-80"
					>
						Forgot your password?
					</a>
				</div>
			</div>

			<div>
				<button
					type="submit"
					disabled={loading || !hydrated}
					class="group relative flex w-full justify-center rounded-md border border-transparent bg-[var(--dash-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--dash-primary-hover)] focus:ring-2 focus:ring-[var(--dash-primary)] focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						<Spinner size="w-4 h-4" class="mr-2" />
						Signing in...
					{:else}
						Sign in
					{/if}
				</button>
			</div>
		</form>

		<p class="text-center text-sm text-[var(--dash-text-muted)]">
			Smart Job Seeker is currently in invite-only beta.
		</p>
	</div>
</div>
