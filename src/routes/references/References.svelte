<script>
  import Quote from "./Quote.svelte";
</script>
<div
  class="pt-20 pb-10 px-4 md:px-6 flex justify-center bg-[var(--dark-bg-color)] text-[var(--text-light-color)]"
>
  <div class="max-w-[600px]">
    <h3 class="text-3xl font-semibold mb-8 md:mb-10 capitalize text-center">
      What Clients Say
    </h3>

    <Quote author="Michaël de Groot - Founder of Chipta">
      Rik modernized our client-facing interfaces and implemented optimizations
      that delivered substantial performance improvements. His work enabled us
      to process thousands of tickets rapidly during our busiest periods.
    </Quote>

    <Quote author="Elmar Krack - Co-founder of Tender-it">
      Rik demonstrated exceptional technical leadership by designing and
      developing our entire platform from the ground up, handling both backend
      and frontend development with impressive skill.
    </Quote>
  </div>
</div>
