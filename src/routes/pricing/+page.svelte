<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const price = (cents: number) => (cents === 0 ? 'Free' : `€${(cents / 100).toFixed(0)}`);

	const limit = (n: number, unit: string) =>
		n === -1 ? `Unlimited ${unit}` : `${n.toLocaleString()} ${unit}`;

	const bytes = (n: number) =>
		n === -1 ? 'Unlimited storage' : `${Math.round(n / 1024 / 1024)} MB of documents`;

	// The plan people land on. With four plans the third is the intended
	// default; with one (the self-hosted OSS build) there is nothing to feature.
	const featured = $derived(data.plans.length > 2 ? data.plans[2].id : null);
</script>

<svelte:head>
	<title>Pricing - Smart Job Seeker</title>
	<meta
		name="description"
		content="Plans for finding, matching and applying to jobs — from free to unlimited."
	/>
</svelte:head>

<main class="min-h-screen bg-[var(--dash-bg)] px-6 py-16 text-[var(--dash-text)] transition-colors">
	<div class="mx-auto max-w-6xl">
		<header class="text-center">
			<h1 class="text-3xl font-bold sm:text-4xl">Pricing</h1>
			<p class="mx-auto mt-4 max-w-2xl text-[var(--dash-text-secondary)]">
				Every plan includes the whole product — profiles, tailored CVs, application tracking,
				interview prep. What differs is how much AI work you can put through it each month.
			</p>
		</header>

		<div
			class="mt-12 grid gap-6 {data.plans.length > 1
				? 'sm:grid-cols-2 lg:grid-cols-4'
				: 'mx-auto max-w-md'}"
		>
			{#each data.plans as plan (plan.id)}
				<div
					class="flex flex-col rounded-xl border p-6 transition-colors"
					style="background-color: var(--dash-card); border-color: {plan.id === featured
						? 'var(--dash-primary)'
						: 'var(--dash-border)'};"
				>
					<h2 class="text-lg font-semibold">{plan.name}</h2>
					<p class="mt-1 min-h-10 text-sm text-[var(--dash-text-secondary)]">
						{plan.description}
					</p>

					<p class="mt-4">
						<span class="text-3xl font-bold">{price(plan.priceMonthly)}</span>
						{#if plan.priceMonthly > 0}
							<span class="text-sm text-[var(--dash-text-secondary)]">/month</span>
						{/if}
					</p>

					<ul class="mt-6 space-y-2 text-sm text-[var(--dash-text-secondary)]">
						<li>{limit(plan.limits.creditsPerMonth, 'credits per month')}</li>
						<li>{limit(plan.limits.profiles, 'profiles')}</li>
						<li>{limit(plan.limits.resumeVersions, 'CV versions')}</li>
						<li>{limit(plan.limits.maxDocumentProjects, 'document projects')}</li>
						<li>{bytes(plan.limits.maxDocumentBytes)}</li>
						{#if plan.limits.extraCredits}
							<li>Top up with extra credits any time</li>
						{/if}
					</ul>

					{#if plan.usageExample.length}
						<div
							class="mt-6 rounded-lg p-3 text-xs text-[var(--dash-text-secondary)]"
							style="background-color: var(--dash-bg-secondary);"
						>
							<p class="mb-1 font-medium text-[var(--dash-text)]">Roughly enough for</p>
							<ul class="space-y-1">
								{#each plan.usageExample as example (example)}
									<li>{example}</li>
								{/each}
							</ul>
						</div>
					{/if}

					<a
						href={resolve(
							data.signedIn ? '/billing' : data.registrationOpen ? '/signup' : '/login'
						)}
						class="mt-6 inline-flex justify-center rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
						style={plan.id === featured
							? 'background-color: var(--dash-primary); color: white;'
							: 'border: 1px solid var(--dash-border); color: var(--dash-text);'}
					>
						{data.signedIn
							? 'Choose plan'
							: data.registrationOpen
								? 'Join the waitlist'
								: 'Sign in'}
					</a>
				</div>
			{/each}
		</div>

		{#if data.costExamples.length}
			<section class="mt-16">
				<h2 class="text-xl font-semibold">What a credit buys</h2>
				<p class="mt-2 text-sm text-[var(--dash-text-secondary)]">
					Credits are spent on the work that costs us money to run — importing and scoring jobs, and
					generating or revising text. Tracking applications, editing your profile and exporting a
					CV you have already made are free. These are averages, not prices.
				</p>
				<div class="mt-6 overflow-x-auto">
					<table class="w-full min-w-md text-left text-sm">
						<thead class="text-[var(--dash-text-secondary)]">
							<tr class="border-b" style="border-color: var(--dash-border);">
								<th class="py-2 pr-4 font-medium">Task</th>
								<th class="py-2 pr-4 font-medium">Credits</th>
								<th class="py-2 font-medium">Notes</th>
							</tr>
						</thead>
						<tbody>
							{#each data.costExamples as example (example.label)}
								<tr class="border-b last:border-0" style="border-color: var(--dash-border);">
									<td class="py-2 pr-4">{example.label}</td>
									<td class="py-2 pr-4 tabular-nums">{example.avgCredits.toLocaleString()}</td>
									<td class="py-2 text-[var(--dash-text-secondary)]">{example.note}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</section>
		{/if}

		{#if data.creditPacks.length}
			<section class="mt-12">
				<h2 class="text-xl font-semibold">Running out?</h2>
				<p class="mt-2 text-sm text-[var(--dash-text-secondary)]">
					{#each data.creditPacks as pack (pack.name)}
						{pack.credits.toLocaleString()} extra credits for €{(pack.priceCents / 100).toFixed(2)},
						on any paid plan. They don't expire at the end of the month.
					{/each}
				</p>
			</section>
		{/if}

		<footer class="mt-16 border-t pt-8 text-center" style="border-color: var(--dash-border);">
			<p class="text-sm text-[var(--dash-text-secondary)]">
				Questions? <a class="underline" href={resolve('/guide')}>Read the guide</a> or
				<a class="underline" href={resolve('/')}>go back home</a>.
			</p>
		</footer>
	</div>
</main>
