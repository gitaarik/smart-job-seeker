/**
 * Export full account data (profile + all additional data)
 */

import { dbDirect } from "$lib/server/db";
import { eq, desc, asc } from "drizzle-orm";
import { project_stories, cheat_sheets, profiles } from "$lib/server/db/schema";
import { buildProfileExport } from "./export-profile";
import type {
  FullExportData,
  MediaFile,
  ExportedProjectStory,
  ExportedCheatSheet,
  ExportedSalarySettings,
  ExportedApplication,
} from "./types";

/**
 * Build full account export data
 */
export async function buildFullExport(
  profileId: number,
  includeMedia: boolean = false,
): Promise<{ data: FullExportData; mediaFiles: MediaFile[] }> {
  // Start with profile data
  const { data: profileExport, mediaFiles } = await buildProfileExport(
    profileId,
    includeMedia,
  );

  // Fetch additional data
  const [projectStoriesData, cheatSheetsData, profile, applications] =
    await Promise.all([
      // Project stories
      dbDirect.query.project_stories.findMany({
        where: eq(project_stories.profile_id, profileId),
        columns: {
          sort: true,
          title: true,
          situation: true,
          task: true,
          action: true,
          result: true,
          reflection: true,
          category: true,
        },
        orderBy: asc(project_stories.sort),
      }),

      // Cheat sheets
      dbDirect.query.cheat_sheets.findMany({
        where: eq(cheat_sheets.profile_id, profileId),
        columns: {
          sort: true,
          title: true,
          content: true,
        },
        orderBy: asc(cheat_sheets.sort),
      }),

      // Profile salary settings
      dbDirect.query.profiles.findFirst({
        where: eq(profiles.id, profileId),
        columns: {
          salary_base_rate: true,
          salary_currency: true,
          salary_adjustments: true,
          salary_region_overrides: true,
        },
      }),

      // Applications with related data
      dbDirect.query.applications.findMany({
        where: (t: any, { eq }: any) => eq(t.profile_id, profileId),
        with: {
          job: {
            columns: {
              title: true,
              company: true,
              source_url: true,
            },
          },
          application_letters: {
            columns: {
              letter_type: true,
              content: true,
            },
          },
          application_questions: {
            columns: {
              question: true,
              answer: true,
            },
          },
        },
        orderBy: (t: any, { desc }: any) => desc(t.date_created),
      }),
    ]);

  // Transform project stories
  const exportedProjectStories: ExportedProjectStory[] = projectStoriesData.map(
    (ps) => ({
      sort: ps.sort,
      title: ps.title || undefined,
      situation: ps.situation || undefined,
      task: ps.task || undefined,
      action: ps.action || undefined,
      result: ps.result || undefined,
      reflection: ps.reflection || undefined,
      category: ps.category || undefined,
    }),
  );

  // Transform cheat sheets
  const exportedCheatSheets: ExportedCheatSheet[] = cheatSheetsData.map((cs) => ({
    sort: cs.sort,
    title: cs.title || undefined,
    content: cs.content || undefined,
  }));

  // Transform salary settings
  const exportedSalarySettings: ExportedSalarySettings = {
    base_rate: profile?.salary_base_rate ?? null,
    currency: profile?.salary_currency ?? "EUR",
    adjustments: (profile?.salary_adjustments as Record<string, Record<string, number>> | null) ?? undefined,
    region_overrides: (profile?.salary_region_overrides as Record<string, number> | null) ?? undefined,
  };

  // Transform applications
  const exportedApplications: ExportedApplication[] = applications.map(
    (app) => ({
      status: app.status || undefined,
      job_title: app.job?.title || undefined,
      company: app.job?.company || undefined,
      source_url: app.job?.source_url || undefined,
      application_sent_date: app.application_sent_date
        ? (app.application_sent_date instanceof Date
            ? app.application_sent_date.toISOString().split("T")[0]
            : String(app.application_sent_date))
        : undefined,
      application_note: app.application_note || undefined,
      salary_expectation: app.salary_expectation
        ? Number(app.salary_expectation)
        : undefined,
      salary_currency: app.salary_currency || undefined,
      salary_period: app.salary_period || undefined,
      letters: app.application_letters.map((l: { letter_type: string; content: string | null }) => ({
        type: l.letter_type || undefined,
        content: l.content || undefined,
      })),
      questions: app.application_questions.map((q: { question: string | null; answer: string | null }) => ({
        question: q.question || undefined,
        answer: q.answer || undefined,
      })),
    }),
  );

  // Build full export data
  const exportData: FullExportData = {
    version: "2.0",
    exported_at: new Date().toISOString(),
    scope: "full",
    has_media: includeMedia && mediaFiles.length > 0,
    media_files: includeMedia && mediaFiles.length > 0 ? mediaFiles : undefined,
    profile: profileExport.profile,
    project_stories: exportedProjectStories,
    cheat_sheets: exportedCheatSheets,
    salary_settings: exportedSalarySettings,
    applications: exportedApplications,
  };

  return { data: exportData, mediaFiles };
}
