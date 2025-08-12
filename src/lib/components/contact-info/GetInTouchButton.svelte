<script lang="ts">
  import { track } from "$lib/tools/analytics";
  import { faComments, faTimes } from "@fortawesome/free-solid-svg-icons";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { slide } from "svelte/transition";
  import ContactInfo from "./ContactInfo.svelte";

  let showGetInTouch = false;

  let containerEl: HTMLElement;

  function handleGetInTouch() {
    if (showGetInTouch) return;
    showGetInTouch = true;

    track("GetInTouch_open");

    setTimeout(() => {
      containerEl.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    });
  }

  function handleCloseContactInfo() {
    track("GetInTouch_close");
    showGetInTouch = false;
  }

  let containerStyle: string = "";
  let buttonStyle: string = "";
  let buttonContainerStyle: string = "";

  $: {
    if (showGetInTouch) {
      containerStyle = "border-y-2 border-x-2 border-[var(--bright-color)]";
      buttonStyle = "";
      buttonContainerStyle = "rounded-t-lg";
    } else {
      containerStyle = "w-[220px]";
      buttonStyle = "cursor-pointer";
      buttonContainerStyle =
        "rounded-lg cursor-pointer hover:bg-[var(--bright-highlight-color)] focus:bg-[var(--bright-highlight-color)] scale-100 hover:scale-105 focus:scale-105 text-[var(--text-light-color)]";
    }
  }

  let classNames: string = "";
  export { classNames as class };
</script>

<div
  class="flex flex-col max-w-[600px] rounded-xl relative {containerStyle} {classNames}"
  bind:this={containerEl}
>
  <div
    class="inline-flex items-center gap-2 bg-[var(--bright-color)] text-white text-xl font-semibold {buttonContainerStyle}"
  >
    <button
      class="py-4 px-8 block w-full {buttonStyle}"
      on:click={handleGetInTouch}
    >
      <FontAwesomeIcon icon={faComments} />

      <span class="text-nowrap">
        Get in Touch
      </span>
    </button>

    {#if showGetInTouch}
      <button
        class="absolute right-4 top-[14px] cursor-pointer text-2xl"
        on:click={handleCloseContactInfo}
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
    {/if}
  </div>

  {#if showGetInTouch}
    <div class="min-h-[170px] mb-4" transition:slide={{ duration: 300 }}>
      <p class="p-6 self-center text-center max-w-[520px]">
        I'd love to hear about your project and discuss how we can bring your
        ideas to life together. Don't hesitate to reach out!
      </p>

      <ContactInfo />
    </div>
  {/if}
</div>
