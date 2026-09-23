import { dbDirect as db } from '$lib/server/db';
import { eq } from 'drizzle-orm';
import { search_tasks, match_config, profiles, job_platforms } from '$lib/server/db/schema';
import type {
	SettingsExportData,
	ExportedSearchTask,
	ExportedMatchConfig,
	ExportedEmailDigest,
	ExportedSalary,
	ExportedDirective
} from './settings-types';
import { loadDirectives } from '$lib/server/ai-chat/directives';

export interface SettingsExportOptions {
	includeTasks: boolean;
	includeMatchConfig: boolean;
	includeEmailDigest: boolean;
	includeSalary: boolean;
	includeDirectives: boolean;
}

export const defaultSettingsExportOptions: SettingsExportOptions = {
	includeTasks: true,
	includeMatchConfig: true,
	includeEmailDigest: true,
	includeSalary: true,
	includeDirectives: true
};

export async function buildSettingsExport(
	profileId: number,
	options: SettingsExportOptions = defaultSettingsExportOptions
): Promise<SettingsExportData> {
	const result: SettingsExportData = {
		version: '1.0',
		exported_at: new Date().toISOString(),
		scope: 'settings'
	};

	if (options.includeTasks) {
		const tasks = await db
			.select({ task: search_tasks, platform_key: job_platforms.key })
			.from(search_tasks)
			.leftJoin(job_platforms, eq(job_platforms.id, search_tasks.platform_id))
			.where(eq(search_tasks.profile_id, profileId));

		result.search_tasks = tasks.map<ExportedSearchTask>(({ task, platform_key }) => ({
			platform_key,
			search_url: task.search_url,
			navigation_type: task.navigation_type,
			stripped_html: task.stripped_html,
			is_active: task.is_active,
			max_jobs: task.max_jobs,
			browser_provider: task.browser_provider,
			search_term: task.search_term,
			skip_existing: task.skip_existing,
			skip_first: task.skip_first,
			stop_after_duplicates: task.stop_after_duplicates,
			keep_minimized: task.keep_minimized,
			ui_preferences: task.ui_preferences,
			note: task.note,
			schedule_interval_hours: task.schedule_interval_hours,
			schedule_preferred_hour: task.schedule_preferred_hour,
			login_mode: task.login_mode,
			search_location: task.search_location,
			search_filters: task.search_filters,
			// Not carried: import refuses it, so emitting it would promise a
			// round-trip that does not happen. It is per-debugging-session state
			// rather than a setting worth moving between profiles or
			// environments. See settings-import.ts.
			debug_screenshots: false
		}));
	}

	if (options.includeMatchConfig) {
		const mc = await db.query.match_config.findFirst({
			where: eq(match_config.profile_id, profileId)
		});
		if (mc) {
			result.match_config = {
				name: mc.name,
				job_types: mc.job_types,
				experience_levels: mc.experience_levels,
				work_location: mc.work_location,
				locations: mc.locations,
				match_community_jobs: mc.match_community_jobs,
				remote_only: mc.remote_only,
				community_max_age_days: mc.community_max_age_days
			} satisfies ExportedMatchConfig;
		}
	}

	if (options.includeEmailDigest) {
		const profile = await db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: {
				email_digest_enabled: true,
				email_digest_frequency_days: true,
				email_digest_min_score: true,
				email_digest_preferred_hour: true,
				email_digest_send_to: true
			}
		});
		if (profile) {
			result.email_digest = {
				enabled: profile.email_digest_enabled ?? false,
				frequency_days: profile.email_digest_frequency_days,
				min_score: profile.email_digest_min_score,
				preferred_hour: profile.email_digest_preferred_hour,
				send_to: profile.email_digest_send_to
			} satisfies ExportedEmailDigest;
		}
	}

	if (options.includeSalary) {
		// One read now the expectations table is gone; it was a Promise.all of two.
		const profile = await db.query.profiles.findFirst({
			where: eq(profiles.id, profileId),
			columns: {
				salary_base_rate: true,
				salary_currency: true,
				salary_adjustments: true,
				salary_region_overrides: true
			}
		});

		result.salary = {
			base_rate: profile?.salary_base_rate ?? null,
			currency: profile?.salary_currency ?? null,
			adjustments: profile?.salary_adjustments ?? null,
			region_overrides: profile?.salary_region_overrides ?? null
		} satisfies ExportedSalary;
	}

	// A memory that does not survive moving instances is one the applicant loses
	// by moving — the reason the plan asks for this.
	if (options.includeDirectives) {
		result.directives = (await loadDirectives(profileId)).map<ExportedDirective>((d) => ({
			topic: d.topic,
			statement: d.statement,
			stated_at: d.statedAt.toISOString()
		}));
	}

	return result;
}
