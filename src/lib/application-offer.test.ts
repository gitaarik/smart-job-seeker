import { describe, expect, it } from "vitest";
import {
  deadlineState,
  formatOfferAmount,
  hasOfferContent,
  isCurrencyCode,
  type OfferTerms,
} from "./application-offer";

const offer = (over: Partial<OfferTerms> = {}): OfferTerms => ({
  base: null,
  bonus: null,
  equity: null,
  currency: null,
  period: null,
  start_date: null,
  respond_by: null,
  notes: null,
  ...over,
});

describe("isCurrencyCode", () => {
  it("accepts three upper-case letters", () => {
    expect(isCurrencyCode("EUR")).toBe(true);
  });

  it("rejects what coerceOffer lets through", () => {
    // coerceOffer upper-cases and truncates to 8 rather than validating, so
    // these are the shapes that actually arrive.
    expect(isCurrencyCode("DOLLARS")).toBe(false);
    expect(isCurrencyCode("€")).toBe(false);
    expect(isCurrencyCode(null)).toBe(false);
  });
});

describe("formatOfferAmount", () => {
  it("is null when no amount was stated", () => {
    expect(formatOfferAmount(offer({ bonus: "10%" }))).toBeNull();
  });

  it("formats a stated amount in its stated currency", () => {
    const text = formatOfferAmount(
      offer({ base: 92000, currency: "EUR", period: "year" }),
    );
    expect(text).toContain("92,000");
    expect(text).toMatch(/€|EUR/);
    expect(text).toContain("/ year");
  });

  it("never invents a currency when none was stated", () => {
    const text = formatOfferAmount(offer({ base: 92000, period: "year" }));
    // The bug this exists to prevent: printing "€92,000" for an employer who
    // only ever said "92k".
    expect(text).toBe("92,000 / year");
    expect(text).not.toMatch(/€|\$|EUR|USD/);
  });

  it("shows an unrecognised currency verbatim instead of throwing", () => {
    // Intl.NumberFormat throws RangeError on an unknown code, which would take
    // the page down over one loose extraction.
    expect(() => formatOfferAmount(offer({ base: 92000, currency: "DOLLARS" })))
      .not.toThrow();
    expect(formatOfferAmount(offer({ base: 92000, currency: "DOLLARS" })))
      .toBe("92,000 DOLLARS");
  });

  it("omits the period when none was stated", () => {
    expect(formatOfferAmount(offer({ base: 5000, currency: "EUR" })))
      .not.toContain("/");
  });
});

describe("deadlineState", () => {
  const today = new Date("2026-08-04T14:30:00");

  it("is null without a usable date", () => {
    expect(deadlineState(null, today)).toBeNull();
    expect(deadlineState("next Friday", today)).toBeNull();
  });

  it("still counts today as open in the afternoon", () => {
    // The reason for date-only arithmetic: a timestamp comparison would call
    // this passed from 00:00 onwards.
    expect(deadlineState("2026-08-04", today)).toMatchObject({
      days: 0,
      tone: "urgent",
      label: "today",
    });
  });

  it("names tomorrow rather than counting it", () => {
    expect(deadlineState("2026-08-05", today)?.label).toBe("tomorrow");
  });

  it("escalates as the date approaches", () => {
    expect(deadlineState("2026-08-20", today)?.tone).toBe("normal");
    expect(deadlineState("2026-08-10", today)?.tone).toBe("soon");
    expect(deadlineState("2026-08-06", today)?.tone).toBe("urgent");
  });

  it("counts the days for a date still ahead", () => {
    expect(deadlineState("2026-08-20", today)).toMatchObject({
      days: 16,
      label: "in 16 days",
    });
  });

  it("reports a date that has gone by", () => {
    expect(deadlineState("2026-08-01", today)).toMatchObject({
      days: -3,
      tone: "passed",
      label: "3 days ago",
    });
    expect(deadlineState("2026-08-03", today)?.label).toBe("yesterday");
  });

  it("survives a DST boundary", () => {
    // Midnight-to-midnight is 23 or 25 hours across a change; flooring would
    // lose a day in one direction.
    const beforeChange = new Date("2026-10-24T12:00:00");
    expect(deadlineState("2026-10-26", beforeChange)?.days).toBe(2);
  });
});

describe("hasOfferContent", () => {
  it("rejects null and an offer carrying only a currency", () => {
    expect(hasOfferContent(null)).toBe(false);
    expect(hasOfferContent(offer({ currency: "EUR", period: "year" })))
      .toBe(false);
  });

  it("accepts an offer with any substantive term", () => {
    expect(hasOfferContent(offer({ respond_by: "2026-08-20" }))).toBe(true);
    expect(hasOfferContent(offer({ notes: "30 days leave" }))).toBe(true);
  });
});
