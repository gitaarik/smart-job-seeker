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
  /** Presentation template id; the default template is omitted from the URL. */
  template?: string | null;
}

export function profileDocUrl(options: ProfileDocUrlOptions): string {
  const { profileSlug, docType, versionSlug, isPublicVersion, pdf, template } =
    options;
  const path = `/p/${profileSlug}/${docType}${pdf ? ".pdf" : ""}`;

  const params = new URLSearchParams();
  if (versionSlug && !isPublicVersion) {
    params.set("version", versionSlug);
  }
  if (template && template !== "default") {
    params.set("template", template);
  }

  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}
