import { dbDirect as db } from "$lib/server/db";
import { eq, and, inArray, asc } from "drizzle-orm";
import {
  search_tasks,
  match_config,
  profiles,
  job_platforms,
  platform_profiles,
  platform_credentials,
  salary_expectations,
} from "$lib/server/db/schema";
import type { SettingsExportData } from "./settings-types";

export interface SettingsImportOptions {
  replaceExistingTasks: boolean;
  applyMatchConfig: boolean;
  applyEmailDigest: boolean;
  applySalary: boolean;
}

export interface SettingsImportSummary {
  tasksDeleted: number;
  tasksInserted: number;
  tasksSkippedUnknownPlatform: string[];
  tasksWithoutCredential: string[];
  platformProfilesCreated: number;
  matchConfigUpdated: boolean;
  emailDigestUpdated: boolean;
  salaryUpdated: boolean;
  salaryExpectationsReplaced: number;
  salaryExpectationsInserted: number;
}

export function validateSettingsExport(data: unknown): data is SettingsExportData {
  if (!data || typeof data !== "object") return false;
  const d = data as Record<string, unknown>;
  if (d.scope !== "settings" || typeof d.version !== "string") return false;
  if (d.search_tasks !== undefined && !Array.isArray(d.search_tasks)) return false;
  return true;
}

export async function importSettings(
  profileId: number,
  userId: string,
  data: SettingsExportData,
  options: SettingsImportOptions,
): Promise<SettingsImportSummary> {
  const summary: SettingsImportSummary = {
    tasksDeleted: 0,
    tasksInserted: 0,
    tasksSkippedUnknownPlatform: [],
    tasksWithoutCredential: [],
    platformProfilesCreated: 0,
    matchConfigUpdated: false,
    emailDigestUpdated: false,
    salaryUpdated: false,
    salaryExpectationsReplaced: 0,
    salaryExpectationsInserted: 0,
  };

  const tasks = data.search_tasks ?? [];

  // Resolve all referenced platform_keys to ids on the target instance
  const taskKeys = Array.from(
    new Set(
      tasks
        .map((t) => t.platform_key)
        .filter((k): k is string => k !== null),
    ),
  );

  const platformRows = taskKeys.length
    ? await db
        .select({ id: job_platforms.id, key: job_platforms.key })
        .from(job_platforms)
        .where(inArray(job_platforms.key, taskKeys))
    : [];
  const platformIdByKey = new Map(platformRows.map((p) => [p.key, p.id]));

  // Existing platform_profiles on the target profile (per-profile runtime
  // state). These already wrap a credential and can be linked directly.
  const platformIds = platformRows.map((p) => p.id);
  const ppRows = platformIds.length
    ? await db
        .select({ id: platform_profiles.id, platform_id: platform_profiles.platform_id })
        .from(platform_profiles)
        .where(
          and(
            eq(platform_profiles.profile_id, profileId),
            inArray(platform_profiles.platform_id, platformIds),
          ),
        )
    : [];
  const ppIdByPlatformId = new Map(ppRows.map((r) => [r.platform_id!, r.id]));

  // Credentials live on the user, not the profile. If the user has a
  // credential for a platform but this profile has no platform_profiles
  // row pointing at it, we'll auto-create one on import.
  const credRows = platformIds.length
    ? await db
        .select({
          id: platform_credentials.id,
          platform_id: platform_credentials.platform_id,
        })
        .from(platform_credentials)
        .where(
          and(
            eq(platform_credentials.user_id, userId),
            inArray(platform_credentials.platform_id, platformIds),
          ),
        )
        .orderBy(asc(platform_credentials.id))
    : [];
  const credIdByPlatformId = new Map<number, number>();
  for (const c of credRows) {
    if (!credIdByPlatformId.has(c.platform_id)) {
      credIdByPlatformId.set(c.platform_id, c.id);
    }
  }

  await db.transaction(async (tx) => {
    if (options.replaceExistingTasks) {
      const deleted = await tx
        .delete(search_tasks)
        .where(eq(search_tasks.profile_id, profileId))
        .returning({ id: search_tasks.id });
      summary.tasksDeleted = deleted.length;
    }

    const missingCredentialKeys = new Set<string>();

    for (const t of tasks) {
      const platformId = t.platform_key
        ? platformIdByKey.get(t.platform_key) ?? null
        : null;

      if (t.platform_key && platformId === null) {
        summary.tasksSkippedUnknownPlatform.push(t.platform_key);
        continue;
      }

      let platformProfileId =
        platformId !== null ? ppIdByPlatformId.get(platformId) ?? null : null;

      if (platformProfileId === null && platformId !== null) {
        const credId = credIdByPlatformId.get(platformId) ?? null;
        if (credId !== null) {
          // Target profile has no platform_profiles row for this platform
          // but the user owns a credential — wire one up so the task can use it.
          const [created] = await tx
            .insert(platform_profiles)
            .values({
              profile_id: profileId,
              platform_id: platformId,
              platform_credential_id: credId,
              date_created: new Date(),
              date_updated: new Date(),
            })
            .returning({ id: platform_profiles.id });
          platformProfileId = created.id;
          ppIdByPlatformId.set(platformId, platformProfileId);
          summary.platformProfilesCreated += 1;
        } else if (t.platform_key) {
          missingCredentialKeys.add(t.platform_key);
        }
      }

      await tx.insert(search_tasks).values({
        status: "idle",
        date_created: new Date(),
        date_updated: new Date(),
        profile_id: profileId,
        platform_id: platformId,
        platform_profile_id: platformProfileId,
        search_url: t.search_url,
        navigation_type: t.navigation_type,
        stripped_html: t.stripped_html,
        is_active: t.is_active,
        max_jobs: t.max_jobs,
        browser_provider: t.browser_provider,
        search_term: t.search_term,
        skip_existing: t.skip_existing,
        skip_first: t.skip_first,
        stop_after_duplicates: t.stop_after_duplicates,
        keep_minimized: t.keep_minimized,
        ui_preferences: t.ui_preferences as Record<string, unknown>,
        note: t.note,
        schedule_interval_hours: t.schedule_interval_hours,
        schedule_preferred_hour: t.schedule_preferred_hour,
        login_mode: t.login_mode,
        search_location: t.search_location,
        search_filters: t.search_filters,
        debug_screenshots: t.debug_screenshots,
      });
      summary.tasksInserted += 1;
    }

    summary.tasksWithoutCredential = Array.from(missingCredentialKeys);

    if (options.applyMatchConfig && data.match_config) {
      const existing = await tx.query.match_config.findFirst({
        where: eq(match_config.profile_id, profileId),
      });
      const mc = data.match_config;
      if (existing) {
        await tx
          .update(match_config)
          .set({
            date_updated: new Date(),
            name: mc.name,
            job_types: mc.job_types,
            experience_levels: mc.experience_levels,
            work_location: mc.work_location,
            locations: mc.locations,
            match_community_jobs: mc.match_community_jobs,
            remote_only: mc.remote_only,
            community_max_age_days: mc.community_max_age_days,
          })
          .where(eq(match_config.profile_id, profileId));
      } else {
        await tx.insert(match_config).values({
          date_created: new Date(),
          date_updated: new Date(),
          profile_id: profileId,
          name: mc.name,
          job_types: mc.job_types,
          experience_levels: mc.experience_levels,
          work_location: mc.work_location,
          locations: mc.locations,
          match_community_jobs: mc.match_community_jobs,
          remote_only: mc.remote_only,
          community_max_age_days: mc.community_max_age_days,
        });
      }
      summary.matchConfigUpdated = true;
    }

    if (options.applyEmailDigest && data.email_digest) {
      const d = data.email_digest;
      await tx
        .update(profiles)
        .set({
          email_digest_enabled: d.enabled,
          email_digest_frequency_days: d.frequency_days,
          email_digest_min_score: d.min_score,
          email_digest_preferred_hour: d.preferred_hour,
          email_digest_send_to: d.send_to,
        })
        .where(eq(profiles.id, profileId));
      summary.emailDigestUpdated = true;
    }

    if (options.applySalary && data.salary) {
      const s = data.salary;

      await tx
        .update(profiles)
        .set({
          salary_base_rate: s.base_rate,
          salary_currency: s.currency,
          salary_adjustments: s.adjustments,
          salary_region_overrides: s.region_overrides,
        })
        .where(eq(profiles.id, profileId));

      const deleted = await tx
        .delete(salary_expectations)
        .where(eq(salary_expectations.profile_id, profileId))
        .returning({ id: salary_expectations.id });
      summary.salaryExpectationsReplaced = deleted.length;

      for (const exp of s.expectations) {
        await tx.insert(salary_expectations).values({
          profile_id: profileId,
          sort: exp.sort,
          job_title: exp.job_title,
          company_type: exp.company_type,
          employment_type: exp.employment_type,
          work_arrangement: exp.work_arrangement,
          region: exp.region,
          hourly_rate: exp.hourly_rate,
          month_salary: exp.month_salary,
          year_salary: exp.year_salary,
          daily_rate: exp.daily_rate,
          currency: exp.currency,
          experience_level: exp.experience_level,
          date_created: new Date(),
          date_updated: new Date(),
        });
        summary.salaryExpectationsInserted += 1;
      }

      summary.salaryUpdated = true;
    }
  });

  return summary;
}
