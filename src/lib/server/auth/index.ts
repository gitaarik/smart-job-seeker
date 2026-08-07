/**
 * Auth module - re-exports all authentication-related functionality
 */

// Platform authentication
export { updateLoginError } from './platform';

// Credential encryption
export { encryptCredential, decryptCredential } from './crypto';

// Token generation
export { generateToken, hashToken } from './token-generator';

// Token validation
export { incrementTokenVisit, type TokenValidationResult, validateToken } from './token-validation';
