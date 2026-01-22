/**
 * Browser automation module - re-exports all browser-related functionality
 */

// Browser-Use client for AI-powered automation
export {
  BrowserUseClient,
  type BrowserUseConfig,
  type CloudBrowserSession,
  type CloudTask,
  type ExecuteTaskParams,
  type ExecuteTaskResponse,
  type JobData,
  type LoginParams,
  type LoginResponse,
  type ResendCodeResponse,
  type VerifyCodeResponse,
} from "./use-client";

// Browser utilities
export {
  type BrowserLaunchOptions,
  findChromeExecutable,
  launchBrowser,
  waitForJobContentToLoad,
} from "./utils";

// Browser with authentication - getPlatformIdFromUrl
export { getPlatformIdFromUrl } from "./with-auth";

// CDP utilities
export { markClickableElementsInContainer } from "./cdp-utils";

// Stealth utilities
export {
  humanClick,
  humanClickSequence,
  humanDelay,
  humanWait,
  injectStealthScripts,
} from "./stealth-utils";

// Fingerprint utilities
export {
  type FingerprintOptions,
  generateFingerprint,
  generateFingerprintOptions,
} from "./fingerprint-utils";

// Patchright login
export {
  detectLoginFields,
  fillLoginForm,
  performPatchwrightLogin,
} from "./patchright-login";
