import { describe, expect, it } from "vitest";
import { isProfileOnly, setProfileOnly } from "./profile-visibility";

describe("isProfileOnly", () => {
  it("needs both base templates excluded", () => {
    expect(isProfileOnly(["!resume", "!cv"])).toBe(true);
    expect(isProfileOnly(["!resume"])).toBe(false);
    expect(isProfileOnly(["!cv"])).toBe(false);
    expect(isProfileOnly([])).toBe(false);
    expect(isProfileOnly(null)).toBe(false);
  });

  it("ignores casing, whitespace and per-version tags", () => {
    expect(isProfileOnly(["!Resume", " !CV ", "backend"])).toBe(true);
  });
});

describe("setProfileOnly", () => {
  it("adds both exclusions and drops contradictory positives", () => {
    expect(setProfileOnly(["cv"], true)).toEqual(["!resume", "!cv"]);
    expect(setProfileOnly(null, true)).toEqual(["!resume", "!cv"]);
  });

  it("keeps per-version tags in both directions", () => {
    expect(setProfileOnly(["backend"], true)).toEqual([
      "!resume",
      "!cv",
      "backend",
    ]);
    // Turning it off degrades to "shown, but only on backend" rather than
    // silently dropping the version restriction.
    expect(setProfileOnly(["!resume", "!cv", "backend"], false)).toEqual([
      "backend",
    ]);
  });

  it("leaves a version exclusion alone when turning off", () => {
    expect(setProfileOnly(["!resume", "!cv", "!senior"], false)).toEqual([
      "!senior",
    ]);
  });

  it("round-trips", () => {
    const on = setProfileOnly(["backend"], true);
    expect(isProfileOnly(on)).toBe(true);
    expect(isProfileOnly(setProfileOnly(on, false))).toBe(false);
  });
});
