<script lang="ts">
  export let author: string;
</script>

<blockquote class="py-15 text-lg">
  <p class="italic">
    “<slot />”
  </p>

  <p class="mt-4 font-semibold text-right">
    {author}
  </p>
</blockquote>
