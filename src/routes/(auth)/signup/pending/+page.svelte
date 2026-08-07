<svelte:head>
	<title>Pending Approval - Smart Job Seeker</title>
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

		<p class="text-[var(--dash-text-secondary)]">
			Your account has been created and is pending approval. You'll receive an email once your
			account has been activated.
		</p>

		<a
			href="/"
			class="inline-block text-sm font-medium text-[var(--dash-primary)] hover:text-[var(--dash-primary-hover)]"
			>Back to homepage</a
		>
	</div>
</div>
