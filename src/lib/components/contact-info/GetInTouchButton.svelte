<script lang="ts">
  import { track } from "$lib/tools/analytics";
  import { faComments, faTimes } from "@fortawesome/free-solid-svg-icons";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { fade, slide } from "svelte/transition";
  import ContactInfo from "./ContactInfo.svelte";

  interface Props {
    contentClass?: string;
    class?: string;
    email?: string | null;
    phone?: string | null;
    timezone?: string | null;
    signalProfile?: string | null;
    whatsappNumber?: string | null;
    telegramUsername?: string | null;
  }

  let {
    contentClass = "",
    class: classNames = "",
    email = null,
    phone = null,
    timezone = null,
    signalProfile = null,
    whatsappNumber = null,
    telegramUsername = null,
  }: Props = $props();

  const animationSpeed = 250;

  let containerEl: HTMLElement;
  let expandButton = $state(false);
  let expandContent = $state(false);

  function handleGetInTouch() {
    if (expandButton) return;

    expandButton = true;

    track("GetInTouch_open");

    setTimeout(() => {
      expandContent = true;
    }, animationSpeed);

    setTimeout(() => {
      if (
        containerEl.getBoundingClientRect().top > window.innerHeight / 2
      ) {
        containerEl.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    });
  }

  function handleCloseContactInfo() {
    track("GetInTouch_close");

    expandContent = false;
    setTimeout(() => {
      expandButton = false;
    }, animationSpeed);
  }

  const containerStyle = $derived(
    expandButton ? "max-w-[523px]" : "max-w-[220px]",
  );

  const buttonStyle = $derived(expandButton ? "" : "cursor-pointer");

  const buttonContainerStyle = $derived(
    expandButton
      ? "max-w-[523px] rounded-t-lg"
      : "max-w-[220px] rounded-lg cursor-pointer hover:bg-aqua focus:bg-aqua hover:scale-105 focus:scale-105",
  );
</script>

<div
  class="flex flex-col items-center rounded-xl relative w-full transition-all duration-{animationSpeed} {containerStyle} {classNames}"
  bind:this={containerEl}
>
  <div
    class="inline-flex items-center gap-2 bg-ocean text-white text-xl font-semibold text-pearl w-full scale-100 transition-all duration-{animationSpeed} {buttonContainerStyle}"
  >
    <button
      class="py-4 px-8 block w-full {buttonStyle}"
      onclick={handleGetInTouch}
    >
      <div class="inline-flex">
        <FontAwesomeIcon icon={faComments} class="w-6 h-5 mr-3 mt-1" />

        <span class="text-nowrap">
          Get in Touch
        </span>
      </div>
    </button>

    {#if expandContent}
      <button
        class="absolute right-4 top-[14px] cursor-pointer text-2xl hover:rotate-90 transition"
        onclick={handleCloseContactInfo}
        transition:fade
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
    {/if}
  </div>

  {#if expandContent}
    <div
      class="flex flex-col pb-4 w-full border-r-2 border-b-2 border-l-2 rounded-b-xl border-ocean transition-all duration-{animationSpeed} overflow-hidden {contentClass}"
      transition:slide={{ duration: animationSpeed }}
    >
      <p class="p-6 self-center text-center max-w-[520px]">
        I'd love to hear about your project and discuss how we can bring your
        ideas to life together. Don't hesitate to reach out!
      </p>

      <ContactInfo
        {email}
        {phone}
        {timezone}
        {signalProfile}
        {whatsappNumber}
        {telegramUsername}
      />
    </div>
  {/if}
</div>
