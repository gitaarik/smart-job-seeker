<script lang="ts">
  let classNames: string = "";
  export { classNames as class };
</script>

<li class={classNames}>
  <slot />
</li>

