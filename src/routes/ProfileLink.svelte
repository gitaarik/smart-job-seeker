<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";

  export let icon: object;
  export let href: string = "";
  export let title: string = "";
</script>

<a {href} target="_blank" {title} class="text-l text-nowrap underline text-5xl">
  <FontAwesomeIcon
    {icon}
    alt={`${title} icon`}
    class="scale-100 hover:scale-115 transition"
  />
</a>
