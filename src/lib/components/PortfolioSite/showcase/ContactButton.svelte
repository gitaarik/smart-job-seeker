<script lang="ts">
	/**
	 * "Get in touch": a button that opens into the contact details, once
	 * Cloudflare Turnstile has passed the visitor.
	 *
	 * Ported from the standalone site's GetInTouchButton and ContactInfo. The
	 * difference is where the details come from: there they were constants in
	 * the bundle, so the check decided only whether to show what the page
	 * already held. Here the page does not hold them (see
	 * server/profile/portfolio-contact.ts); a passing token is sent to
	 * `/p/[slug]/portfolio/contact`, which verifies it and answers with them.
	 *
	 * Every button on the page shares one ContactState, so passing the check
	 * once opens every one of them.
	 */
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { faCircleNotch, faEnvelope, faPhone, faTimes } from '@fortawesome/free-solid-svg-icons';
	import { fade, slide } from 'svelte/transition';
	import type { ContactState } from './contact-state.svelte';

	interface Props {
		state: ContactState;
		/** Plain text above the details. */
		intro?: string;
		/** Background of the opened panel, so it sits on whichever band it is in. */
		panelClass?: string;
		/** Which scheme the Turnstile widget should draw in. */
		scheme: 'light' | 'dark';
	}

	let { state: contact, intro, panelClass = '', scheme }: Props = $props();

	const SPEED = 250;

	let container: HTMLElement | undefined = $state();
	let widget: HTMLElement | undefined = $state();
	let expandButton = $state(false);
	let expandContent = $state(false);

	function open() {
		if (expandButton) return;
		expandButton = true;
		setTimeout(() => {
			expandContent = true;
		}, SPEED);
		setTimeout(() => {
			if (container && container.getBoundingClientRect().top > window.innerHeight / 2) {
				container.scrollIntoView({ behavior: 'smooth', block: 'center' });
			}
		});
	}

	function close() {
		expandContent = false;
		setTimeout(() => {
			expandButton = false;
		}, SPEED);
	}

	// The widget mounts once the panel has slid open and the container exists.
	$effect(() => {
		if (expandContent && widget && !contact.details) contact.challenge(widget, scheme);
	});

	const phoneHref = $derived(
		contact.details?.phone ? `tel:${contact.details.phone.replace(/\s+/g, '')}` : null
	);
</script>

<div
	bind:this={container}
	class="relative flex w-full flex-col items-center rounded-sm transition-all duration-250"
	class:max-w-[523px]={expandButton}
	class:max-w-[168px]={!expandButton}
>
	<div
		class="relative inline-flex w-full items-center bg-(--pf-bright) font-semibold text-(--pf-text-on-dark) transition-colors duration-200 {expandButton
			? 'rounded-t-sm'
			: 'cursor-pointer rounded-sm hover:bg-(--pf-bright-hover) has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-(--pf-bright)'}"
	>
		<button
			type="button"
			class="block w-full px-6 py-3 tracking-[0.005em] focus:outline-none"
			class:text-left={expandButton}
			class:text-center={!expandButton}
			class:cursor-pointer={!expandButton}
			aria-expanded={expandContent}
			onclick={open}
		>
			<span class="text-nowrap">Get in touch</span>
		</button>

		{#if expandContent}
			<button
				type="button"
				class="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer text-lg opacity-80 transition hover:opacity-100"
				aria-label="Close"
				onclick={close}
				transition:fade
			>
				<FontAwesomeIcon icon={faTimes} />
			</button>
		{/if}
	</div>

	{#if expandContent}
		<div
			class="flex w-full flex-col overflow-hidden rounded-b-sm border border-t-0 border-(--pf-line) pb-4 {panelClass}"
			transition:slide={{ duration: SPEED }}
		>
			{#if intro}
				<p class="max-w-[520px] p-6 whitespace-pre-line">{intro}</p>
			{:else}
				<div class="h-6"></div>
			{/if}

			<div class="flex h-full flex-col items-start">
				{#if contact.details}
					<div class="flex w-full gap-6 px-6 max-[30rem]:flex-col min-[30rem]:gap-12">
						{#if contact.details.phone}
							<div>
								<div class="mb-2 text-lg font-semibold">
									<FontAwesomeIcon icon={faPhone} class="mr-1" />
									Phone
								</div>
								<!-- eslint-disable svelte/no-navigation-without-resolve -- a tel: link, not a route -->
								<a href={phoneHref} class="underline hover:text-(--pf-highlight)"
									>{contact.details.phone}</a
								>
								<!-- eslint-enable svelte/no-navigation-without-resolve -->
								{#if contact.details.timezone}
									<p class="mt-2 text-sm">{contact.details.timezone}</p>
								{/if}
							</div>
						{/if}
						{#if contact.details.email}
							<div>
								<div class="mb-2 text-lg font-semibold">
									<FontAwesomeIcon icon={faEnvelope} class="mr-1" />
									Email
								</div>
								<a
									href="mailto:{contact.details.email}"
									class="underline hover:text-(--pf-highlight)">{contact.details.email}</a
								>
							</div>
						{/if}
					</div>
				{:else}
					{#if contact.failed}
						<div class="px-6 text-(--pf-error)">
							<p>
								Human verification failed. Please refresh the page and try again, or check your ad
								blocker.
							</p>
							<p class="mt-2">
								Make sure external scripts from challenges.cloudflare.com are allowed.
							</p>
						</div>
					{:else if contact.loading}
						<div class="flex items-center px-6">
							<FontAwesomeIcon icon={faCircleNotch} spin class="mr-2" />
							<span>Loading human verification</span>
						</div>
					{/if}
					<div class="flex h-full w-full flex-col items-start justify-center px-6">
						<div bind:this={widget}></div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
