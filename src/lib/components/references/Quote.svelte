<script lang="ts">
  export let author: string;
</script>

<blockquote class="py-15 text-lg">
  <p class="italic tracking-[0.5px] leading-8">
    “<slot />”
  </p>

  <p class="mt-4 font-semibold text-right">
    {author}
  </p>
</blockquote>
