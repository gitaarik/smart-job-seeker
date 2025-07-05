<script lang="ts">
  let classNames = "";
  export { classNames as class };
</script>

<ul class="list-[circle] space-y-2 ml-4 {classNames}">
  <slot />
</ul>
