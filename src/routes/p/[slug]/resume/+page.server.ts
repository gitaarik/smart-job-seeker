import { error } from "@sveltejs/kit";
import { getProfileByIdentifier } from "$lib/server/profile/default";
import {
  checkProfileAccess,
  getVersionIdBySlug,
} from "$lib/server/profile/access-control";
import { incrementTokenVisit } from "$lib/server/auth/token-validation";
import { getResumeTemplate } from "$lib/server/profile/resume-templates";
import { DEFAULT_TEMPLATE_ID } from "$lib/resume-templates";
import { isKnownLocale } from "$lib/resume-translations";
import {
  applyTranslations,
  loadTranslator,
} from "$lib/server/profile/translations";
import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({
  params,
  url,
  locals,
  getClientAddress,
}) => {
  const { slug } = params;
  const token = url.searchParams.get("t");

  // Get profile by slug
  const profile = await getProfileByIdentifier(slug);

  if (!profile) {
    throw error(404, {
      message: `Profile not found: ${slug}`,
    });
  }

  // Check access control
  const accessResult = await checkProfileAccess({
    profile,
    token,
    userId: locals.user?.id,
    clientIp: getClientAddress(),
    routeType: "resume",
  });

  if (!accessResult.allowed) {
    throw error(accessResult.statusCode, {
      message: accessResult.message,
    });
  }

  // Increment visit counter if token was used
  if (accessResult.accessType === "token" && accessResult.tokenId) {
    await incrementTokenVisit(accessResult.tokenId, getClientAddress());
  }

  // Resolve version: from access control, query param, or public version fallback
  let versionId = accessResult.versionId;
  if (!versionId && accessResult.accessType === "owner") {
    const versionSlug = url.searchParams.get("version");
    if (versionSlug) {
      versionId = await getVersionIdBySlug(profile.id, versionSlug) ??
        undefined;
    } else if (profile.public_resume_version_id) {
      // Fall back to public version when no specific version requested
      versionId = profile.public_resume_version_id;
    }
  }

  // Resolve the selected presentation template (a DB-backed template config),
  // or null for the built-in default renderer.
  const templateSlug = url.searchParams.get("template");
  const template =
    templateSlug && templateSlug !== DEFAULT_TEMPLATE_ID
      ? await getResumeTemplate(profile.id, templateSlug)
      : null;

  // Overlay non-English translations onto the profile tree (in place) so the
  // render components stay language-agnostic. Base/unknown locale is a no-op.
  const langParam = url.searchParams.get("lang");
  const translator = await loadTranslator(
    profile.id,
    isKnownLocale(langParam) ? langParam : null,
  );
  applyTranslations(profile, translator);

  return {
    profile: {
      ...profile,
      profile_versions: profile
        .profile_versions,
    },
    locale: translator.locale,
    versionId,
    accessType: accessResult.accessType,
    template,
  };
};
