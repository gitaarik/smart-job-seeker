/**
 * Server-side loading of per-profile resume/CV templates.
 */

import { dbDirect as db } from "$lib/server/db";
import { eq, and, asc } from "drizzle-orm";
import { resume_templates } from "$lib/server/db/schema";
import type {
  ResumeTemplate,
  ResumeTemplateConfig,
} from "$lib/resume-templates";

function toTemplate(r: {
  id: number;
  name: string;
  slug: string;
  config: unknown;
}): ResumeTemplate {
  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    config: (r.config ?? {}) as ResumeTemplateConfig,
  };
}

/** All published templates for a profile, in sort order. */
export async function getResumeTemplatesForProfile(
  profileId: number,
): Promise<ResumeTemplate[]> {
  const rows = await db.query.resume_templates.findMany({
    where: and(
      eq(resume_templates.profile_id, profileId),
      eq(resume_templates.status, "published"),
    ),
    orderBy: asc(resume_templates.sort),
  });
  return rows.map(toTemplate);
}

/** A single published template by slug, or null. */
export async function getResumeTemplate(
  profileId: number,
  slug: string,
): Promise<ResumeTemplate | null> {
  const row = await db.query.resume_templates.findFirst({
    where: and(
      eq(resume_templates.profile_id, profileId),
      eq(resume_templates.slug, slug),
      eq(resume_templates.status, "published"),
    ),
  });
  return row ? toTemplate(row) : null;
}
