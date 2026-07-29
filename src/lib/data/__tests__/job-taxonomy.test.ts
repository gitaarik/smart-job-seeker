/**
 * Tests for `classifyRegion`.
 *
 * The classifier walks pattern lists in region order (US first, then UK, then
 * Western Europe, …) and returns the first hit. That makes short patterns
 * dangerous: a two-letter US state code matched with `includes` also matches
 * the start of a country name, so ", ne" claimed ", netherlands" and ", de"
 * claimed ", denmark" — every Dutch and Danish job with a country-qualified
 * location was being filed under `us`.
 *
 * The regression cases below pin that class of bug shut, both for the US
 * codes and for the short city names (gent/roma/nice/bern/porto) that would
 * reintroduce it inside Western Europe.
 */
import { describe, expect, it } from "vitest";
import { classifyRegion } from "../job-taxonomy";

describe("classifyRegion", () => {
  it("returns null for empty input", () => {
    expect(classifyRegion(null)).toBeNull();
    expect(classifyRegion(undefined)).toBeNull();
    expect(classifyRegion("")).toBeNull();
    expect(classifyRegion("   ")).toBeNull();
  });

  it("strips work-arrangement suffixes before matching", () => {
    expect(classifyRegion("Amsterdam (Remote)")).toBe("western_europe");
    expect(classifyRegion("Austin, TX (Hybrid)")).toBe("us");
  });

  describe("US state codes match as whole tokens", () => {
    it.each([
      ["Austin, TX", "us"],
      ["Boston, MA 02101", "us"],
      ["Portland, OR", "us"],
      ["Washington, DC", "us"],
      ["San Francisco, CA", "us"],
      ["Denver, CO", "us"],
      ["New York, NY", "us"],
      ["Seattle, WA", "us"],
      ["Chicago, IL", "us"],
      ["Omaha, NE", "us"],
    ])("%s -> %s", (input, want) => {
      expect(classifyRegion(input)).toBe(want);
    });

    // Each of these used to be swallowed by a US state-code prefix.
    it.each([
      ["Amsterdam, Netherlands", "western_europe"],
      ["Rotterdam, Netherlands", "western_europe"],
      ["Copenhagen, Denmark", "western_europe"],
      ["Riga, Latvia", "eastern_europe"],
      ["Mumbai, India", "asia_pacific"],
      ["Mexico City, Mexico", "latin_america"],
    ])("%s is not US — it's %s", (input, want) => {
      expect(classifyRegion(input)).toBe(want);
    });
  });

  describe("Western European cities", () => {
    it.each([
      "Copenhagen",
      "Aarhus",
      "Stockholm",
      "Gothenburg",
      "Malmö",
      "Oslo",
      "Bergen",
      "Helsinki",
      "Reykjavik",
      "Dublin",
      "Vienna",
      "Zurich",
      "Geneva",
      "Brussels",
      "Ghent",
      "Antwerp",
      "Lisbon",
      "Porto",
      "Milan",
      "Roma",
      "Athens",
      "Nice",
      "Luxembourg",
      "Leipzig",
      "Bordeaux",
    ])("%s -> western_europe", (city) => {
      expect(classifyRegion(city)).toBe("western_europe");
    });

    // Short city patterns must not match inside longer, unrelated names.
    it.each([
      ["Buenos Aires, Argentina", "latin_america"], // "gent" in Argentina
      ["Bucharest, Romania", "eastern_europe"], // "roma" in Romania
      ["Porto Alegre, Brazil", "latin_america"], // Porto, but Brazilian
    ])("%s -> %s", (input, want) => {
      expect(classifyRegion(input)).toBe(want);
    });

    it("still matches a city inside a longer string", () => {
      expect(classifyRegion("Venice, Italy")).toBe("western_europe");
    });
  });

  describe("other regions are unaffected", () => {
    it.each([
      ["London, UK", "uk"],
      ["Berlin, Germany", "western_europe"],
      ["Warsaw, Poland", "eastern_europe"],
      ["Dubai, UAE", "middle_east"],
      ["Singapore", "asia_pacific"],
    ])("%s -> %s", (input, want) => {
      expect(classifyRegion(input)).toBe(want);
    });
  });

  it("returns null for something it can't place", () => {
    expect(classifyRegion("Somewhere Nice-ish")).not.toBe("us");
    expect(classifyRegion("qwertyville")).toBeNull();
  });
});
