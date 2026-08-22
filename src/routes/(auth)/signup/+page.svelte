<script lang="ts">
	import { authClient } from '$lib/auth-client';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';
	import Spinner from '$lib/components/Spinner.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let loading = $state(false);

	/**
	 * The Turnstile token, refreshed by the widget.
	 *
	 * This is a convenience, not the protection — the token is checked on the
	 * signup endpoint itself (see `hooks.before` in server/auth/better-auth.ts),
	 * so a caller that skips this page gets rejected there rather than here.
	 */
	let turnstileToken = $state('');
	let turnstileContainer: HTMLElement | undefined = $state();

	// A token is single-use and expires; Cloudflare's widget re-issues on its
	// own, but a failed submit must not leave a spent one sitting in state.
	function resetTurnstile() {
		turnstileToken = '';
		const turnstile = (window as unknown as { turnstile?: { reset: () => void } }).turnstile;
		turnstile?.reset();
	}

	onMount(() => {
		if (!data.turnstileEnabled) return;

		const render = () => {
			const turnstile = (
				window as unknown as {
					turnstile?: { render: (el: HTMLElement, opts: Record<string, unknown>) => void };
				}
			).turnstile;
			if (!turnstile || !turnstileContainer) return;
			turnstile.render(turnstileContainer, {
				sitekey: data.turnstileSiteKey,
				callback: (token: string) => (turnstileToken = token),
				'error-callback': () => (turnstileToken = ''),
				'expired-callback': () => (turnstileToken = '')
			});
		};

		if ((window as unknown as { turnstile?: unknown }).turnstile) {
			render();
			return;
		}
		const script = document.createElement('script');
		script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
		script.async = true;
		script.defer = true;
		script.onload = render;
		document.head.appendChild(script);
	});

	async function handleSubmit(e: Event) {
		e.preventDefault();
		error = '';

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		loading = true;

		try {
			const result = await authClient.signUp.email(
				{ name, email, password },
				// Sent as a header rather than a body field: better-auth validates
				// the signup body against the user model, and a captcha nonce has no
				// business being on it.
				{ headers: { 'x-turnstile-token': turnstileToken } }
			);

			if (result.error) {
				error = result.error.message || 'Signup failed';
				resetTurnstile();
				return;
			}

			goto(resolve('/signup/pending'));
		} catch (err) {
			error = err instanceof Error ? err.message : 'An error occurred';
			resetTurnstile();
		} finally {
			loading = false;
		}
	}
</script>

<svelte:head>
	<title>Join - Smart Job Seeker</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-[var(--dash-bg)] px-4 py-12 transition-colors sm:px-6 lg:px-8"
>
	<div class="w-full max-w-md space-y-8">
		<div>
			<h2 class="mt-6 text-center text-3xl font-extrabold text-[var(--dash-text)]">
				Join Smart Job Seeker
			</h2>
			<p class="mt-2 text-center text-sm text-[var(--dash-text-secondary)]">
				Already have an account?
				<a
					href={resolve('/login')}
					class="font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
				>
					Sign in
				</a>
			</p>
		</div>

		<form method="POST" class="mt-8 space-y-6" onsubmit={handleSubmit}>
			{#if error}
				<div class="rounded-md bg-[var(--dash-error-light)] p-4">
					<p class="text-sm text-[var(--dash-error)]">{error}</p>
				</div>
			{/if}

			<div class="space-y-4">
				<div>
					<label for="name" class="block text-sm font-medium text-[var(--dash-text)]">Name</label>
					<input
						id="name"
						name="name"
						type="text"
						autocomplete="name"
						bind:value={name}
						required
						class="mt-1 block w-full rounded-md border border-[var(--dash-border-input)] bg-[var(--dash-card)] px-3 py-2 text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:border-[var(--dash-primary)] focus:ring-[var(--dash-primary)] focus:outline-none sm:text-sm"
						placeholder="Your name"
					/>
				</div>
				<div>
					<label for="email" class="block text-sm font-medium text-[var(--dash-text)]">Email</label>
					<input
						id="email"
						name="email"
						type="email"
						autocomplete="email"
						bind:value={email}
						required
						class="mt-1 block w-full rounded-md border border-[var(--dash-border-input)] bg-[var(--dash-card)] px-3 py-2 text-[var(--dash-text)] placeholder-[var(--dash-text-muted)] focus:border-[var(--dash-primary)] focus:ring-[var(--dash-primary)] focus:outline-none sm:text-sm"
						placeholder="you@example.com"
					/>
				</div>
				<div>
					<label for="password" class="block text-sm font-medium text-[var(--dash-text)]"
						>Password</label
					>
					<input
						id="password"
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
					<label for="confirm-password" class="block text-sm font-medium text-[var(--dash-text)]"
						>Confirm password</label
					>
					<input
						id="confirm-password"
						name="confirm-password"
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

			{#if data.turnstileEnabled}
				<div class="flex justify-center" bind:this={turnstileContainer}></div>
			{/if}

			<div>
				<button
					type="submit"
					disabled={loading || (data.turnstileEnabled && !turnstileToken)}
					class="flex w-full justify-center rounded-md border border-transparent bg-[var(--dash-primary)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--dash-primary-hover)] focus:ring-2 focus:ring-[var(--dash-primary)] focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
				>
					{#if loading}
						<Spinner size="w-4 h-4" class="mr-2" />
						Creating account...
					{:else}
						Join
					{/if}
				</button>
			</div>
		</form>
	</div>
</div>
