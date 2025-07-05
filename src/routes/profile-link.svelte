<script lang="ts">
  export let icon: string = "";
  export let href: string = "";
</script>

<div class="my-4 flex items-center">
  <div class="mr-1">
    <img src={icon} alt="icon" class="h-5 w-5" />
  </div>

  <div>
    <a {href} target="_blank" class="text-l text-nowrap underline"><slot /></a>
  </div>
</div>
