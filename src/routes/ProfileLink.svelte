<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";

  let elLink: HTMLElement;

  export let icon: object;
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
  class="flex justify-end items-center gap-2 hover:text-white hover:underline focus:text-[var(--highlight-color)] transition text-nowrap"
  bind:this={elLink}
  on:click={handleClick}
>
  <FontAwesomeIcon
    {icon}
    alt={`${title} icon`}
    class="hover:text-white focus:text-white transition"
  />

  <span>
    {title}
  </span>
</a>
