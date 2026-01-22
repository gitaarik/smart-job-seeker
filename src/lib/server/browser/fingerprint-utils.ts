/**
 * Browser fingerprint utilities using Apify fingerprint-suite
 * Provides fingerprint generation and persistence for bot detection avoidance
 */

import { FingerprintGenerator } from "fingerprint-generator";

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
 * Generate a complete browser fingerprint
 * This fingerprint can be saved and reused later
 *
 * @param options Fingerprint generation options
 * @returns Generated fingerprint object
 */
export function generateFingerprint(options: FingerprintOptions = {}) {
  const generator = new FingerprintGenerator({
    devices: [options.deviceCategory || "desktop"],
    operatingSystems: options.operatingSystems || ["windows", "linux", "macos"],
    locales: options.locales || ["en-US", "en-GB", "en"],
    browsers: [
      {
        name: options.browserName || "chrome",
        minVersion: 120,
      },
    ],
  });

  const fingerprint = generator.getFingerprint();

  console.log("🔐 Generated browser fingerprint:");
  console.log(`   User Agent: ${fingerprint.fingerprint.navigator.userAgent}`);
  console.log(
    `   Screen: ${fingerprint.fingerprint.screen.width}x${fingerprint.fingerprint.screen.height}`,
  );

  return fingerprint;
}

/**
 * Generate fingerprint options for newInjectedContext (for when we don't need to save it)
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
