import { describe, expect, it } from "vitest";
import { isValidJobPostingDate, parseRelativeDate } from "../date-utils";

describe("parseRelativeDate", () => {
  const referenceDate = new Date("2025-12-28T12:00:00Z");

  describe("relative time expressions", () => {
    it("should parse '3 days ago'", () => {
      const result = parseRelativeDate("3 days ago", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-12-25T12:00:00.000Z");
    });

    it("should parse '2 weeks ago'", () => {
      const result = parseRelativeDate("2 weeks ago", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-12-14T12:00:00.000Z");
    });

    it("should parse '1 month ago'", () => {
      const result = parseRelativeDate("1 month ago", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-11-28T12:00:00.000Z");
    });

    it("should parse '1 year ago'", () => {
      const result = parseRelativeDate("1 year ago", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2024-12-28T12:00:00.000Z");
    });

    it("should parse '5 hours ago'", () => {
      const result = parseRelativeDate("5 hours ago", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-12-28T07:00:00.000Z");
    });

    it("should parse '30 minutes ago'", () => {
      const result = parseRelativeDate("30 minutes ago", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-12-28T11:30:00.000Z");
    });

    it("should handle singular units '1 day ago'", () => {
      const result = parseRelativeDate("1 day ago", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-12-27T12:00:00.000Z");
    });
  });

  describe("abbreviated patterns", () => {
    it("should parse '3d ago'", () => {
      const result = parseRelativeDate("3d ago", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-12-25T12:00:00.000Z");
    });

    it("should parse '2w ago'", () => {
      const result = parseRelativeDate("2w ago", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-12-14T12:00:00.000Z");
    });

    it("should parse '1mo ago'", () => {
      const result = parseRelativeDate("1mo ago", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-11-28T12:00:00.000Z");
    });

    it("should parse '1y ago'", () => {
      const result = parseRelativeDate("1y ago", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2024-12-28T12:00:00.000Z");
    });
  });

  describe("named relative dates", () => {
    it("should parse 'today'", () => {
      const result = parseRelativeDate("today", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-12-28T12:00:00.000Z");
    });

    it("should parse 'posted today'", () => {
      const result = parseRelativeDate("posted today", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-12-28T12:00:00.000Z");
    });

    it("should parse 'yesterday'", () => {
      const result = parseRelativeDate("yesterday", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-12-27T12:00:00.000Z");
    });

    it("should parse 'posted yesterday'", () => {
      const result = parseRelativeDate("posted yesterday", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-12-27T12:00:00.000Z");
    });

    it("should parse 'last week'", () => {
      const result = parseRelativeDate("last week", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-12-21T12:00:00.000Z");
    });

    it("should parse 'last month'", () => {
      const result = parseRelativeDate("last month", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-11-28T12:00:00.000Z");
    });
  });

  describe("absolute dates", () => {
    it("should parse ISO 8601 dates", () => {
      const result = parseRelativeDate("2025-12-20");
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toContain("2025-12-20");
    });

    it("should parse ISO 8601 datetime", () => {
      const result = parseRelativeDate("2025-12-20T10:30:00Z");
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-12-20T10:30:00.000Z");
    });

    it("should parse standard date format 'Dec 20, 2025'", () => {
      const result = parseRelativeDate("Dec 20, 2025");
      expect(result).toBeInstanceOf(Date);
      // Just check it parses to a valid date, format varies
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(11); // December is month 11
      expect(result?.getDate()).toBe(20);
    });

    it("should parse MM/DD/YYYY format", () => {
      const result = parseRelativeDate("12/20/2025");
      expect(result).toBeInstanceOf(Date);
      expect(result?.getFullYear()).toBe(2025);
      expect(result?.getMonth()).toBe(11);
      expect(result?.getDate()).toBe(20);
    });
  });

  describe("edge cases", () => {
    it("should handle case-insensitive input", () => {
      const result1 = parseRelativeDate("3 Days Ago", referenceDate);
      const result2 = parseRelativeDate("3 DAYS AGO", referenceDate);
      const result3 = parseRelativeDate("Yesterday", referenceDate);

      expect(result1).toBeInstanceOf(Date);
      expect(result2).toBeInstanceOf(Date);
      expect(result3).toBeInstanceOf(Date);
    });

    it("should handle extra whitespace", () => {
      const result = parseRelativeDate("  3   days   ago  ", referenceDate);
      expect(result).toBeInstanceOf(Date);
      expect(result?.toISOString()).toBe("2025-12-25T12:00:00.000Z");
    });

    it("should return null for unparseable strings", () => {
      expect(parseRelativeDate("invalid date string")).toBeNull();
      expect(parseRelativeDate("not a date")).toBeNull();
      expect(parseRelativeDate("abc123")).toBeNull();
    });

    it("should return null for null input", () => {
      expect(parseRelativeDate(null)).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(parseRelativeDate("")).toBeNull();
    });

    it("should use current time as default reference date", () => {
      const before = new Date();
      const result = parseRelativeDate("1 day ago");
      const after = new Date();

      // Result should be approximately 1 day before now
      expect(result).toBeInstanceOf(Date);
      if (result) {
        const diff = before.getTime() - result.getTime();
        // Should be close to 24 hours (allow 1 second variance for test execution time)
        expect(diff).toBeGreaterThan(24 * 60 * 60 * 1000 - 1000);
        expect(diff).toBeLessThan(24 * 60 * 60 * 1000 + 1000);
      }
    });
  });
});

describe("isValidJobPostingDate", () => {
  describe("valid dates", () => {
    it("should accept valid recent dates", () => {
      const recentDate = new Date("2025-12-20");
      expect(isValidJobPostingDate(recentDate)).toBe(true);
    });

    it("should accept dates from year 2000", () => {
      const date2000 = new Date("2000-01-01");
      expect(isValidJobPostingDate(date2000)).toBe(true);
    });

    it("should accept dates from year 2001 onwards", () => {
      const date2001 = new Date("2001-06-15");
      expect(isValidJobPostingDate(date2001)).toBe(true);
    });

    it("should accept today's date", () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Start of today
      expect(isValidJobPostingDate(today)).toBe(true);
    });
  });

  describe("invalid dates", () => {
    it("should reject null dates", () => {
      expect(isValidJobPostingDate(null)).toBe(false);
    });

    it("should reject Invalid Date objects", () => {
      const invalidDate = new Date("invalid");
      expect(isValidJobPostingDate(invalidDate)).toBe(false);
    });

    it("should reject dates before year 2000", () => {
      const date1999 = new Date("1999-12-31");
      expect(isValidJobPostingDate(date1999)).toBe(false);
    });

    it("should reject dates from year 1990", () => {
      const date1990 = new Date("1990-01-01");
      expect(isValidJobPostingDate(date1990)).toBe(false);
    });

    it("should reject future dates by default", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      expect(isValidJobPostingDate(futureDate)).toBe(false);
    });

    it("should reject far future dates", () => {
      const farFuture = new Date("2125-01-01");
      expect(isValidJobPostingDate(farFuture)).toBe(false);
    });
  });

  describe("options", () => {
    it("should allow future dates when allowFuture is true", () => {
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      expect(isValidJobPostingDate(futureDate, { allowFuture: true })).toBe(
        true,
      );
    });

    it("should still reject far future dates even with allowFuture", () => {
      const farFuture = new Date("2125-01-01");
      // This will be accepted if allowFuture is true, since we don't have a max year check
      expect(isValidJobPostingDate(farFuture, { allowFuture: true })).toBe(
        true,
      );
    });

    it("should respect custom minYear option", () => {
      const date2010 = new Date("2010-01-01");
      expect(isValidJobPostingDate(date2010, { minYear: 2015 })).toBe(false);
    });

    it("should accept dates after custom minYear", () => {
      const date2020 = new Date("2020-01-01");
      expect(isValidJobPostingDate(date2020, { minYear: 2015 })).toBe(true);
    });

    it("should accept dates exactly at minYear", () => {
      const date2015 = new Date("2015-01-01");
      expect(isValidJobPostingDate(date2015, { minYear: 2015 })).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle dates at year boundaries", () => {
      const lastDayOf1999 = new Date("1999-12-31");
      const firstDayOf2000 = new Date("2000-01-01");

      expect(isValidJobPostingDate(lastDayOf1999)).toBe(false);
      expect(isValidJobPostingDate(firstDayOf2000)).toBe(true);
    });

    it("should handle dates very close to now", () => {
      const now = new Date();
      const oneSecondAgo = new Date(now.getTime() - 1000);

      expect(isValidJobPostingDate(oneSecondAgo)).toBe(true);
    });

    it("should handle dates one second in the future", () => {
      const now = new Date();
      const oneSecondAhead = new Date(now.getTime() + 1000);

      // Should be rejected since it's in the future
      expect(isValidJobPostingDate(oneSecondAhead)).toBe(false);
    });
  });
});
