/**
 * What the profile export carries, column by column.
 *
 * Each table the export reads has one list here naming EVERY column it has:
 * `true` is carried in the payload, `false` is left out, with the reason beside
 * it. Each list is checked against its table, so a column added to the schema
 * fails the type check here until someone decides which it is.
 *
 * The lists used to be written inline in the export's query, and nothing
 * compared them with the tables. A column added after its list was written was
 * read by no export and restored by no import, demo copies included: a role's
 * headline and company blurb, every skill's and skill group's tags (so a
 * restored profile printed every skill on every version), a group's note, a
 * role project's repo link, a highlight's icon and type, and the profile's
 * country (all found 2026-11-03).
 *
 * The lists are also the query's `columns`: when a list mixes both, Drizzle
 * reads only the `true` ones. What the type check cannot see is the two
 * hand-written steps after the query, the mapping that writes the payload and
 * the importer that writes the rows. export-round-trip.test.ts checks those,
 * from these same lists.
 *
 * Two kinds of `false` need no reason each. `id` and a parent key: the import
 * makes new rows, and a payload names a parent by its position, never its id.
 * An `id` read anyway is marked: something numbers the payload by it (the
 * translation overlay, or the uploaded documents) and the mapping drops it.
 * A relation read only for a stable name, the skill type's slug or an extended
 * version's, is a lookup rather than something carried, and is not listed.
 */
import type {
	certificate_skills,
	certificates,
	education,
	highlights,
	languages,
	media_items,
	media_presets,
	media_renditions,
	profile_field_variants,
	profile_versions,
	profiles,
	references,
	side_project_achievements,
	side_project_technologies,
	side_projects,
	tech_skill_categories,
	tech_skills,
	work_experience_achievements,
	work_experience_project_technologies,
	work_experience_projects,
	work_experience_technologies,
	work_experiences
} from '$lib/server/db/schema';

/** Every column of a table, each marked carried or left out. */
type Decided<T extends { $inferSelect: object }> = Record<keyof T['$inferSelect'], boolean>;

/** When a row was made and last changed: the importing side's own. */
const STAMPS = { date_created: false, date_updated: false } as const;

export const PROFILE_COLUMNS = {
	...STAMPS,
	id: false,
	// The importing account's own: whose it is, where it sits in their list of
	// profiles, and whether it is their default.
	user_id: false,
	sort: false,
	is_default: false,
	name: true,
	title: true,
	subtitle: true,
	headline: true,
	summary: true,
	about_me_text: true,
	core_stack: true,
	nationality: true,
	location: true,
	location_url: true,
	location_timezone: true,
	country_code: true,
	phone_number: true,
	email_address: true,
	personal_website: true,
	linkedin_profile: true,
	github_profile: true,
	stackoverflow_profile: true,
	npm_profile: true,
	pypi_profile: true,
	signal_profile: true,
	whatsapp_number: true,
	telegram_username: true,
	meta_image_url: true,
	// A media library rendition, by its source id: the import maps it to the
	// rendition it makes from the archive's library (import-media-library.ts).
	profile_photo_id: true,
	dev_start_year: true,
	python_js_start_year: true,
	remote_start_year: true,
	company_name: true,
	street_address: true,
	postal_code: true,
	city: true,
	vat_id: true,
	kvk_number: true,
	business_activities: true,
	// Read for the record; the import makes a slug of its own that is free.
	slug: true,
	// What is published. An imported profile publishes nothing until its owner
	// says so, and these name versions and themes by ids the import does not keep.
	public_cv_version_id: false,
	public_resume_version_id: false,
	public_portfolio_version_id: false,
	public_portfolio_theme_id: false,
	// The uploaded CV the profile was first read from: a file, and the payload
	// carries no files of that kind.
	source_cv: false,
	// The browser this account imports jobs with, and those pages' layout:
	// the device's, not the profile's.
	browser_user_agent: false,
	browser_language: false,
	browser_timezone: false,
	browser_country_code: false,
	ui_preferences: false,
	// Salary Prep: the full export carries these (export-full.ts).
	salary_employed: false,
	salary_freelance: false,
	salary_adjustments: false,
	// The email digest: the settings export carries these (settings-export.ts),
	// all but when the last one went out, which is this instance's own.
	email_digest_enabled: false,
	email_digest_frequency_days: false,
	email_digest_min_score: false,
	email_digest_preferred_hour: false,
	email_digest_send_to: false,
	email_digest_last_sent_at: false
} as const satisfies Decided<typeof profiles>;

export const VERSION_COLUMNS = {
	...STAMPS,
	id: false,
	profile_id: false,
	status: true,
	sort: true,
	slug: true,
	name: true,
	toggles: true,
	// Nothing reads or writes it.
	preview_links: false,
	// The export takes library versions only, whose application_id is null.
	application_id: false
} as const satisfies Decided<typeof profile_versions>;

export const HIGHLIGHT_COLUMNS = {
	...STAMPS,
	id: false,
	profile_id: false,
	status: true,
	sort: true,
	text: true,
	type: true,
	fa_icon: true,
	icon_name: true
} as const satisfies Decided<typeof highlights>;

export const SKILL_CATEGORY_COLUMNS = {
	...STAMPS,
	// Numbers the translation overlay.
	id: true,
	profile_id: false,
	status: true,
	sort: true,
	name: true,
	note: true,
	fa_icon: true,
	tags: true
} as const satisfies Decided<typeof tech_skill_categories>;

export const SKILL_COLUMNS = {
	...STAMPS,
	id: false,
	category_id: false,
	status: true,
	sort: true,
	name: true,
	level: true,
	years_experience: true,
	tags: true,
	// Carried as the type's slug (`tech_type`): instances number types apart.
	tech_type_id: false,
	// An id in this instance's shared skill vocabulary, which another instance
	// numbers differently. A skill without one works as it always did.
	concept_id: false
} as const satisfies Decided<typeof tech_skills>;

export const ROLE_COLUMNS = {
	...STAMPS,
	// Numbers the uploaded documents and the translation overlay.
	id: true,
	profile_id: false,
	name: true,
	position: true,
	location: true,
	work_mode: true,
	website: true,
	headline: true,
	description: true,
	summary: true,
	start_date: true,
	end_date: true,
	status: true,
	sort: true,
	tags: true,
	featured: true,
	featured_sort: true,
	// Renditions by source id, mapped on import like `profile_photo_id`.
	logo_id: true,
	banner_id: true
} as const satisfies Decided<typeof work_experiences>;

export const ROLE_ACHIEVEMENT_COLUMNS = {
	...STAMPS,
	// Numbers the translation overlay.
	id: true,
	work_experience_id: false,
	status: true,
	sort: true,
	description: true,
	fa_icon: true,
	tags: true
} as const satisfies Decided<typeof work_experience_achievements>;

export const ROLE_TECHNOLOGY_COLUMNS = {
	...STAMPS,
	id: false,
	work_experience_id: false,
	status: true,
	sort: true,
	name: true,
	tags: true
} as const satisfies Decided<typeof work_experience_technologies>;

export const ROLE_PROJECT_COLUMNS = {
	...STAMPS,
	// Numbers the uploaded documents.
	id: true,
	work_experience_id: false,
	status: true,
	sort: true,
	name: true,
	project_role: true,
	url: true,
	repo_url: true,
	start_date: true,
	end_date: true,
	description: true,
	outcome: true,
	tags: true,
	featured: true,
	featured_sort: true
} as const satisfies Decided<typeof work_experience_projects>;

export const ROLE_PROJECT_TECHNOLOGY_COLUMNS = {
	...STAMPS,
	id: false,
	work_experience_project_id: false,
	sort: true,
	name: true,
	tags: true
} as const satisfies Decided<typeof work_experience_project_technologies>;

export const SIDE_PROJECT_COLUMNS = {
	...STAMPS,
	// Numbers the uploaded documents and the translation overlay.
	id: true,
	profile_id: false,
	status: true,
	sort: true,
	name: true,
	project_role: true,
	url: true,
	repo_url: true,
	stars: true,
	summary: true,
	start_date: true,
	end_date: true,
	tags: true,
	featured: true,
	featured_sort: true,
	// Renditions by source id, mapped on import like `profile_photo_id`.
	image_id: true,
	banner_id: true,
	logo_id: true
} as const satisfies Decided<typeof side_projects>;

export const SIDE_PROJECT_ACHIEVEMENT_COLUMNS = {
	...STAMPS,
	// Numbers the translation overlay.
	id: true,
	side_project_id: false,
	sort: true,
	description: true
} as const satisfies Decided<typeof side_project_achievements>;

export const SIDE_PROJECT_TECHNOLOGY_COLUMNS = {
	...STAMPS,
	id: false,
	side_project_id: false,
	sort: true,
	name: true,
	tags: true
} as const satisfies Decided<typeof side_project_technologies>;

export const EDUCATION_COLUMNS = {
	...STAMPS,
	// Numbers the translation overlay.
	id: true,
	profile_id: false,
	status: true,
	sort: true,
	institution: true,
	area: true,
	study_type: true,
	location: true,
	url: true,
	graduation_year: true,
	start_date: true,
	end_date: true,
	summary: true,
	tags: true,
	// Renditions by source id, mapped on import like `profile_photo_id`.
	logo_id: true,
	banner_id: true
} as const satisfies Decided<typeof education>;

export const LANGUAGE_COLUMNS = {
	...STAMPS,
	// Numbers the translation overlay.
	id: true,
	profile_id: false,
	status: true,
	sort: true,
	name: true,
	language_code: true,
	proficiency: true
} as const satisfies Decided<typeof languages>;

export const FIELD_VARIANT_COLUMNS = {
	...STAMPS,
	// Numbers the translation overlay.
	id: true,
	profile_id: false,
	// Carried as the role's position in the payload (exportFieldVariants).
	work_experience_id: true,
	field: true,
	label: true,
	value: true,
	note: true,
	sort: true
} as const satisfies Decided<typeof profile_field_variants>;

export const REFERENCE_COLUMNS = {
	...STAMPS,
	// Numbers the translation overlay.
	id: true,
	profile_id: false,
	status: true,
	sort: true,
	author: true,
	author_position: true,
	author_email: true,
	author_phone: true,
	text: true
} as const satisfies Decided<typeof references>;

export const CERTIFICATE_COLUMNS = {
	...STAMPS,
	id: false,
	profile_id: false,
	status: true,
	sort: true,
	name: true,
	issuer: true,
	date: true,
	expiry_date: true,
	credential_id: true,
	url: true,
	tags: true,
	// The uploaded certificate. The payload carries no such files, and an id
	// here could point a certificate at anybody's file; an overwrite keeps each
	// row's file by the certificate's name (certificate-file.ts).
	file_id: false
} as const satisfies Decided<typeof certificates>;

export const CERTIFICATE_SKILL_COLUMNS = {
	...STAMPS,
	id: false,
	certificate_id: false,
	sort: true,
	name: true
} as const satisfies Decided<typeof certificate_skills>;

// --- Media library (export-media-library.ts) ---
//
// Carried only when the archive carries media, since an item is nothing
// without its original. Each row keeps its source `id`, because renditions name
// their item, slots name their rendition and a new version names the one it
// replaces by it; the import maps every one to the id it makes.

export const MEDIA_ITEM_COLUMNS = {
	date_created: true,
	// Numbers the library: renditions and `replaces_id` refer to it.
	id: true,
	profile_id: false,
	kind: true,
	label: true,
	// The original travels as bytes in the archive, at the item's `archivePath`.
	file_id: false,
	width: true,
	height: true,
	format: true,
	has_alpha: true,
	orientation: true,
	replaces_id: true,
	// Carried as the template's kind and slug: a template id is this database's.
	template_id: false
} as const satisfies Decided<typeof media_items>;

export const MEDIA_PRESET_COLUMNS = {
	date_created: false,
	// Numbers the profile's own presets, which renditions refer to.
	id: true,
	profile_id: false,
	// Only a profile's own presets travel, and they have no key; a shared one is
	// named by its key on the rendition instead.
	key: false,
	platform: true,
	slot: true,
	kind: true,
	width: true,
	height: true,
	formats: true,
	max_bytes: true,
	mask: true,
	safe_zone: true,
	note: true,
	source_url: true,
	verified_on: true,
	sort: true
} as const satisfies Decided<typeof media_presets>;

export const MEDIA_RENDITION_COLUMNS = {
	date_created: true,
	// Numbers the renditions: slots and application records refer to them.
	id: true,
	item_id: true,
	// Carried as `preset`: a shared preset's key, or an own preset's source id.
	preset_id: true,
	crop_x: true,
	crop_y: true,
	crop_w: true,
	crop_h: true,
	width: true,
	height: true,
	format: true,
	quality: true,
	// The drawn bytes travel in the archive, at the rendition's `archivePath`.
	file_id: false
} as const satisfies Decided<typeof media_renditions>;
