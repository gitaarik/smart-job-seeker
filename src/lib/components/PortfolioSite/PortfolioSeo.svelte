<script lang="ts">
	/**
	 * The part of a public portfolio page's head that link previews and search
	 * engines read: canonical link, og:url, an absolute og:image and the Person.
	 * See $lib/portfolio-seo.ts. Both layouts print it; the private CV page,
	 * which is noindex, does not.
	 */
	import type { PortfolioThemeConfig } from '$lib/portfolio-themes';
	import { assetUrl } from '$lib/presentation-templates';
	import { absoluteUrl, personJsonLd, type PortfolioSeoUrls } from '$lib/portfolio-seo';

	interface Props {
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		profile: any;
		config: PortfolioThemeConfig;
		urls: PortfolioSeoUrls;
	}

	let { profile, config, urls }: Props = $props();

	const ogImage = $derived(
		absoluteUrl(assetUrl(config.assets?.ogImage) ?? profile.meta_image_url, urls.appUrl)
	);
	// The closing tag in two pieces, or it would end this component's own script block.
	const jsonLd = $derived(
		`<script type="application/ld+json">${personJsonLd(profile, config, urls)}<` + `/script>`
	);
</script>

<svelte:head>
	<link rel="canonical" href={urls.canonicalUrl} />
	<meta property="og:url" content={urls.canonicalUrl} />
	{#if ogImage}
		<meta property="og:image" content={ogImage} />
		<meta name="twitter:card" content="summary_large_image" />
	{/if}
	<!-- eslint-disable-next-line svelte/no-at-html-tags -- personJsonLd escapes `<` -->
	{@html jsonLd}
</svelte:head>
