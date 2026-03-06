<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faClock, faTimesCircle } from "@fortawesome/free-regular-svg-icons";

  interface Props {
    score: number | null;
    matched?: boolean;
    size?: "sm" | "lg";
  }

  let { score = null, matched = false, size = "lg" }: Props = $props();

  function getScoreGradient(score: number): { bg: string; text: string; glow: string | null } {
    // Gradient from blue (0) -> cyan (50) -> green (80+)
    const s = Math.max(0, Math.min(100, score));

    // Color stops: blue (210°) -> cyan (180°) -> green (140°)
    let h: number, sat: number, lightBg: number, lightText: number;

    if (s <= 50) {
      h = 210 - (s / 50) * 30;
    } else if (s <= 80) {
      h = 180 - ((s - 50) / 30) * 40;
    } else {
      h = 140;
    }

    sat = 60 + (Math.min(s, 80) / 80) * 20;
    lightBg = 92 - (Math.min(s, 80) / 80) * 10;
    lightText = 35 - (Math.min(s, 80) / 80) * 10;

    let glow: string | null = null;
    if (s >= 80) {
      const glowIntensity = ((s - 80) / 20) * 0.4 + 0.3;
      glow = `0 0 12px hsla(${h}, ${sat}%, 50%, ${glowIntensity})`;
    }

    return {
      bg: `hsl(${h}, ${sat}%, ${lightBg}%)`,
      text: `hsl(${h}, ${sat}%, ${lightText}%)`,
      glow
    };
  }

  const hasScore = $derived(score !== null && score > 0);
  const colors = $derived(hasScore ? getScoreGradient(score!) : null);

  const sizeClasses = $derived(
    size === "lg"
      ? { box: "w-15 h-15", score: "text-2xl", label: "text-xs", icon: "w-5 h-5" }
      : { box: "w-10 h-10", score: "text-lg", label: "text-[7px]", icon: "w-3.5 h-3.5" }
  );
</script>

{#if hasScore && colors}
  <!-- Matched with score -->
  <div
    class="{sizeClasses.box} rounded-lg flex flex-col items-center justify-center"
    style="background-color: {colors.bg}; color: {colors.text};{colors.glow ? ` box-shadow: ${colors.glow};` : ''}"
  >
    <span class="font-bold {sizeClasses.score} leading-none">{score}%</span>
    <span class="{sizeClasses.label} opacity-60 whitespace-nowrap">Match</span>
  </div>
{:else if matched}
  <!-- Matcher ran but no match -->
  <div
    class="{sizeClasses.box} rounded-lg flex flex-col items-center justify-center bg-red-50 text-red-400 dark:bg-red-950/30 dark:text-red-400/70"
  >
    <FontAwesomeIcon icon={faTimesCircle} class={sizeClasses.icon} />
    <span class="{sizeClasses.label} whitespace-nowrap mt-0.5">No Match</span>
  </div>
{:else}
  <!-- Not yet matched -->
  <div
    class="{sizeClasses.box} rounded-lg flex flex-col items-center justify-center bg-amber-50 text-amber-500 dark:bg-amber-950/30 dark:text-amber-400/70"
  >
    <FontAwesomeIcon icon={faClock} class={sizeClasses.icon} />
    <span class="{sizeClasses.label} whitespace-nowrap mt-0.5">New</span>
  </div>
{/if}
