/**
 * Geo-location Utilities
 *
 * Derives browser timezone, locale, and language from a country code.
 * Used to configure anti-detect browser profiles with consistent geo settings.
 *
 * NOTE: This is the shared source of truth. The cloud module (cloud/src/server/browser/geo-utils.ts)
 * re-exports from here.
 */

export interface GeoConfig {
  timezone: string;
  locale: string;
  language: string;
}

/**
 * Map of ISO 3166-1 alpha-2 country codes to default timezone and locale.
 * Covers major countries; others fall back to the capital/largest city timezone.
 */
const COUNTRY_GEO_MAP: Record<string, GeoConfig> = {
  // North America
  US: { timezone: "America/New_York", locale: "en-US", language: "en-US,en" },
  CA: { timezone: "America/Toronto", locale: "en-CA", language: "en-CA,en,fr-CA" },
  MX: { timezone: "America/Mexico_City", locale: "es-MX", language: "es-MX,es" },

  // Europe
  GB: { timezone: "Europe/London", locale: "en-GB", language: "en-GB,en" },
  DE: { timezone: "Europe/Berlin", locale: "de-DE", language: "de-DE,de,en" },
  FR: { timezone: "Europe/Paris", locale: "fr-FR", language: "fr-FR,fr,en" },
  NL: { timezone: "Europe/Amsterdam", locale: "nl-NL", language: "nl-NL,nl,en" },
  ES: { timezone: "Europe/Madrid", locale: "es-ES", language: "es-ES,es,en" },
  IT: { timezone: "Europe/Rome", locale: "it-IT", language: "it-IT,it,en" },
  PT: { timezone: "Europe/Lisbon", locale: "pt-PT", language: "pt-PT,pt,en" },
  CH: { timezone: "Europe/Zurich", locale: "de-CH", language: "de-CH,de,fr,en" },
  AT: { timezone: "Europe/Vienna", locale: "de-AT", language: "de-AT,de,en" },
  BE: { timezone: "Europe/Brussels", locale: "nl-BE", language: "nl-BE,nl,fr,en" },
  SE: { timezone: "Europe/Stockholm", locale: "sv-SE", language: "sv-SE,sv,en" },
  NO: { timezone: "Europe/Oslo", locale: "nb-NO", language: "nb-NO,nb,en" },
  DK: { timezone: "Europe/Copenhagen", locale: "da-DK", language: "da-DK,da,en" },
  FI: { timezone: "Europe/Helsinki", locale: "fi-FI", language: "fi-FI,fi,en" },
  PL: { timezone: "Europe/Warsaw", locale: "pl-PL", language: "pl-PL,pl,en" },
  CZ: { timezone: "Europe/Prague", locale: "cs-CZ", language: "cs-CZ,cs,en" },
  IE: { timezone: "Europe/Dublin", locale: "en-IE", language: "en-IE,en" },
  RO: { timezone: "Europe/Bucharest", locale: "ro-RO", language: "ro-RO,ro,en" },
  UA: { timezone: "Europe/Kyiv", locale: "uk-UA", language: "uk-UA,uk,en" },
  GR: { timezone: "Europe/Athens", locale: "el-GR", language: "el-GR,el,en" },
  HU: { timezone: "Europe/Budapest", locale: "hu-HU", language: "hu-HU,hu,en" },

  // Asia-Pacific
  JP: { timezone: "Asia/Tokyo", locale: "ja-JP", language: "ja-JP,ja,en" },
  KR: { timezone: "Asia/Seoul", locale: "ko-KR", language: "ko-KR,ko,en" },
  CN: { timezone: "Asia/Shanghai", locale: "zh-CN", language: "zh-CN,zh,en" },
  IN: { timezone: "Asia/Kolkata", locale: "en-IN", language: "en-IN,hi,en" },
  AU: { timezone: "Australia/Sydney", locale: "en-AU", language: "en-AU,en" },
  NZ: { timezone: "Pacific/Auckland", locale: "en-NZ", language: "en-NZ,en" },
  SG: { timezone: "Asia/Singapore", locale: "en-SG", language: "en-SG,en" },
  PH: { timezone: "Asia/Manila", locale: "en-PH", language: "en-PH,en,tl" },
  TH: { timezone: "Asia/Bangkok", locale: "th-TH", language: "th-TH,th,en" },
  VN: { timezone: "Asia/Ho_Chi_Minh", locale: "vi-VN", language: "vi-VN,vi,en" },
  ID: { timezone: "Asia/Jakarta", locale: "id-ID", language: "id-ID,id,en" },
  MY: { timezone: "Asia/Kuala_Lumpur", locale: "ms-MY", language: "ms-MY,ms,en" },
  TW: { timezone: "Asia/Taipei", locale: "zh-TW", language: "zh-TW,zh,en" },
  HK: { timezone: "Asia/Hong_Kong", locale: "zh-HK", language: "zh-HK,zh,en" },
  PK: { timezone: "Asia/Karachi", locale: "ur-PK", language: "ur-PK,ur,en" },
  BD: { timezone: "Asia/Dhaka", locale: "bn-BD", language: "bn-BD,bn,en" },

  // Middle East
  AE: { timezone: "Asia/Dubai", locale: "ar-AE", language: "ar-AE,ar,en" },
  IL: { timezone: "Asia/Jerusalem", locale: "he-IL", language: "he-IL,he,en" },
  SA: { timezone: "Asia/Riyadh", locale: "ar-SA", language: "ar-SA,ar,en" },
  TR: { timezone: "Europe/Istanbul", locale: "tr-TR", language: "tr-TR,tr,en" },

  // South America
  BR: { timezone: "America/Sao_Paulo", locale: "pt-BR", language: "pt-BR,pt,en" },
  AR: { timezone: "America/Argentina/Buenos_Aires", locale: "es-AR", language: "es-AR,es,en" },
  CO: { timezone: "America/Bogota", locale: "es-CO", language: "es-CO,es,en" },
  CL: { timezone: "America/Santiago", locale: "es-CL", language: "es-CL,es,en" },

  // Africa
  ZA: { timezone: "Africa/Johannesburg", locale: "en-ZA", language: "en-ZA,en" },
  NG: { timezone: "Africa/Lagos", locale: "en-NG", language: "en-NG,en" },
  EG: { timezone: "Africa/Cairo", locale: "ar-EG", language: "ar-EG,ar,en" },
  KE: { timezone: "Africa/Nairobi", locale: "en-KE", language: "en-KE,en,sw" },
};

/**
 * Get geo-configuration for a country code.
 * Falls back to US defaults for unknown countries.
 */
export function getGeoConfig(countryCode: string): GeoConfig {
  const upper = countryCode.toUpperCase();
  return COUNTRY_GEO_MAP[upper] || COUNTRY_GEO_MAP["US"];
}

/**
 * Get timezone for a country code.
 */
export function getTimezone(countryCode: string): string {
  return getGeoConfig(countryCode).timezone;
}

/**
 * Get locale for a country code (e.g., "en-US", "nl-NL").
 */
export function getLocale(countryCode: string): string {
  return getGeoConfig(countryCode).locale;
}

/**
 * Get language header value for a country code (e.g., "en-US,en", "nl-NL,nl,en").
 */
export function getLanguage(countryCode: string): string {
  return getGeoConfig(countryCode).language;
}
