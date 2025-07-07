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
  class="text-l text-5xl hover:text-[var(--highlight-color)] focus:text-[var(--highlight-color)] transition"
  bind:this={elLink}
  on:click={handleClick}
>
  <FontAwesomeIcon
    {icon}
    alt={`${title} icon`}
    class="scale-100 hover:scale-110 focus:text-6xl hover:text-[var(--highlight-color)] focus:text-[var(--highlight-color)] transition"
  />
</a>
