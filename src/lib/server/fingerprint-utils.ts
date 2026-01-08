/**
 * Browser fingerprint utilities using Apify fingerprint-suite
 * Provides fingerprint generation options for bot detection avoidance
 */

export interface FingerprintOptions {
  /**
   * Browser type to generate fingerprints for
   * @default "chrome"
   */
  browserName?: "chrome" | "firefox" | "safari";

  /**
   * Device type to emulate
   * @default "desktop"
   */
  deviceCategory?: "desktop" | "mobile";

  /**
   * Operating system to emulate
   * Multiple can be provided for random selection
   */
  operatingSystems?: ("windows" | "linux" | "macos" | "android" | "ios")[];

  /**
   * Locales to randomly select from
   * @default ["en-US", "en-GB"]
   */
  locales?: string[];
}

/**
 * Generate fingerprint options for newInjectedContext
 * Returns configuration compatible with fingerprint-injector
 *
 * @param options Fingerprint generation options
 * @returns Configuration object for newInjectedContext
 */
export function generateFingerprintOptions(options: FingerprintOptions = {}) {
  return {
    devices: [options.deviceCategory || "desktop"],
    operatingSystems: options.operatingSystems || ["windows", "linux", "macos"],
    locales: options.locales || ["en-US", "en-GB", "en"],
    browsers: [
      {
        name: options.browserName || "chrome",
        minVersion: 120,
      },
    ],
  };
}
