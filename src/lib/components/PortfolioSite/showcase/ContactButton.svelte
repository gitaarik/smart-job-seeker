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
	import {
		faCircleNotch,
		faComments,
		faEnvelope,
		faPhone,
		faTimes
	} from '@fortawesome/free-solid-svg-icons';
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
	class="relative flex w-full flex-col items-center rounded-xl transition-all duration-250"
	class:max-w-[523px]={expandButton}
	class:max-w-[220px]={!expandButton}
>
	<div
		class="inline-flex w-full scale-100 items-center gap-2 bg-(--pf-bright) text-xl font-semibold text-(--pf-text-on-dark) transition-all duration-250 {expandButton
			? 'rounded-t-lg'
			: 'cursor-pointer rounded-lg focus-within:scale-105 focus-within:bg-(--pf-bright-hover) hover:scale-105 hover:bg-(--pf-bright-hover)'}"
	>
		<button
			type="button"
			class="block w-full px-8 py-4"
			class:cursor-pointer={!expandButton}
			aria-expanded={expandContent}
			onclick={open}
		>
			<span class="inline-flex">
				<FontAwesomeIcon icon={faComments} class="mt-1 mr-3 h-5 w-6" />
				<span class="text-nowrap">Get in Touch</span>
			</span>
		</button>

		{#if expandContent}
			<button
				type="button"
				class="absolute top-[14px] right-4 cursor-pointer text-2xl transition hover:rotate-90"
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
			class="flex w-full flex-col overflow-hidden rounded-b-xl border-r-2 border-b-2 border-l-2 border-(--pf-bright) pb-4 {panelClass}"
			transition:slide={{ duration: SPEED }}
		>
			{#if intro}
				<p class="max-w-[520px] self-center p-6 text-center whitespace-pre-line">{intro}</p>
			{:else}
				<div class="h-6"></div>
			{/if}

			<div class="flex h-full flex-col items-center">
				{#if contact.details}
					<div
						class="flex w-full place-content-evenly gap-6 px-4 text-center max-[30rem]:flex-col min-[30rem]:gap-4"
					>
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
						<div class="px-4 text-center text-(--pf-error) min-[50rem]:px-8">
							<p>
								Human verification failed. Please refresh<br />
								the page and try again, or check your ad blocker.
							</p>
							<p class="mt-2">
								Make sure external scripts from<br />
								challenges.cloudflare.com are allowed.
							</p>
						</div>
					{:else if contact.loading}
						<div class="flex items-center">
							<FontAwesomeIcon icon={faCircleNotch} spin class="mr-2" />
							<span>Loading human verification</span>
						</div>
					{/if}
					<div class="flex h-full w-full flex-col items-center justify-center">
						<div bind:this={widget}></div>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>
