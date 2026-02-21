/**
 * Export full account data (profile + all additional data)
 */

import { dbDirect } from "$lib/server/db";
import { buildProfileExport } from "./export-profile";
import type {
  FullExportData,
  MediaFile,
  ExportedProjectStory,
  ExportedCheatSheet,
  ExportedSalaryExpectation,
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
  const [projectStories, cheatSheets, salaryExpectations, applications] =
    await Promise.all([
      // Project stories
      dbDirect.project_stories.findMany({
        where: { profile: profileId },
        select: {
          sort: true,
          title: true,
          situation: true,
          task: true,
          action: true,
          result: true,
          reflection: true,
          category: true,
        },
        orderBy: { sort: "asc" },
      }),

      // Cheat sheets
      dbDirect.cheat_sheets.findMany({
        where: { profile: profileId },
        select: {
          sort: true,
          title: true,
          content: true,
        },
        orderBy: { sort: "asc" },
      }),

      // Salary expectations
      dbDirect.salary_expectations.findMany({
        where: { profile: profileId },
        select: {
          sort: true,
          job_title: true,
          company_type: true,
          employment_type: true,
          work_arrangement: true,
          region: true,
          hourly_rate: true,
          month_salary: true,
          year_salary: true,
          daily_rate: true,
        },
        orderBy: { sort: "asc" },
      }),

      // Applications with related data
      dbDirect.applications.findMany({
        where: { profile: profileId },
        include: {
          jobs: {
            select: {
              title: true,
              company: true,
              source_url: true,
            },
          },
          application_letters: {
            select: {
              letter_type: true,
              content: true,
            },
          },
          application_questions: {
            select: {
              question: true,
              answer: true,
            },
          },
        },
        orderBy: { date_created: "desc" },
      }),
    ]);

  // Transform project stories
  const exportedProjectStories: ExportedProjectStory[] = projectStories.map(
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
  const exportedCheatSheets: ExportedCheatSheet[] = cheatSheets.map((cs) => ({
    sort: cs.sort,
    title: cs.title || undefined,
    content: cs.content || undefined,
  }));

  // Transform salary expectations
  const exportedSalaryExpectations: ExportedSalaryExpectation[] =
    salaryExpectations.map((se) => ({
      sort: se.sort,
      job_title: se.job_title || undefined,
      company_type: se.company_type || undefined,
      employment_type: se.employment_type || undefined,
      work_arrangement: se.work_arrangement || undefined,
      region: se.region || undefined,
      hourly_rate: se.hourly_rate ? Number(se.hourly_rate) : null,
      month_salary: se.month_salary ? Number(se.month_salary) : null,
      year_salary: se.year_salary ? Number(se.year_salary) : null,
      daily_rate: se.daily_rate ? Number(se.daily_rate) : null,
    }));

  // Transform applications
  const exportedApplications: ExportedApplication[] = applications.map(
    (app) => ({
      status: app.status || undefined,
      job_title: app.jobs?.title || undefined,
      company: app.jobs?.company || undefined,
      source_url: app.jobs?.source_url || undefined,
      application_sent_date: app.application_sent_date?.toISOString().split("T")[0],
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
    salary_expectations: exportedSalaryExpectations,
    applications: exportedApplications,
  };

  return { data: exportData, mediaFiles };
}
