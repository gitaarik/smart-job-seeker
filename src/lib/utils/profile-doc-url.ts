/**
 * Build URLs for public profile document pages (resume/cv).
 */

export type DocType = "resume" | "cv";

interface ProfileDocUrlOptions {
  profileSlug: string;
  docType: DocType;
  versionSlug?: string | null;
  isPublicVersion?: boolean;
  pdf?: boolean;
}

export function profileDocUrl(options: ProfileDocUrlOptions): string {
  const { profileSlug, docType, versionSlug, isPublicVersion, pdf } = options;
  const path = `/p/${profileSlug}/${docType}${pdf ? ".pdf" : ""}`;
  if (versionSlug && !isPublicVersion) {
    return `${path}?version=${encodeURIComponent(versionSlug)}`;
  }
  return path;
}
