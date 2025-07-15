<script lang="ts">
  import { track } from "$lib/tools/analytics";
  import { faComments, faTimes } from "@fortawesome/free-solid-svg-icons";
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import ContactInfo from "./ContactInfo.svelte";

  let showGetInTouch = false;

  let containerEl: HTMLElement;

  function handleGetInTouch() {
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
</script>

<div bind:this={containerEl}>
  {#if showGetInTouch}
    <div
      class="pb-4 flex flex-col bg-[var(--lighter-bg-color)] w-full max-w-[600px] rounded-xl border-y-2 border-x-2 border-[var(--bright-color)] relative"
    >
      <div class="text-[var(--text-light-color)]">
        <button
          class="absolute right-4 top-[10px] cursor-pointer text-2xl"
          on:click={handleCloseContactInfo}
        >
          <FontAwesomeIcon icon={faTimes} />
        </button>

        <h3
          class="text-center text-xl font-semibold py-3 px-8 bg-[var(--bright-color)] rounded-t-lg"
        >
          <FontAwesomeIcon icon={faComments} />
          <span class="text-nowrap">
            Get in Touch
          </span>
        </h3>
      </div>

      <p class="p-6 self-center text-center max-w-[520px]">
        I'd love to hear about your project and discuss how we can bring your
        ideas to life together—don't hesitate to reach out!
      </p>

      <ContactInfo />
    </div>
  {:else}
    <div class="text-center">
      <button
        class="inline-flex items-center gap-2 bg-[var(--bright-color)] text-white py-4 px-8 rounded-lg text-xl font-semibold cursor-pointer hover:bg-[var(--bright-highlight-color)] focus:bg-[var(--bright-highlight-color)] scale-100 hover:scale-105 focus:scale-105 transition"
        on:click={handleGetInTouch}
      >
        <FontAwesomeIcon icon={faComments} />

        <span class="text-nowrap">
          Get in Touch
        </span>
      </button>
    </div>
  {/if}
</div>
