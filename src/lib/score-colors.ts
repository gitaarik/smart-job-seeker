/**
 * Score color gradient shared by ScoreBadge component and email digest.
 * Gradient from blue (0) -> cyan (50) -> green (80+).
 */

export interface ScoreColors {
  bg: string;
  text: string;
  glow: string | null;
}

export function getScoreGradient(score: number): ScoreColors {
  const s = Math.max(0, Math.min(100, score));

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
    glow,
  };
}
