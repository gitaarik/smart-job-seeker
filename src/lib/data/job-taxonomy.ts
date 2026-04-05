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
// Regions
// ============================================================================

export const REGIONS: TaxonomyCategory = {
  values: [
    {
      canonical: "us",
      label: "US",
      aliases: [
        { text: "us" }, { text: "usa" }, { text: "united states" },
        { text: "united states of america" },
      ],
      patterns: [
        // US state abbreviations after comma (e.g. "Austin, TX", "Boston, MA 02101")
        { pattern: ", al", mode: "includes" }, { pattern: ", ak", mode: "includes" },
        { pattern: ", az", mode: "includes" }, { pattern: ", ar", mode: "includes" },
        { pattern: ", ca", mode: "includes" }, { pattern: ", co", mode: "includes" },
        { pattern: ", ct", mode: "includes" }, { pattern: ", de", mode: "includes" },
        { pattern: ", fl", mode: "includes" }, { pattern: ", ga", mode: "includes" },
        { pattern: ", hi", mode: "includes" }, { pattern: ", id", mode: "includes" },
        { pattern: ", il", mode: "includes" }, { pattern: ", in", mode: "includes" },
        { pattern: ", ia", mode: "includes" }, { pattern: ", ks", mode: "includes" },
        { pattern: ", ky", mode: "includes" }, { pattern: ", la", mode: "includes" },
        { pattern: ", me", mode: "includes" }, { pattern: ", md", mode: "includes" },
        { pattern: ", ma", mode: "includes" }, { pattern: ", mi", mode: "includes" },
        { pattern: ", mn", mode: "includes" }, { pattern: ", ms", mode: "includes" },
        { pattern: ", mo", mode: "includes" }, { pattern: ", mt", mode: "includes" },
        { pattern: ", ne", mode: "includes" }, { pattern: ", nv", mode: "includes" },
        { pattern: ", nh", mode: "includes" }, { pattern: ", nj", mode: "includes" },
        { pattern: ", nm", mode: "includes" }, { pattern: ", ny", mode: "includes" },
        { pattern: ", nc", mode: "includes" }, { pattern: ", nd", mode: "includes" },
        { pattern: ", oh", mode: "includes" }, { pattern: ", ok", mode: "includes" },
        { pattern: ", or", mode: "includes" }, { pattern: ", pa", mode: "includes" },
        { pattern: ", ri", mode: "includes" }, { pattern: ", sc", mode: "includes" },
        { pattern: ", sd", mode: "includes" }, { pattern: ", tn", mode: "includes" },
        { pattern: ", tx", mode: "includes" }, { pattern: ", ut", mode: "includes" },
        { pattern: ", vt", mode: "includes" }, { pattern: ", va", mode: "includes" },
        { pattern: ", wa", mode: "includes" }, { pattern: ", wv", mode: "includes" },
        { pattern: ", wi", mode: "includes" }, { pattern: ", wy", mode: "includes" },
        { pattern: ", dc", mode: "includes" },
        { pattern: ", usa", mode: "includes" },
        // Full state names and major cities without state abbrev
        { pattern: "texas", mode: "includes" },
        { pattern: "california", mode: "includes" },
        { pattern: "new york", mode: "includes" },
        { pattern: "florida", mode: "includes" },
        { pattern: "virginia", mode: "includes" },
        { pattern: "washington", mode: "includes" },
        { pattern: "colorado", mode: "includes" },
        { pattern: "massachusetts", mode: "includes" },
        { pattern: "illinois", mode: "includes" },
        { pattern: "north america", mode: "includes" },
        { pattern: "united states", mode: "includes" },
      ],
    },
    {
      canonical: "uk",
      label: "UK",
      aliases: [
        { text: "uk" }, { text: "united kingdom" }, { text: "great britain" },
        { text: "england" }, { text: "scotland" }, { text: "wales" },
        { text: "northern ireland" },
      ],
      patterns: [
        { pattern: ", uk", mode: "includes" },
        { pattern: "london", mode: "includes" },
        { pattern: "manchester", mode: "includes" },
        { pattern: "birmingham, uk", mode: "includes" },
        { pattern: "edinburgh", mode: "includes" },
        { pattern: "bristol, uk", mode: "includes" },
        { pattern: "cambridge, uk", mode: "includes" },
        { pattern: "oxford, uk", mode: "includes" },
        { pattern: "leeds, uk", mode: "includes" },
        { pattern: "cardiff", mode: "includes" },
        { pattern: "in uk", mode: "includes" },
      ],
    },
    {
      canonical: "western_europe",
      label: "Western Europe",
      aliases: [
        { text: "western europe" }, { text: "europe" }, { text: "european union" },
        { text: "eu" }, { text: "eea" }, { text: "emea" },
        // Countries
        { text: "netherlands" }, { text: "nederland" },
        { text: "germany" }, { text: "deutschland" },
        { text: "france" },
        { text: "belgium" }, { text: "belgië" }, { text: "belgique" },
        { text: "austria" }, { text: "österreich" },
        { text: "switzerland" }, { text: "schweiz" }, { text: "suisse" },
        { text: "ireland" },
        { text: "luxembourg" },
        { text: "denmark" }, { text: "dnk" },
        { text: "sweden" }, { text: "norway" }, { text: "finland" },
        { text: "spain" }, { text: "españa" },
        { text: "portugal" },
        { text: "italy" }, { text: "italia" },
        { text: "greece" },
      ],
      patterns: [
        // Dutch provinces and cities
        { pattern: "noord-holland", mode: "includes" },
        { pattern: "zuid-holland", mode: "includes" },
        { pattern: "noord-brabant", mode: "includes" },
        { pattern: "gelderland", mode: "includes" },
        { pattern: "limburg", mode: "includes" },
        { pattern: "utrecht", mode: "includes" },
        { pattern: "amsterdam", mode: "includes" },
        { pattern: "rotterdam", mode: "includes" },
        { pattern: "den haag", mode: "includes" },
        { pattern: "eindhoven", mode: "includes" },
        { pattern: "groningen", mode: "includes" },
        { pattern: "haarlem", mode: "includes" },
        { pattern: "leiden", mode: "includes" },
        { pattern: "delft", mode: "includes" },
        { pattern: "hilversum", mode: "includes" },
        { pattern: "amersfoort", mode: "includes" },
        { pattern: "breda", mode: "includes" },
        { pattern: "tilburg", mode: "includes" },
        { pattern: "arnhem", mode: "includes" },
        { pattern: "nijmegen", mode: "includes" },
        { pattern: "den bosch", mode: "includes" },
        { pattern: "hybride werken", mode: "includes" },
        // German cities
        { pattern: "berlin", mode: "includes" },
        { pattern: "münchen", mode: "includes" },
        { pattern: "munich", mode: "includes" },
        { pattern: "frankfurt", mode: "includes" },
        { pattern: "hamburg", mode: "includes" },
        { pattern: "köln", mode: "includes" },
        { pattern: "cologne", mode: "includes" },
        { pattern: "düsseldorf", mode: "includes" },
        { pattern: "stuttgart", mode: "includes" },
        // French cities
        { pattern: "paris", mode: "includes" },
        { pattern: "lyon", mode: "includes" },
        { pattern: "marseille", mode: "includes" },
        // Spanish regions and cities
        { pattern: "spain", mode: "includes" },
        { pattern: "andalusia", mode: "includes" },
        { pattern: "catalonia", mode: "includes" },
        { pattern: "madrid", mode: "includes" },
        { pattern: "barcelona", mode: "includes" },
        { pattern: "málaga", mode: "includes" },
        { pattern: "malaga", mode: "includes" },
        { pattern: "marbella", mode: "includes" },
        { pattern: "cadiz", mode: "includes" },
        { pattern: "granada", mode: "includes" },
        { pattern: "valencia", mode: "includes" },
        { pattern: "seville", mode: "includes" },
        { pattern: "sevilla", mode: "includes" },
        { pattern: "estepona", mode: "includes" },
        { pattern: "fuengirola", mode: "includes" },
        { pattern: "mijas", mode: "includes" },
        { pattern: "torremolinos", mode: "includes" },
        { pattern: "benalmádena", mode: "includes" },
        { pattern: "benalmadena", mode: "includes" },
        { pattern: "almuñécar", mode: "includes" },
        { pattern: "rota", mode: "includes" },
        { pattern: "san roque", mode: "includes" },
        { pattern: "chiclana", mode: "includes" },
        { pattern: "almería", mode: "includes" },
        { pattern: "almeria", mode: "includes" },
        // More Dutch locations
        { pattern: "zeeland", mode: "includes" },
        { pattern: "north holland", mode: "includes" },
        { pattern: "zuid-holland", mode: "includes" },
        { pattern: "alkmaar", mode: "includes" },
        { pattern: "zaandam", mode: "includes" },
        { pattern: "hoorn", mode: "includes" },
        { pattern: "baarn", mode: "includes" },
        { pattern: "bunnik", mode: "includes" },
        { pattern: "zeist", mode: "includes" },
        { pattern: "veghel", mode: "includes" },
        { pattern: "woerden", mode: "includes" },
        { pattern: "hillegom", mode: "includes" },
        { pattern: "katwijk", mode: "includes" },
        { pattern: "rijnsburg", mode: "includes" },
        { pattern: "velsen", mode: "includes" },
        { pattern: "bunschoten", mode: "includes" },
        { pattern: "breukelen", mode: "includes" },
        // European meta
        { pattern: "european", mode: "includes" },
        { pattern: ", netherlands", mode: "includes" },
        { pattern: ", germany", mode: "includes" },
        { pattern: ", france", mode: "includes" },
        { pattern: ", spain", mode: "includes" },
        { pattern: ", italy", mode: "includes" },
        { pattern: ", belgium", mode: "includes" },
        { pattern: ", ireland", mode: "includes" },
        { pattern: ", denmark", mode: "includes" },
        { pattern: ", sweden", mode: "includes" },
        { pattern: ", norway", mode: "includes" },
        { pattern: ", finland", mode: "includes" },
        { pattern: ", portugal", mode: "includes" },
        { pattern: ", austria", mode: "includes" },
        { pattern: ", switzerland", mode: "includes" },
      ],
    },
    {
      canonical: "eastern_europe",
      label: "Eastern Europe",
      aliases: [
        { text: "eastern europe" },
        { text: "poland" }, { text: "polska" },
        { text: "czech republic" }, { text: "czechia" },
        { text: "romania" }, { text: "hungary" },
        { text: "bulgaria" }, { text: "croatia" },
        { text: "slovakia" }, { text: "slovenia" },
        { text: "serbia" }, { text: "ukraine" },
        { text: "lithuania" }, { text: "latvia" }, { text: "estonia" },
      ],
      patterns: [
        { pattern: "warsaw", mode: "includes" },
        { pattern: "prague", mode: "includes" },
        { pattern: "budapest", mode: "includes" },
        { pattern: "bucharest", mode: "includes" },
        { pattern: "krakow", mode: "includes" },
        { pattern: "kraków", mode: "includes" },
        { pattern: "zagreb", mode: "includes" },
        { pattern: "sofia", mode: "includes" },
        { pattern: "bratislava", mode: "includes" },
        { pattern: "ljubljana", mode: "includes" },
        { pattern: "tallinn", mode: "includes" },
        { pattern: "riga", mode: "includes" },
        { pattern: "vilnius", mode: "includes" },
        { pattern: ", poland", mode: "includes" },
        { pattern: ", romania", mode: "includes" },
        { pattern: ", hungary", mode: "includes" },
        { pattern: ", czech", mode: "includes" },
        { pattern: ", croatia", mode: "includes" },
        { pattern: ", ukraine", mode: "includes" },
        { pattern: ", serbia", mode: "includes" },
        { pattern: ", bulgaria", mode: "includes" },
      ],
    },
    {
      canonical: "middle_east",
      label: "Middle East",
      aliases: [
        { text: "middle east" },
        { text: "uae" }, { text: "united arab emirates" },
        { text: "saudi arabia" }, { text: "israel" },
        { text: "qatar" }, { text: "bahrain" }, { text: "kuwait" },
        { text: "oman" }, { text: "jordan" }, { text: "lebanon" },
        { text: "turkey" }, { text: "türkiye" },
      ],
      patterns: [
        { pattern: "dubai", mode: "includes" },
        { pattern: "abu dhabi", mode: "includes" },
        { pattern: "riyadh", mode: "includes" },
        { pattern: "tel aviv", mode: "includes" },
        { pattern: "istanbul", mode: "includes" },
        { pattern: "doha", mode: "includes" },
        { pattern: "ankara", mode: "includes" },
      ],
    },
    {
      canonical: "asia_pacific",
      label: "Asia Pacific",
      aliases: [
        { text: "asia pacific" }, { text: "apac" }, { text: "asia" },
        { text: "india" }, { text: "china" }, { text: "japan" },
        { text: "south korea" }, { text: "korea" },
        { text: "singapore" }, { text: "australia" },
        { text: "new zealand" }, { text: "taiwan" },
        { text: "malaysia" }, { text: "indonesia" },
        { text: "philippines" }, { text: "vietnam" },
        { text: "thailand" }, { text: "pakistan" },
        { text: "bangladesh" },
      ],
      patterns: [
        { pattern: "bengaluru", mode: "includes" },
        { pattern: "bangalore", mode: "includes" },
        { pattern: "mumbai", mode: "includes" },
        { pattern: "hyderabad", mode: "includes" },
        { pattern: "delhi", mode: "includes" },
        { pattern: "gurugram", mode: "includes" },
        { pattern: "pune", mode: "includes" },
        { pattern: "chennai", mode: "includes" },
        { pattern: "tokyo", mode: "includes" },
        { pattern: "sydney", mode: "includes" },
        { pattern: "melbourne", mode: "includes" },
        { pattern: "singapore", mode: "includes" },
        { pattern: "australia", mode: "includes" },
        { pattern: ", india", mode: "includes" },
        { pattern: ", japan", mode: "includes" },
        { pattern: ", australia", mode: "includes" },
        { pattern: ", china", mode: "includes" },
      ],
    },
    {
      canonical: "latin_america",
      label: "Latin America",
      aliases: [
        { text: "latin america" }, { text: "latam" },
        { text: "brazil" }, { text: "brasil" },
        { text: "mexico" }, { text: "méxico" },
        { text: "argentina" }, { text: "colombia" },
        { text: "chile" }, { text: "peru" }, { text: "perú" },
        { text: "costa rica" }, { text: "uruguay" },
      ],
      patterns: [
        { pattern: "são paulo", mode: "includes" },
        { pattern: "sao paulo", mode: "includes" },
        { pattern: "buenos aires", mode: "includes" },
        { pattern: "mexico city", mode: "includes" },
        { pattern: "bogotá", mode: "includes" },
        { pattern: "bogota", mode: "includes" },
        { pattern: "santiago", mode: "includes" },
        { pattern: "lima", mode: "includes" },
        { pattern: ", brazil", mode: "includes" },
        { pattern: ", mexico", mode: "includes" },
        { pattern: ", argentina", mode: "includes" },
        { pattern: ", colombia", mode: "includes" },
      ],
    },
    {
      canonical: "africa",
      label: "Africa",
      aliases: [
        { text: "africa" },
        { text: "south africa" }, { text: "nigeria" },
        { text: "kenya" }, { text: "egypt" },
        { text: "ghana" }, { text: "ethiopia" },
        { text: "tanzania" }, { text: "morocco" },
      ],
      patterns: [
        { pattern: "cape town", mode: "includes" },
        { pattern: "johannesburg", mode: "includes" },
        { pattern: "lagos", mode: "includes" },
        { pattern: "nairobi", mode: "includes" },
        { pattern: "cairo", mode: "includes" },
        { pattern: "accra", mode: "includes" },
        { pattern: ", south africa", mode: "includes" },
        { pattern: ", nigeria", mode: "includes" },
        { pattern: ", kenya", mode: "includes" },
        { pattern: ", egypt", mode: "includes" },
      ],
    },
  ],
};

// ============================================================================
// Region classifier
// ============================================================================

const _regionNormalizeMap = buildNormalizeMap(REGIONS);
const _regionPatterns = getPatterns(REGIONS);

/**
 * Classify a job's office_location string into a canonical region.
 * Returns the canonical region key or null if unclassifiable.
 *
 * Strategy:
 * 1. Strip work arrangement suffixes like "(Remote)", "(Hybrid)", "(On-site)"
 * 2. Try exact match against aliases
 * 3. Try pattern matching (substring/prefix)
 *
 * Region priority: more specific regions (US, UK) are checked before
 * broader ones (Western Europe) via pattern definition order.
 */
export function classifyRegion(location: string | null | undefined): string | null {
  if (!location) return null;

  // Strip work arrangement suffixes
  const cleaned = location
    .replace(/\s*\((?:remote|hybrid|on-?site)\)\s*/gi, "")
    .trim()
    .toLowerCase();

  if (!cleaned) return null;

  // Exact match
  const exact = _regionNormalizeMap.get(cleaned);
  if (exact) return exact;

  // Pattern match — order matters: US state patterns are checked first,
  // then UK, then Western Europe, etc.
  for (const p of _regionPatterns) {
    if (p.mode === "includes" && cleaned.includes(p.pattern)) return p.canonical;
    if (p.mode === "startsWith" && cleaned.startsWith(p.pattern)) return p.canonical;
  }

  return null;
}

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
