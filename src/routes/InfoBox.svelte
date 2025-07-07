<script lang="ts">
  export let headerText: string = "";

  let classNames: string = "";
  export { classNames as class };
</script>

<div
  class="bg-[#e8edf0] rounded-lg {classNames} border-2 border-[rgb(61,135,164)]"
>
  <h3
    class="font-medium px-4 py-2 bg-[rgb(61,135,164)] text-white rounded-t-md"
  >
    {headerText}
  </h3>

  <slot />
</div>
