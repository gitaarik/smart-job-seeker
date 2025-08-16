<script lang="ts">
  let className = "";
  export { className as class };
</script>

<ul class="space-y-2 list-[circle] list-inside {className}">
  <slot />
</ul>
