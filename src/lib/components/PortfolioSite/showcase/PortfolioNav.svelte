<script lang="ts">
	/**
	 * The way between the site's two pages, for a visitor who may open both:
	 * the owner, and whoever holds the key a portfolio link left in their
	 * browser (server/profile/portfolio-key.ts). Everyone else sees one page
	 * and no menu, so the private page is not even named to them.
	 *
	 * Top left, across from the scheme switcher, whose label opens leftwards.
	 * On the page's own surface rather than the switcher's glass: it carries
	 * words, which glass over the dark quotes band left hard to read.
	 */
	interface Props {
		page: 'home' | 'cv';
		homeHref: string;
		cvHref: string;
	}

	let { page, homeHref, cvHref }: Props = $props();

	// Both hrefs are built by the page's load: the site's own routes, with the
	// visitor's query (see portfolioHrefs in server/profile/portfolio-pages.ts).
	const links = $derived([
		{ href: homeHref, label: 'Home', current: page === 'home' },
		{ href: cvHref, label: 'Full CV', current: page === 'cv' }
	]);
</script>

<nav
	class="fixed top-4 left-4 z-50 flex items-center gap-1 rounded-3xl border border-(--pf-line) bg-(--pf-surface-raised)/85 p-1 shadow backdrop-blur-md print:hidden"
	aria-label="Pages"
>
	{#each links as link (link.label)}
		<!-- eslint-disable svelte/no-navigation-without-resolve -- built by the load, query included -->
		<a
			href={link.href}
			aria-current={link.current ? 'page' : undefined}
			class="rounded-3xl px-4 py-2 text-sm font-semibold transition-colors {link.current
				? 'bg-(--pf-bright) text-white'
				: 'text-(--pf-strong) hover:text-(--pf-accent-text)'}">{link.label}</a
		>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/each}
</nav>
