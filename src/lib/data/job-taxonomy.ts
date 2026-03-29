/**
 * Centralized job taxonomy: canonical types, aliases, and multilingual variants.
 *
 * This is the SINGLE SOURCE OF TRUTH for job type, work location, and experience
 * level classifications. All normalization, display labeling, and SQL filter
 * expansion should derive from this file.
 *
 * Consumers:
 *   - format.ts (UI display labels)
 *   - matcher.ts (in-memory normalization for matching)
 *   - eligibility.ts (SQL filter expansion)
 *   - config/+page.server.ts (match preference options)
 *
 * To add a new alias or language variant, add it here. All consumers pick it up
 * automatically.
 */

// ============================================================================
// Types
// ============================================================================

interface Alias {
  /** The original human-readable form, lowercased. E.g. "nach absprache" */
  text: string;
  /** Optional custom display label. If omitted, the canonical value's label is used.
   *  E.g. "contractor" displays as "Contractor", not "Contract". */
  displayLabel?: string;
}

interface Pattern {
  /** The substring or prefix to match against */
  pattern: string;
  /** "includes" for substring match, "startsWith" for prefix match */
  mode: "includes" | "startsWith";
}

interface CanonicalValue {
  /** The canonical identifier, e.g. "contract", "hybrid" */
  canonical: string;
  /** The default display label, e.g. "Contract", "Hybrid" */
  label: string;
  /** Exact-match aliases (lowercased) that map to this canonical value */
  aliases: Alias[];
  /** Substring/prefix patterns for fuzzy matching (evaluated after exact match) */
  patterns?: Pattern[];
}

export interface TaxonomyCategory {
  values: CanonicalValue[];
}

// ============================================================================
// Job Types
// ============================================================================

export const JOB_TYPES: TaxonomyCategory = {
  values: [
    {
      canonical: "full_time",
      label: "Full-time",
      aliases: [
        { text: "full_time" },
        { text: "full-time" },
        { text: "fulltime" },
        { text: "permanent", displayLabel: "Permanent" },
        // Dutch
        { text: "voltijd" },
        { text: "vast contract" },
        // German
        { text: "vollzeit" },
        { text: "festanstellung" },
        // French
        { text: "temps plein" },
        { text: "cdi" },
        // Spanish
        { text: "tiempo completo" },
        { text: "jornada completa" },
      ],
    },
    {
      canonical: "part_time",
      label: "Part-time",
      aliases: [
        { text: "part_time" },
        { text: "part-time" },
        { text: "parttime" },
        // Dutch
        { text: "deeltijd" },
        // German
        { text: "teilzeit" },
        // French
        { text: "temps partiel" },
        // Spanish
        { text: "tiempo parcial" },
        { text: "media jornada" },
      ],
    },
    {
      canonical: "contract",
      label: "Contract",
      aliases: [
        { text: "contract" },
        { text: "one-time project" },
        { text: "one time project" },
        { text: "contractor", displayLabel: "Contractor" },
        { text: "freelance", displayLabel: "Freelance" },
        { text: "fixed-price" },
        { text: "hourly" },
        { text: "hourly contract" },
        { text: "temporary", displayLabel: "Temporary" },
        { text: "temp-to-hire", displayLabel: "Temp to Hire" },
        { text: "ftc" },
        { text: "freelance contract" },
        { text: "contractor assignment freelancer" },
        // Dutch
        { text: "zzp", displayLabel: "ZZP" },
        { text: "freelance opdracht" },
        { text: "tijdelijk", displayLabel: "Tijdelijk" },
        { text: "detachering", displayLabel: "Detachering" },
        // German
        { text: "freiberuflich", displayLabel: "Freiberuflich" },
        { text: "zeitarbeit", displayLabel: "Zeitarbeit" },
        { text: "befristet" },
        // French
        { text: "cdd" },
        { text: "mission" },
        { text: "intérim", displayLabel: "Intérim" },
        // Spanish
        { text: "autónomo", displayLabel: "Autónomo" },
        { text: "temporal", displayLabel: "Temporal" },
        { text: "por proyecto" },
      ],
      patterns: [
        { pattern: "freelance", mode: "includes" },
        { pattern: "contractor", mode: "includes" },
      ],
    },
    {
      canonical: "internship",
      label: "Internship",
      aliases: [
        { text: "internship" },
        { text: "intern" },
        // Dutch
        { text: "stage" },
        { text: "stagiair" },
        // German
        { text: "praktikum" },
        // French
        { text: "stage", displayLabel: "Stage" },
        // Spanish
        { text: "prácticas" },
        { text: "pasantía" },
      ],
    },
  ],
};

// ============================================================================
// Work Locations
// ============================================================================

export const WORK_LOCATIONS: TaxonomyCategory = {
  values: [
    {
      canonical: "remote",
      label: "Remote",
      aliases: [
        { text: "remote" },
        { text: "fully remote" },
        { text: "remote (no onsite)" },
        // Dutch
        { text: "thuiswerk" },
        { text: "thuiswerken" },
        // German
        { text: "homeoffice" },
        { text: "home office" },
        // French
        { text: "télétravail" },
        // Spanish
        { text: "teletrabajo" },
        { text: "remoto" },
      ],
      patterns: [
        { pattern: "remote", mode: "startsWith" },
      ],
    },
    {
      canonical: "hybrid",
      label: "Hybrid",
      aliases: [
        { text: "hybrid" },
        { text: "hybride" },
        // Dutch
        { text: "in overleg" },
        // English
        { text: "flexible" },
        { text: "negotiable" },
        { text: "by agreement" },
        { text: "by mutual agreement" },
        { text: "by arrangement" },
        // German
        { text: "nach absprache" },
        { text: "nach vereinbarung" },
        { text: "flexibel" },
        // French
        { text: "en concertation" },
        { text: "selon accord" },
        { text: "à convenir" },
        { text: "à définir" },
        { text: "en accord" },
        // Spanish
        { text: "a convenir" },
        { text: "según acuerdo" },
        { text: "negociable" },
        // Portuguese
        { text: "a combinar" },
        { text: "a negociar" },
      ],
      patterns: [
        { pattern: "hybrid", mode: "includes" },
      ],
    },
    {
      canonical: "onsite",
      label: "On-site",
      aliases: [
        { text: "onsite" },
        { text: "on-site" },
        { text: "on_site" },
        { text: "on site" },
        // German
        { text: "vor ort" },
        // French
        { text: "sur site" },
        { text: "sur place" },
        // Spanish
        { text: "presencial" },
        // Dutch
        { text: "op locatie" },
      ],
    },
  ],
};

// ============================================================================
// Experience Levels
// ============================================================================

export const EXPERIENCE_LEVELS: TaxonomyCategory = {
  values: [
    {
      canonical: "entry",
      label: "Entry Level",
      aliases: [
        { text: "entry" },
        { text: "entry_level" },
        { text: "entry-level" },
        { text: "entry level" },
      ],
    },
    {
      canonical: "junior",
      label: "Junior",
      aliases: [
        { text: "junior" },
      ],
    },
    {
      canonical: "mid",
      label: "Mid Level",
      aliases: [
        { text: "mid" },
        { text: "mid_level" },
        { text: "mid-level" },
        { text: "mid level" },
        { text: "medior" },
      ],
    },
    {
      canonical: "mid_senior",
      label: "Mid-Senior",
      aliases: [
        { text: "mid_senior" },
        { text: "mid-senior" },
        { text: "mid senior" },
      ],
    },
    {
      canonical: "senior",
      label: "Senior",
      aliases: [
        { text: "senior" },
      ],
    },
    {
      canonical: "lead",
      label: "Lead",
      aliases: [
        { text: "lead" },
      ],
    },
    {
      canonical: "principal",
      label: "Principal",
      aliases: [
        { text: "principal" },
      ],
    },
    {
      canonical: "staff",
      label: "Staff",
      aliases: [
        { text: "staff" },
      ],
    },
    {
      canonical: "director",
      label: "Director",
      aliases: [
        { text: "director" },
      ],
    },
    {
      canonical: "executive",
      label: "Executive",
      aliases: [
        { text: "executive" },
      ],
    },
    {
      canonical: "internship",
      label: "Internship",
      aliases: [
        { text: "internship" },
      ],
    },
  ],
};

// ============================================================================
// Derived helpers — used by consumers
// ============================================================================

/** Strip all separators (hyphens, underscores, spaces) and lowercase */
function strip(s: string): string {
  return s.toLowerCase().replace(/[-_\s]/g, "");
}

/**
 * Build a display label map: lowercased alias → display string.
 * Used by format.ts for UI rendering.
 */
export function buildDisplayMap(category: TaxonomyCategory): Map<string, string> {
  const map = new Map<string, string>();
  for (const val of category.values) {
    for (const alias of val.aliases) {
      map.set(alias.text, alias.displayLabel ?? val.label);
    }
  }
  return map;
}

/**
 * Build a normalization map: lowercased alias → canonical value.
 * Used by matcher.ts for in-memory matching.
 */
export function buildNormalizeMap(category: TaxonomyCategory): Map<string, string> {
  const map = new Map<string, string>();
  for (const val of category.values) {
    for (const alias of val.aliases) {
      map.set(alias.text, val.canonical);
    }
  }
  return map;
}

/**
 * Get all patterns for a category, with their canonical values.
 * Used by matcher.ts for fuzzy matching after exact lookup fails.
 */
export function getPatterns(
  category: TaxonomyCategory,
): { pattern: string; mode: "includes" | "startsWith"; canonical: string }[] {
  const result: { pattern: string; mode: "includes" | "startsWith"; canonical: string }[] = [];
  for (const val of category.values) {
    for (const p of val.patterns ?? []) {
      result.push({ ...p, canonical: val.canonical });
    }
  }
  return result;
}

/**
 * Build family expansion map: canonical → set of stripped alias forms.
 * Used by eligibility.ts for SQL filter expansion.
 *
 * Strips hyphens, underscores, and spaces so "one-time project" becomes
 * "onetimeproject", matching the normalizeValue() in eligibility.ts.
 */
export function buildFamilyMap(
  category: TaxonomyCategory,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const val of category.values) {
    const stripped = new Set<string>();
    for (const alias of val.aliases) {
      stripped.add(strip(alias.text));
    }
    // Also add pattern strings as stripped entries for contains-matching
    for (const p of val.patterns ?? []) {
      stripped.add(strip(p.pattern));
    }
    map.set(strip(val.canonical), Array.from(stripped));
  }
  return map;
}

/**
 * Get canonical labels for config/preference UI options.
 * Returns labels in definition order.
 */
export function getOptionLabels(category: TaxonomyCategory): string[] {
  return category.values.map((v) => v.label);
}

/**
 * Display-label pattern matching: check patterns for a value not found via exact lookup.
 * Returns the display label if a pattern matches, or null.
 */
export function matchPatternDisplay(
  category: TaxonomyCategory,
  input: string,
): string | null {
  const lower = input.toLowerCase();
  for (const val of category.values) {
    for (const p of val.patterns ?? []) {
      if (p.mode === "includes" && lower.includes(p.pattern)) return val.label;
      if (p.mode === "startsWith" && lower.startsWith(p.pattern)) return val.label;
    }
  }
  return null;
}
