/**
 * Tests for Geo-location Utilities
 */

import { describe, expect, it } from "vitest";
import { getGeoConfig, getTimezone, getLocale, getLanguage } from "../geo-utils";

describe("getGeoConfig", () => {
  it("returns config for US", () => {
    const config = getGeoConfig("US");
    expect(config.timezone).toBe("America/New_York");
    expect(config.locale).toBe("en-US");
    expect(config.language).toBe("en-US,en");
  });

  it("returns config for NL", () => {
    const config = getGeoConfig("NL");
    expect(config.timezone).toBe("Europe/Amsterdam");
    expect(config.locale).toBe("nl-NL");
    expect(config.language).toBe("nl-NL,nl,en");
  });

  it("returns config for DE", () => {
    const config = getGeoConfig("DE");
    expect(config.timezone).toBe("Europe/Berlin");
    expect(config.locale).toBe("de-DE");
  });

  it("returns config for JP", () => {
    const config = getGeoConfig("JP");
    expect(config.timezone).toBe("Asia/Tokyo");
    expect(config.locale).toBe("ja-JP");
  });

  it("handles lowercase country codes", () => {
    expect(getGeoConfig("nl")).toEqual(getGeoConfig("NL"));
    expect(getGeoConfig("us")).toEqual(getGeoConfig("US"));
  });

  it("handles mixed case", () => {
    expect(getGeoConfig("Nl")).toEqual(getGeoConfig("NL"));
  });

  it("falls back to US for unknown country", () => {
    expect(getGeoConfig("XX")).toEqual(getGeoConfig("US"));
    expect(getGeoConfig("ZZ")).toEqual(getGeoConfig("US"));
  });

  it("returns all three fields", () => {
    const config = getGeoConfig("BR");
    expect(config).toHaveProperty("timezone");
    expect(config).toHaveProperty("locale");
    expect(config).toHaveProperty("language");
  });
});

describe("getTimezone", () => {
  it("returns timezone string", () => {
    expect(getTimezone("NL")).toBe("Europe/Amsterdam");
    expect(getTimezone("GB")).toBe("Europe/London");
    expect(getTimezone("AU")).toBe("Australia/Sydney");
  });

  it("falls back to US timezone for unknown", () => {
    expect(getTimezone("XX")).toBe("America/New_York");
  });
});

describe("getLocale", () => {
  it("returns locale string", () => {
    expect(getLocale("FR")).toBe("fr-FR");
    expect(getLocale("ES")).toBe("es-ES");
    expect(getLocale("IN")).toBe("en-IN");
  });

  it("falls back to US locale for unknown", () => {
    expect(getLocale("XX")).toBe("en-US");
  });
});

describe("getLanguage", () => {
  it("returns language header value", () => {
    expect(getLanguage("DE")).toBe("de-DE,de,en");
    expect(getLanguage("NL")).toBe("nl-NL,nl,en");
  });

  it("includes multiple languages for multilingual countries", () => {
    expect(getLanguage("CH")).toContain("de");
    expect(getLanguage("CH")).toContain("fr");
    expect(getLanguage("BE")).toContain("nl");
    expect(getLanguage("BE")).toContain("fr");
  });

  it("falls back to US language for unknown", () => {
    expect(getLanguage("XX")).toBe("en-US,en");
  });
});
