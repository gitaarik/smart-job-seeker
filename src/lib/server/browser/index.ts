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
export { type BrowserLaunchOptions, launchBrowser } from "./utils";

// CDP utilities
export { markClickableElementsInContainer } from "./cdp-utils";

// Stealth utilities
export { humanClick, humanWait, injectStealthScripts } from "./stealth-utils";
