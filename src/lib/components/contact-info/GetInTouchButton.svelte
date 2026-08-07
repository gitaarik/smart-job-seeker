<script lang="ts">
	import { track } from '$lib/tools/analytics';
	import { faComments, faTimes } from '@fortawesome/free-solid-svg-icons';
	import { FontAwesomeIcon } from '@fortawesome/svelte-fontawesome';
	import { fade, slide } from 'svelte/transition';
	import ContactInfo from './ContactInfo.svelte';

	interface Profile {
		email_address?: string | null;
		phone_number?: string | null;
		location_timezone?: string | null;
		signal_profile?: string | null;
		whatsapp_number?: string | null;
		telegram_username?: string | null;
	}

	interface Props {
		contentClass?: string;
		class?: string;
		profile: Profile;
	}

	let { contentClass = '', class: classNames = '', profile }: Props = $props();

	const animationSpeed = 250;

	let containerEl: HTMLElement;
	let expandButton = $state(false);
	let expandContent = $state(false);

	function handleGetInTouch() {
		if (expandButton) return;

		expandButton = true;

		track('GetInTouch_open');

		setTimeout(() => {
			expandContent = true;
		}, animationSpeed);

		setTimeout(() => {
			if (containerEl.getBoundingClientRect().top > window.innerHeight / 2) {
				containerEl.scrollIntoView({
					behavior: 'smooth',
					block: 'center'
				});
			}
		});
	}

	function handleCloseContactInfo() {
		track('GetInTouch_close');

		expandContent = false;
		setTimeout(() => {
			expandButton = false;
		}, animationSpeed);
	}

	const containerStyle = $derived(expandButton ? 'max-w-[523px]' : 'max-w-[220px]');

	const buttonStyle = $derived(expandButton ? '' : 'cursor-pointer');

	const buttonContainerStyle = $derived(
		expandButton
			? 'max-w-[523px] rounded-t-lg'
			: 'max-w-[220px] rounded-lg cursor-pointer hover:bg-aqua focus:bg-aqua hover:scale-105 focus:scale-105'
	);
</script>

<div
	class="relative flex w-full flex-col items-center rounded-xl transition-all duration-{animationSpeed} {containerStyle} {classNames}"
	bind:this={containerEl}
>
	<div
		class="bg-ocean text-pearl inline-flex w-full scale-100 items-center gap-2 text-xl font-semibold text-white transition-all duration-{animationSpeed} {buttonContainerStyle}"
	>
		<button class="block w-full px-8 py-4 {buttonStyle}" onclick={handleGetInTouch}>
			<div class="inline-flex">
				<FontAwesomeIcon icon={faComments} class="mt-1 mr-3 h-5 w-6" />

				<span class="text-nowrap"> Get in Touch </span>
			</div>
		</button>

		{#if expandContent}
			<button
				class="absolute top-[14px] right-4 cursor-pointer text-2xl transition hover:rotate-90"
				onclick={handleCloseContactInfo}
				transition:fade
			>
				<FontAwesomeIcon icon={faTimes} />
			</button>
		{/if}
	</div>

	{#if expandContent}
		<div
			class="border-ocean flex w-full flex-col rounded-b-xl border-r-2 border-b-2 border-l-2 pb-4 transition-all duration-{animationSpeed} overflow-hidden {contentClass}"
			transition:slide={{ duration: animationSpeed }}
		>
			<p class="max-w-[520px] self-center p-6 text-center">
				I'd love to hear about your project and discuss how we can bring your ideas to life
				together. Don't hesitate to reach out!
			</p>

			<ContactInfo {profile} />
		</div>
	{/if}
</div>
