<script lang="ts">
  import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
  import { faBriefcase } from "@fortawesome/free-solid-svg-icons";

  interface Props {
    score: number | null;
    size?: "sm" | "lg";
  }

  let { score = null, size = "lg" }: Props = $props();

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
      ? { box: "w-15 h-15", score: "text-2xl", label: "text-xs", icon: "w-6 h-6" }
      : { box: "w-10 h-10", score: "text-lg", label: "text-[7px]", icon: "w-4 h-4" }
  );
</script>

{#if hasScore && colors}
  <div
    class="{sizeClasses.box} rounded-lg flex flex-col items-center justify-center"
    style="background-color: {colors.bg}; color: {colors.text};{colors.glow ? ` box-shadow: ${colors.glow};` : ''}"
  >
    <span class="font-bold {sizeClasses.score} leading-none">{score}%</span>
    <span class="{sizeClasses.label} opacity-60 whitespace-nowrap">Match</span>
  </div>
{:else}
  <div
    class="{sizeClasses.box} rounded-lg flex items-center justify-center bg-[var(--dash-bg)] text-[var(--dash-text-muted)]"
  >
    <FontAwesomeIcon icon={faBriefcase} class={sizeClasses.icon} />
  </div>
{/if}
