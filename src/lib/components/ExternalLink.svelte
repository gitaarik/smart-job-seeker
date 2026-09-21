<script lang="ts">
	/*
	 * A link to a URL that came from outside the app: a scraped job posting, a
	 * platform's own site, a tunnel live-view, a link the user typed into their
	 * own profile, a blob download. None of those are routes, so `resolve()`
	 * does not apply to them and svelte/no-navigation-without-resolve has
	 * nothing it can check.
	 *
	 * Saying that once here beats repeating it at every call site, and it turns
	 * the mark inside out: a call site now declares what the link IS rather than
	 * carrying a comment about what the linter cannot prove it is not.
	 *
	 * `target` and `rel` default to opening safely in a new tab, which is what
	 * every caller wanted anyway; pass either one to override it.
	 */
	/* eslint-disable svelte/no-navigation-without-resolve */
	import type { Snippet } from 'svelte';
	import type { HTMLAnchorAttributes } from 'svelte/elements';

	interface Props extends Omit<HTMLAnchorAttributes, 'href'> {
		/**
		 * The external URL. Not a route, and not resolved.
		 *
		 * Nullable because the callers are: a certificate link, an employer
		 * website and a project URL are all optional columns. A missing one
		 * renders the children with no href, exactly as the bare `<a>` did.
		 */
		href: string | null | undefined;
		children: Snippet;
	}

	let { href, children, target = '_blank', rel = 'noopener noreferrer', ...rest }: Props = $props();

	/**
	 * Schemes that are safe to put in an href we did not write.
	 *
	 * Most of what reaches this component is typed by a user into their own
	 * profile (a certificate link, an employer website) or scraped from a job
	 * board, and profile documents render on public pages. `javascript:` and
	 * `data:` in an href both execute on click, so the scheme is checked here
	 * rather than trusted at 27 call sites.
	 */
	const SAFE_SCHEMES = ['http:', 'https:', 'mailto:', 'tel:'];

	/**
	 * The href to render, or `undefined` to render no href at all.
	 *
	 * An unusable scheme degrades to inert text rather than to `#`: a link that
	 * silently goes nowhere reads as a bug in the page, where plain text reads
	 * as what it is, a URL we would not follow.
	 */
	const safeHref = $derived.by(() => {
		if (!href) return undefined;
		try {
			return SAFE_SCHEMES.includes(new URL(href, 'https://invalid.example/').protocol)
				? href
				: undefined;
		} catch {
			return undefined;
		}
	});
</script>

<a href={safeHref} {target} {rel} {...rest}>{@render children()}</a>
