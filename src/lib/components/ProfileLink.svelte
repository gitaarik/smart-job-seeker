<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import type { IconProp } from "@fortawesome/fontawesome-svg-core";

  let elLink: HTMLElement;

  export let icon: IconProp;
  export let href: string = "";
  export let title: string = "";

  function handleClick() {
    elLink.blur();
  }
</script>

<a
  {href}
  target="_blank"
  {title}
  class="flex justify-end items-center gap-2 hover:text-white hover:underline focus:text-aqua transition text-nowrap"
  bind:this={elLink}
  on:click={handleClick}
>
  <FontAwesomeIcon
    {icon}
    {title}
    class="w-3 hover:text-white focus:text-white transition"
  />

  <span>
    {title}
  </span>
</a>
