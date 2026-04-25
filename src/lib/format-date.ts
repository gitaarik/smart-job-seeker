export type TimeFormat = "12h" | "24h";

interface FormatOpts {
  timezone?: string | null;
  fallback?: string;
}

/**
 * Derive a default time format from a timezone.
 * US, Canada, Australia, Philippines use 12-hour; most of the world uses 24-hour.
 */
export function defaultTimeFormat(timezone: string | null): TimeFormat {
  if (!timezone) return "12h";
  // Latin America uses 24h despite America/ prefix
  if (
    timezone.startsWith("America/Sao_Paulo") ||
    timezone.startsWith("America/Argentina") ||
    timezone.startsWith("America/Bogota") ||
    timezone.startsWith("America/Lima") ||
    timezone.startsWith("America/Santiago") ||
    timezone.startsWith("America/Montevideo") ||
    timezone.startsWith("America/Asuncion") ||
    timezone.startsWith("America/Caracas") ||
    timezone.startsWith("America/Guayaquil") ||
    timezone.startsWith("America/La_Paz")
  ) {
    return "24h";
  }
  // US, Canada, Australia, Philippines use 12h
  if (
    timezone.startsWith("America/") ||
    timezone.startsWith("Australia/") ||
    timezone.startsWith("Pacific/Honolulu") ||
    timezone === "Asia/Manila"
  ) {
    return "12h";
  }
  return "24h";
}

/**
 * Resolve a stored time_format value (which may be null for "auto") to a concrete format.
 */
export function resolveTimeFormat(
  raw: string | null,
  timezone: string | null,
): TimeFormat {
  if (raw === "12h" || raw === "24h") return raw;
  return defaultTimeFormat(timezone);
}

export function isHour12(timeFormat: TimeFormat): boolean {
  return timeFormat === "12h";
}

function toDate(date: Date | string | null): Date | null {
  if (!date) return null;
  return typeof date === "string" ? new Date(date) : date;
}

/**
 * "Jan 5, 2025"
 */
export function formatDate(
  date: Date | string | null,
  opts?: FormatOpts,
): string {
  const d = toDate(date);
  if (!d) return opts?.fallback ?? "N/A";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: opts?.timezone || undefined,
  });
}

/**
 * "Monday, January 5, 2025"
 */
export function formatDateLong(
  date: Date | string | null,
  opts?: FormatOpts,
): string {
  const d = toDate(date);
  if (!d) return opts?.fallback ?? "N/A";
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: opts?.timezone || undefined,
  });
}

/**
 * "Mon, Jan 5"
 */
export function formatDateShort(
  date: Date | string | null,
  opts?: FormatOpts,
): string {
  const d = toDate(date);
  if (!d) return opts?.fallback ?? "N/A";
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: opts?.timezone || undefined,
  });
}

/**
 * "Jan 5, 2025, 3:42 PM" or "Jan 5, 2025, 15:42"
 */
export function formatDateTime(
  date: Date | string | null,
  timeFormat: TimeFormat,
  opts?: FormatOpts,
): string {
  const d = toDate(date);
  if (!d) return opts?.fallback ?? "N/A";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: isHour12(timeFormat),
    timeZone: opts?.timezone || undefined,
  });
}

/**
 * "3:42:05 PM" or "15:42:05"
 */
export function formatTime(
  date: Date | string | null,
  timeFormat: TimeFormat,
  opts?: FormatOpts,
): string {
  const d = toDate(date);
  if (!d) return opts?.fallback ?? "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: isHour12(timeFormat),
    timeZone: opts?.timezone || undefined,
  });
}

/**
 * "3:42 PM" or "15:42"
 */
export function formatTimeShort(
  date: Date | string | null,
  timeFormat: TimeFormat,
  opts?: FormatOpts,
): string {
  const d = toDate(date);
  if (!d) return opts?.fallback ?? "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: isHour12(timeFormat),
    timeZone: opts?.timezone || undefined,
  });
}

/**
 * Build hour picker options for schedule selectors.
 * Returns [{value: 0, label: "12:00 AM"}, ...] or [{value: 0, label: "00:00"}, ...]
 */
export function buildHourOptions(
  timeFormat: TimeFormat,
): { value: number; label: string }[] {
  return Array.from({ length: 24 }, (_, i) => {
    if (isHour12(timeFormat)) {
      const ampm = i < 12 ? "AM" : "PM";
      const h12 = i === 0 ? 12 : i > 12 ? i - 12 : i;
      return { value: i, label: `${h12}:00 ${ampm}` };
    }
    return { value: i, label: `${String(i).padStart(2, "0")}:00` };
  });
}
