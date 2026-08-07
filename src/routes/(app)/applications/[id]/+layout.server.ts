import type { LayoutServerLoad } from './$types';
import { error, redirect } from '@sveltejs/kit';
import { dbDirect as db } from '$lib/server/db';
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import {
	application_letters,
	application_questions,
	application_records,
	application_status_log,
	applications,
	letter_versions,
	profile_versions
} from '$lib/server/db/schema';

export const load: LayoutServerLoad = async ({ parent, params }) => {
	const layoutData = await parent();

	if (!layoutData.selectedProfile) {
		redirect(302, '/home');
	}

	const appId = parseInt(params.id);
	if (isNaN(appId)) {
		error(400, 'Invalid application ID');
	}

	const application = await db.query.applications.findFirst({
		where: and(
			eq(applications.id, appId),
			eq(applications.profile_id, layoutData.selectedProfile.id)
		),
		with: {
			job: {
				with: {
					job_platform: {
						columns: { id: true, name: true, url: true }
					}
				}
			},
			application_letters: {
				orderBy: desc(application_letters.date_created),
				with: {
					letter_versions: {
						orderBy: asc(letter_versions.id),
						columns: { id: true, source: true, content: true }
					}
				}
			},
			application_questions: {
				orderBy: asc(application_questions.sort)
			},
			application_status_logs: {
				orderBy: desc(application_status_log.date_created)
			},
			// Newest first, falling back to creation order for records without a
			// known event date (a pasted email, a note jotted down later).
			//
			// WITHOUT `content`, deliberately. Only the Activity tab renders the text
			// and it loads its own copy; every other tab under this layout was
			// shipping the lot to the browser to render none of it — 146 kB of
			// transcript on one dev application's overview page, 125 kB on another.
			// `has_content` carries the one fact the other tabs need (which is also
			// the summariser's own floor: an entry with no text is not one it could
			// have summarised).
			application_records: {
				columns: {
					id: true,
					record_type: true,
					title: true,
					event_date: true,
					step: true,
					status_log: true,
					sort: true,
					file_id: true,
					extraction_status: true,
					extraction_error: true,
					date_extracted: true,
					contacts: true,
					date_created: true,
					date_updated: true
				},
				extras: {
					has_content: sql<boolean>`coalesce(btrim(${application_records.content}), '') <> ''`.as(
						'has_content'
					)
				},
				orderBy: [desc(application_records.event_date), desc(application_records.date_created)],
				with: {
					// For the Activity stream's attachment affordance — a record can now
					// carry the file its text was extracted from.
					file: {
						columns: {
							id: true,
							filename_download: true,
							type: true,
							title: true
						}
					}
				}
			},
			file: {
				columns: {
					id: true,
					filename_download: true,
					type: true,
					filesize: true,
					title: true
				}
			}
		}
	});

	if (!application) {
		error(404, 'Application not found');
	}

	// Resolve CV version name from slug
	let cvVersionName: string | null = null;
	if (application.cv_version_sent) {
		const version = await db.query.profile_versions.findFirst({
			where: and(
				eq(profile_versions.slug, application.cv_version_sent),
				eq(profile_versions.profile_id, layoutData.selectedProfile.id)
			),
			columns: { name: true }
		});
		cvVersionName = version?.name || null;
	}

	return {
		application,
		cvVersionName,
		profileId: layoutData.selectedProfile.id
	};
};
