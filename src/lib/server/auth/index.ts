/**
 * Auth module - re-exports all authentication-related functionality
 */

// Platform authentication
export {
  getPlatformCredentials,
  type PlatformCredentials,
  updateLoginError,
} from "./platform";

// Token generation
export { generateToken, hashToken } from "./token-generator";

// Token validation
export {
  incrementTokenVisit,
  type TokenValidationResult,
  validateToken,
} from "./token-validation";
