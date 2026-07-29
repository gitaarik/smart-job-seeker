import type { Actions, PageServerLoad } from "./$types";
import { fail, redirect } from "@sveltejs/kit";
import { dbDirect as db } from "$lib/server/db";
import { ilike, or } from "drizzle-orm";
import { applications, application_status_log, job_importers, job_platforms, jobs } from "$lib/server/db/schema";
import { getSelectedProfileId } from "../../profile/utils";
import { parseJobDescription, type ParsedJobDescription } from "$lib/server/jobs/parse-job-description";
import { parseCacheKey, recallParse } from "$lib/server/jobs/parse-cache";
import { triggerMatchForImport } from "$lib/server/job/match-trigger";
import { classifyRegion } from "$lib/data/job-taxonomy";
import { normalizeExperienceLevels, normalizeJobType, normalizeWorkLocation } from "$lib/data/job-normalize";
import { normalizeSalaryPeriod } from "$lib/salary/conversion";

/**
 * Best-effort lookup of a job_platforms row whose URL matches the host of the
 * given job URL, mirroring the domain-candidate matching in
 * /api/platforms/detect. Returns null when the URL is empty/invalid or no
 * platform matches — manual jobs are allowed to have no platform.
 */
async function detectPlatformId(sourceUrl: string | null): Promise<number | null> {
  if (!sourceUrl) return null;
  let domain: string;
  try {
    const parsed = new URL(sourceUrl.startsWith("http") ? sourceUrl : `https://${sourceUrl}`);
    domain = parsed.hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
  const labels = domain.split(".");
  const candidates: string[] = [];
  for (let i = 0; i < Math.max(labels.length - 1, 1); i++) {
    candidates.push(labels.slice(i).join("."));
  }
  const platform = await db.query.job_platforms.findFirst({
    where: or(...candidates.map((d) => ilike(job_platforms.url, `%${d}%`))),
    columns: { id: true },
  });
  return platform?.id ?? null;
}

function parseIntOrNull(value: FormDataEntryValue | null): number | null {
  const n = parseInt(String(value ?? "").trim(), 10);
  return Number.isNaN(n) ? null : n;
}

function strOrNull(value: FormDataEntryValue | null): string | null {
  const s = String(value ?? "").trim();
  return s === "" ? null : s;
}

/**
 * Read a repeated form field (checkbox group) as a canonical string array.
 * Returns null rather than [] so it lines up with the nullable columns and the
 * `?? parsed?.x` fallbacks.
 */
function strArrayOrNull(values: FormDataEntryValue[]): string[] | null {
  const list = values.map((v) => String(v).trim()).filter(Boolean);
  return list.length > 0 ? list : null;
}

export const load: PageServerLoad = async ({ parent }) => {
  const layoutData = await parent();
  if (!layoutData.selectedProfile) {
    redirect(302, "/home");
  }
  return {};
};

export const actions: Actions = {
  default: async ({ request, locals, cookies }) => {
    const user = locals.user;
    if (!user) {
      return fail(401, { error: "Not authenticated" });
    }

    const profileId = await getSelectedProfileId(cookies, user.id);
    if (!profileId) {
      return fail(400, { error: "No profile selected" });
    }

    const formData = await request.formData();
    const title = strOrNull(formData.get("title"));
    const company = strOrNull(formData.get("company"));
    const jobPoster = strOrNull(formData.get("job_poster"));
    const officeLocation = strOrNull(formData.get("office_location"));
    const workLocationForm = strArrayOrNull(formData.getAll("work_location"));
    const jobTypesForm = strArrayOrNull(formData.getAll("job_types"));
    const experienceLevelsForm = strArrayOrNull(
      formData.getAll("experience_levels"),
    );
    const datePostedForm = strOrNull(formData.get("date_posted"));
    const sourceUrl = strOrNull(formData.get("source_url"));
    const jobDescription = strOrNull(formData.get("job_description"));
    const salaryMin = parseIntOrNull(formData.get("salary_min"));
    const salaryMax = parseIntOrNull(formData.get("salary_max"));
    const salaryCurrency = strOrNull(formData.get("salary_currency"));
    const salaryPeriod = strOrNull(formData.get("salary_period"));
    const parseToken = strOrNull(formData.get("parse_token"));
    const parseFailed = formData.get("parse_failed") === "1";

    // Any filled job field turns this into a manual job + linked application;
    // an empty form keeps the original one-click blank-application behavior.
    const hasJobDetails = !!(
      title || company || jobPoster || officeLocation || sourceUrl ||
      jobDescription || salaryMin || salaryMax || workLocationForm ||
      jobTypesForm || experienceLevelsForm || datePostedForm
    );

    const now = new Date();

    let jobId: number | null = null;
    if (hasJobDetails) {
      // Enrich a pasted description the same way the scraper does: extract
      // skills, responsibilities, work location, etc.
      //
      // The page parses up front (POST /api/jobs/parse-description) so the
      // user can review the extracted fields, and hands back the token it got.
      // The token is a hash of the parsed text, so it only resolves while the
      // description is unchanged — editing it in the review step invalidates
      // the token and we re-parse here. We also re-parse when the cache entry
      // has aged out, which recovers the structured fields the form doesn't
      // expose (skills, responsibilities, company description).
      //
      // Best-effort throughout: on any failure (LLM error, no credits) `parsed`
      // is null and we store only what the user typed, so creation is never
      // blocked.
      let parsed: ParsedJobDescription | null = null;
      let tokenMatches = false;
      if (jobDescription) {
        tokenMatches = parseToken === parseCacheKey(profileId, jobDescription);
        if (tokenMatches && parseToken) parsed = recallParse(parseToken);
        // `parse_failed` means extraction already ran on this paste and came
        // back empty — don't burn a second call to fail the same way.
        if (!parsed && !parseFailed) {
          try {
            parsed = await parseJobDescription(jobDescription, { profileId, sourceUrl });
          } catch {
            parsed = null;
          }
        }
      }

      // Did the form the user submitted actually show them this parse? Only
      // then are its inputs authoritative — otherwise clearing a pre-filled
      // field would silently resurrect the parsed value. Without a reviewed
      // parse we keep the original gap-fill semantics: what the user typed
      // wins, the parser fills the blanks.
      const reviewed = tokenMatches;
      const pick = <T>(formValue: T | null, parsedValue: T | null): T | null =>
        reviewed ? formValue : formValue ?? parsedValue;

      // A bare "Remote"/"Hybrid" typed in the location box is a work
      // arrangement, not a city: fold it into work_location rather than lose
      // it, and leave office_location for real physical locations — mirroring
      // upsertJob's split. Outside the review step the parser's dedicated
      // `remote` field takes precedence over that inference.
      const rawLocation = pick(officeLocation, parsed?.location ?? null);
      const typedArrangement = normalizeWorkLocation(rawLocation);
      const effectiveLocation = typedArrangement ? null : rawLocation;

      // Canonicalize taxonomy values even in the review path — the form posts
      // canonical values, but a hand-rolled POST need not.
      const workLocation = reviewed
        ? normalizeWorkLocation(workLocationForm?.join(",") ?? rawLocation)
        : normalizeWorkLocation(parsed?.remote ?? officeLocation ?? null);
      const jobTypes = reviewed
        ? normalizeJobType(jobTypesForm?.join(",") ?? null)
        : normalizeJobType(parsed?.job_type ?? null);
      const experienceLevels = reviewed
        ? normalizeExperienceLevels(experienceLevelsForm)
        : normalizeExperienceLevels(parsed?.experience_levels ?? null);

      const effectiveSalaryPeriod = pick(salaryPeriod, parsed?.salary_period ?? null);
      // date_posted is a Drizzle date() column (string mode); <input type="date">
      // already posts YYYY-MM-DD, but don't take that on trust.
      const parsedDatePosted = parsed?.date_posted
        ? parsed.date_posted.toISOString().split("T")[0]
        : null;
      const datePosted = datePostedForm && /^\d{4}-\d{2}-\d{2}$/.test(datePostedForm)
        ? datePostedForm
        : null;

      // Detect the platform from whichever URL we settled on — the parser can
      // now recover a job URL from the posting text when the user left the
      // field empty, so this has to run after the merge.
      const effectiveSourceUrl = pick(sourceUrl, parsed?.source_url ?? null);
      const platformId = await detectPlatformId(effectiveSourceUrl);

      const [job] = await db.insert(jobs).values({
        title: pick(title, parsed?.title ?? null),
        company: pick(company, parsed?.company ?? null),
        company_description: parsed?.company_description ?? null,
        job_poster: pick(jobPoster, parsed?.job_poster ?? null),
        office_location: effectiveLocation,
        region: classifyRegion(effectiveLocation),
        source_url: effectiveSourceUrl,
        // Keep the user's original paste verbatim as the description.
        job_description: jobDescription,
        salary_min: pick(salaryMin, parsed?.salary_min ?? null),
        salary_max: pick(salaryMax, parsed?.salary_max ?? null),
        salary_currency: pick(salaryCurrency, parsed?.salary_currency ?? null),
        salary_period: normalizeSalaryPeriod(effectiveSalaryPeriod) || effectiveSalaryPeriod,
        salary_duration_weeks: parsed?.salary_duration_weeks ?? null,
        work_location: workLocation,
        job_types: jobTypes,
        experience_levels: experienceLevels,
        skills_required: parsed?.skills_required ?? null,
        skills_preferred: parsed?.skills_preferred ?? null,
        responsibilities: parsed?.responsibilities ?? null,
        soft_skills: parsed?.soft_skills ?? null,
        date_posted: pick(datePosted, parsedDatePosted),
        source_html_stripped: parsed?.source_html_stripped ?? null,
        ai_chat_extraction: parsed?.ai_chat_extraction ?? null,
        job_platform_id: platformId,
        created_manually: true,
        status: parsed?.status ?? "hiring",
        date_created: now,
        date_updated: now,
      }).returning({ id: jobs.id });
      jobId = job.id;
      // Mirror the scraper import path so the job shows up in this profile's
      // /jobs list ("imported by me").
      await db.insert(job_importers).values({ job_id: jobId, profile_id: profileId });
      // Enqueue matching just like the scraper — no-ops when the job has no
      // skills yet (e.g. parse failed), scores it otherwise.
      await triggerMatchForImport(profileId, jobId);
    }

    const [application] = await db.insert(applications).values({
      job_id: jobId,
      profile_id: profileId,
      status: "applying",
      status_step: "Preparing",
      status_action: "Send application",
      date_created: now,
      date_updated: now,
      // application_seen_date is a Drizzle date() column (string mode).
      application_seen_date: now.toISOString().split("T")[0],
    }).returning();

    await db.insert(application_status_log).values({
      application: application.id,
      date_created: now,
      from_status: null,
      to_status: "applying",
      step: "Preparing",
      action: "Send application",
    });

    redirect(302, `/applications/${application.id}`);
  },
};
