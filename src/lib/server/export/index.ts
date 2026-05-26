/**
 * Export/Import Module
 *
 * Supports two scopes:
 * - "profile": Resume/CV/portfolio data only
 * - "full": Complete account data including job tracking
 *
 * And two formats:
 * - JSON: Data only (no media files)
 * - ZIP: Data + media files
 */

// Types
export type {
  ExportScope,
  ExportFormat,
  ExportOptions,
  MediaFile,
  ExportEnvelope,
  ExportedProfileData,
  ProfileExportData,
  FullExportData,
  ExportData,
} from "./types";

// Export functions
export { buildProfileExport, getProfileName } from "./export-profile";
export { buildFullExport } from "./export-full";
export { createExportZip, parseExportZip } from "./export-zip";

// Import functions
export {
  importExportData,
  validateExportData,
  isLegacyFormat,
} from "./import-data";
export {
  importMediaFiles,
  deleteProfileMediaFiles,
} from "./import-media";

// Settings export/import (search_tasks, match_config, email digest, salary)
export {
  buildSettingsExport,
  defaultSettingsExportOptions,
  type SettingsExportOptions,
} from "./settings-export";
export {
  importSettings,
  validateSettingsExport,
  type SettingsImportOptions,
  type SettingsImportSummary,
} from "./settings-import";
export type {
  SettingsExportData,
  ExportedSearchTask,
  ExportedMatchConfig,
  ExportedEmailDigest,
  ExportedSalary,
  ExportedSalaryExpectation,
} from "./settings-types";
