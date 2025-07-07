<script lang="ts">
  export let label: string;
</script>

<div class="flex whitespace-nowrap">
  <strong class="mr-2 sm:text-right sm:block sm:w-[130px]">{label}:</strong>
  <slot></slot>
</div>
