<script>
  export let title;
  export let iconName;
  export let iconWidth = "20";
  export let iconHeight = "20";
</script>

<style>
  .resume-article {
    @apply bg-gray-50 border-2 border-cyan-700 rounded-xl p-6 mb-8 break-inside-avoid print:border-0 print:p-0 print:mb-2;
  }

  .section-heading {
    @apply relative border-b-2 border-cyan-700 pb-1 mb-5 print:pb-1 print:mb-4;
  }

  .section-title {
    @apply text-xl font-semibold pr-12 print:text-lg;
  }

  .section-icon {
    @apply absolute right-1 top-2;
  }
</style>

<article class="resume-article">
  <h2 class="section-heading">
    <span class="section-title">{title}</span>
    <svg width={iconWidth} height={iconHeight} class="section-icon">
      <use href="#{iconName}" />
    </svg>
  </h2>
  
  <slot />
</article>
