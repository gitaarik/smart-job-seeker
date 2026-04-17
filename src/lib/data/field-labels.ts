/**
 * Static field choice labels
 *
 * Replaces the old Directus-based field label fetching with simple static maps.
 */

export const SKILL_LEVELS: Array<{ value: string; label: string }> = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "proficient", label: "Proficient" },
  { value: "expert", label: "Expert" },
];

const skillLevelMap = new Map(SKILL_LEVELS.map((l) => [l.value, l.label]));

export function getSkillLevelLabel(value: string): string {
  return skillLevelMap.get(value) ?? value;
}
