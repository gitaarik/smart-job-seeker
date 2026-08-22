<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<svelte:head>
	<title>Almost there - Smart Job Seeker</title>
</svelte:head>

<div
	class="flex min-h-screen items-center justify-center bg-[var(--dash-bg)] px-4 py-12 transition-colors sm:px-6 lg:px-8"
>
	<div class="w-full max-w-md space-y-6 text-center">
		<svg
			class="mx-auto h-12 w-12 text-[var(--dash-primary)]"
			viewBox="0 0 40 40"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
		>
			<circle cx="16" cy="16" r="12" stroke="currentColor" stroke-width="3" fill="none" />
			<line
				x1="25"
				y1="25"
				x2="36"
				y2="36"
				stroke="currentColor"
				stroke-width="4"
				stroke-linecap="round"
			/>
			<path
				d="M10 17l4 4 8-8"
				stroke="currentColor"
				stroke-width="3"
				stroke-linecap="round"
				stroke-linejoin="round"
				fill="none"
			/>
		</svg>

		<h2 class="text-2xl font-bold text-[var(--dash-text)]">Thanks for joining!</h2>

		<!--
			Two things stand between a new signup and the product, and both used to
			be invisible here: the address has to be verified (enforced since
			requireEmailVerification was turned on) and the account has to be
			approved. Naming them in order is the difference between waiting and
			wondering.
		-->
		<div class="space-y-4 text-left">
			<div class="flex gap-3">
				<span class="font-semibold text-[var(--dash-primary)]">1.</span>
				<p class="text-[var(--dash-text-secondary)]">
					<strong class="text-[var(--dash-text)]">Confirm your email address.</strong> We've sent you
					a link — you'll need to click it before you can sign in. Check your spam folder if it hasn't
					arrived in a few minutes.
				</p>
			</div>
			<div class="flex gap-3">
				<span class="font-semibold text-[var(--dash-primary)]">2.</span>
				<p class="text-[var(--dash-text-secondary)]">
					<strong class="text-[var(--dash-text)]">Wait for your place.</strong> We're letting people in
					gradually while we get the platform ready. You'll get an email the moment your account is activated
					— there's nothing else you need to do.
				</p>
			</div>
		</div>

		<a
			href={resolve('/')}
			class="inline-block text-sm font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
			>Back to homepage</a
		>
	</div>
</div>
