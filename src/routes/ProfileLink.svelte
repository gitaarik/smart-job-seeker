<script lang="ts">
  export let icon: string = "";
  export let href: string = "";
  export let title: string = "";
</script>

<a {href} target="_blank" {title} class="text-l text-nowrap underline">
  <img
    src={icon}
    alt="icon"
    class="h-10 w-10 scale-100 hover:scale-115 transition"
  />
</a>
