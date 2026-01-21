/**
 * Data merging utilities for job extraction
 */

import { parseRelativeDate } from "$lib/tools/date-utils";

/**
 * Merge skills from search page and detail page, deduplicating case-insensitively
 * @param searchSkills Skills array from search page extraction
 * @param detailSkills Skills array from detail page extraction
 * @returns Merged and deduplicated skills array, or null if both are null
 */
export function mergeSkills(
  searchSkills: string[] | null,
  detailSkills: string[] | null,
): string[] | null {
  if (!searchSkills && !detailSkills) return null;
  if (!searchSkills) return detailSkills;
  if (!detailSkills) return searchSkills;

  // Deduplicate case-insensitively, preserving first occurrence's casing
  const seen = new Map<string, string>();
  for (const skill of [...searchSkills, ...detailSkills]) {
    const lower = skill.toLowerCase();
    if (!seen.has(lower)) {
      seen.set(lower, skill); // First occurrence wins
    }
  }
  return Array.from(seen.values());
}

/**
 * Merge job data from search page and detail page
 * Priority: Detail page wins for all fields except skills (which are merged)
 * Search page data serves as fallback when detail page has null values
 * @param searchData Partial job data from search results page
 * @param detailData Complete job data from detail page
 * @returns Merged job data with detail page taking priority
 */
export function mergeJobData(
  searchData: Partial<{
    clickableId: number;
    title: string | null;
    company: string | null;
    location: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    salary_period: string | null;
    skills: string[] | null;
    remote: string | null;
    date_posted: string | null;
  }>,
  detailData: {
    title: string | null;
    job_description: string | null;
    company_description: string | null;
    job_poster: string | null;
    date_posted: Date | null;
    location: string | null;
    remote: string | null;
    experience_level: string | null;
    job_type: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    salary_period: string | null;
    skills: string[] | null;
    status: string | null;
    source_html_stripped: string;
    ai_chat_extraction: number | null;
  },
): typeof detailData {
  return {
    // Always from detail (not extracted from search)
    job_description: detailData.job_description,
    company_description: detailData.company_description,
    experience_level: detailData.experience_level,
    job_type: detailData.job_type,
    status: detailData.status,
    source_html_stripped: detailData.source_html_stripped,
    ai_chat_extraction: detailData.ai_chat_extraction,

    // Detail wins, search fallback (using || for strings, ?? for numbers)
    title: detailData.title || searchData.title || "Untitled Position",
    job_poster: detailData.job_poster || searchData.company || null,
    location: detailData.location || searchData.location || null,
    remote: detailData.remote || searchData.remote || null,

    // Date: Detail wins, or parse search date if detail is null
    date_posted: detailData.date_posted ||
      (searchData.date_posted
        ? parseRelativeDate(searchData.date_posted)
        : null),

    // Salary: Detail wins, search fallback (use ?? to preserve 0 values)
    salary_min: detailData.salary_min ?? searchData.salary_min ?? null,
    salary_max: detailData.salary_max ?? searchData.salary_max ?? null,
    salary_currency: detailData.salary_currency || searchData.salary_currency ||
      null,
    salary_period: detailData.salary_period || searchData.salary_period || null,

    // Skills: MERGE both sources (deduplicate)
    skills: mergeSkills(searchData.skills || null, detailData.skills),
  };
}
