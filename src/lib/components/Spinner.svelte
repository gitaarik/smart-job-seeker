<script lang="ts">
  type Props = {
    /** Tailwind size class, e.g. "w-4 h-4" */
    size?: string;
    /** CSS color — defaults to currentColor (inherits text color) */
    color?: string;
    class?: string;
  };

  let { size = "w-4 h-4", color = "currentColor", class: className = "" }: Props = $props();
</script>

<svg
  class="spinner {size} {className}"
  viewBox="0 0 24 24"
  fill="none"
  xmlns="http://www.w3.org/2000/svg"
>
  <!-- Background track -->
  <circle cx="12" cy="12" r="10" stroke={color} stroke-opacity="0.15" stroke-width="2.5" />
  <!-- Animated arc with rounded ends -->
  <circle
    cx="12" cy="12" r="10"
    stroke={color}
    stroke-width="2.5"
    stroke-linecap="round"
    stroke-dasharray="16 47"
    class="spinner-arc"
  />
</svg>

<style>
  .spinner {
    animation: spinner-rotate 0.75s linear infinite;
  }
  .spinner-arc {
    transform-origin: center;
  }
  @keyframes spinner-rotate {
    to { transform: rotate(360deg); }
  }
</style>
