<script>
  export let title;
  export let iconName;
  export let iconWidth = "20";
  export let iconHeight = "20";
</script>

<article class="resume-article">
  <h2 class="section-heading">
    <span class="section-title">{title}</span>
    <svg width={iconWidth} height={iconHeight} class="section-icon">
      <use href="#{iconName}" />
    </svg>
  </h2>
  
  <slot />
</article>