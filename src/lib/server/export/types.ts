/**
 * Export/Import Type Definitions
 */

import type { EmployedSettings, FreelanceSettings, SalaryAdjustments } from '$lib/salary/settings';

// Export scope options
export type ExportScope = 'profile' | 'full';

// Export format options
export type ExportFormat = 'json' | 'zip';

// Export options passed to export functions
export interface ExportOptions {
	scope: ExportScope;
	includeMedia: boolean;
	includeDocuments: boolean;
}

// What a build function should put in the archive alongside the JSON
export interface ExportContentOptions {
	/** The media library: every picture, original and drawn renditions */
	includeMedia?: boolean;
	/** Extracted text of documents uploaded to work/side projects */
	includeDocuments?: boolean;
}

// A slot's picture in an archive from before the media library, filed under
// `media/` by the old `*_path` column (import-media.ts). Read, never written:
// the columns went in migration 0091.
export interface MediaFile {
	/** Original path in uploads directory */
	path: string;
	/** Path in export archive (media/...) */
	archivePath: string;
	/** Entity type this media belongs to */
	entityType: 'profile' | 'work_experience' | 'education' | 'side_project';
	/** Entity ID */
	entityId: number;
	/** Field name (e.g., "profile_photo_path", "logo_path") */
	field: string;
}

// Where a document attaches. Positional rather than by id: the export carries
// no database ids, and the importer recreates entities in exported order.
export type DocumentAttachment =
	| { kind: 'work_experience_project'; work_experience_index: number; project_index: number }
	| { kind: 'side_project'; side_project_index: number }
	| { kind: 'work_experience'; work_experience_index: number }
	| { kind: 'unattached' };

// One extracted source file within a document attachment
export interface ExportedDocumentFile {
	/** Sanitized source path, relative to the attachment (e.g. "src/lib/foo.ts") */
	path: string;
	/** Path in the export archive (documents/...) */
	archivePath: string;
	ext?: string;
	chars: number;
	sort?: number | null;
}

// An uploaded document attachment (one upload / archive / repo)
export interface ExportedDocument {
	/** Directory in the archive holding this attachment's files */
	archive_dir: string;
	attached_to: DocumentAttachment;
	/** "file" | "archive" | "github_repo" | ... */
	kind: string;
	title?: string;
	original_filename?: string;
	source?: unknown;
	/** LLM reference notes for the attachment */
	summary?: string;
	keywords?: unknown;
	status?: string;
	skipped?: unknown;
	file_count: number;
	total_chars: number;
	total_bytes: number;
	sort?: number | null;
	files: ExportedDocumentFile[];
}

/** Extracted text carried to the ZIP writer. Deliberately not part of the
 *  manifest — a single attachment can hold hundreds of MB of text. */
export interface DocumentFilePayload {
	archivePath: string;
	text: string;
}

// --- Translation overlay (profile_translations) ---
// Positional for the same reason documents are: no database ids travel.
export type TranslationTarget =
	| { kind: 'profile' }
	| { kind: 'work_experience'; work_experience_index: number }
	| {
			kind: 'work_experience_achievement';
			work_experience_index: number;
			achievement_index: number;
	  }
	| { kind: 'side_project'; side_project_index: number }
	| { kind: 'side_project_achievement'; side_project_index: number; achievement_index: number }
	| { kind: 'education'; education_index: number }
	| { kind: 'tech_skill_category'; category_index: number }
	| { kind: 'language'; language_index: number }
	| { kind: 'reference'; reference_index: number }
	| { kind: 'field_variant'; field_variant_index: number };

export interface ExportedTranslation {
	target: TranslationTarget;
	field: string;
	locale: string;
	value: string;
}

// --- Alternative field wordings (profile_field_variants) ---
export interface ExportedFieldVariant {
	field: string;
	label: string;
	value: string;
	note?: string;
	sort?: number | null;
	/**
	 * The role whose field this varies, by its position in `work_experiences`.
	 * Positional, like every other reference in this payload: no database ids
	 * travel. Absent for a field of the profile itself, which is every variant
	 * an export written before a role could have wordings holds.
	 */
	work_experience_index?: number;
}

// --- Presentation templates (`presentation_templates`) ---
//
// The envelope key stays `resume_templates`, the table's name before the
// portfolio kind arrived. It is a wire format: archives written by every
// earlier version carry that key, and renaming it here would make them
// import as templateless. The `kind` field below is what distinguishes a
// document template from a portfolio theme; absent means `document`, which
// is exactly what every pre-rename archive holds.
/** An asset the template config points at by file id. */
export interface ExportedTemplateAsset {
	/** File id in the source database; rewritten to the new id on import. */
	file_id: string;
	archivePath: string;
	filename: string;
	/**
	 * Set when the slot showed a media library rendition (a portfolio theme's
	 * images, since 2026-11). `file_id` then holds the rendition's id, the
	 * bytes are its picture, and an archive that carries the library restores
	 * the slot as a rendition again; one that does not gets a plain file.
	 */
	rendition?: boolean;
}

export interface ExportedResumeTemplate {
	name?: string;
	slug?: string;
	/** 'document' | 'portfolio'. Absent in archives written before the kinds split. */
	kind?: string;
	status?: string;
	sort?: number | null;
	/** Kept verbatim, including its file ids — the importer rewrites them. */
	config: unknown;
	assets: ExportedTemplateAsset[];
}

/** Template asset bytes carried to the ZIP writer. */
export interface TemplateAssetPayload {
	archivePath: string;
	buffer: Buffer;
}

// Base export envelope
export interface ExportEnvelope {
	/** Export format version */
	version: '2.0';
	/** ISO timestamp of export */
	exported_at: string;
	/** What scope was exported */
	scope: ExportScope;
	/** Whether pictures are included: the media library, or in an older archive `media_files` */
	has_media: boolean;
	/** The old slots' pictures, in an archive from before the media library */
	media_files?: MediaFile[];
	/** Whether uploaded documents are included. Absent on exports made before
	 *  documents were exportable. */
	has_documents?: boolean;
	/** Document manifest (only if has_documents); text lives in the archive */
	documents?: ExportedDocument[];
	/** Per-locale overlay of translated field values */
	translations?: ExportedTranslation[];
	/** Custom CV templates; asset bytes live in the archive */
	resume_templates?: ExportedResumeTemplate[];
	/**
	 * The media library (only with media): originals and the renditions cut
	 * from them, which the slots on the profile and the theme images point at.
	 * Absent from archives written before 2026-11.
	 */
	media_library?: ExportedMediaLibrary;
}

// --- Media library (planning/MEDIA-LIBRARY.md) ---
//
// Rows carry their source ids, because renditions name their item and slots
// name their rendition by them; the importer maps each to the id it makes. A
// shared preset is named by its key, since its id differs per database.

export interface ExportedMediaItem {
	/** Source id: what renditions and `replaces_id` refer to. */
	id: number;
	kind?: string;
	label?: string | null;
	width: number;
	height: number;
	format: string;
	has_alpha?: boolean;
	orientation?: number;
	/** Source id of the item this one is a new version of. */
	replaces_id?: number | null;
	/** The banner template it was rendered from, by kind and slug. */
	template?: { kind: string; slug: string } | null;
	date_created?: string | null;
	/** The original's bytes in the archive. */
	archivePath: string;
}

export interface ExportedMediaPreset {
	/** Source id: what an own preset's renditions refer to. */
	id: number;
	platform: string;
	slot: string;
	kind?: string;
	width: number;
	height: number;
	formats?: string[];
	max_bytes?: number | null;
	mask?: string;
	safe_zone?: unknown;
	note?: string | null;
	source_url?: string | null;
	verified_on?: string | null;
	sort?: number | null;
}

export interface ExportedMediaRendition {
	/** Source id: what slots and application records refer to. */
	id: string;
	item_id: number;
	/** A shared preset by key, a profile's own by its source id, or a free crop. */
	preset?: { key: string } | { own: number } | null;
	crop_x: number;
	crop_y: number;
	crop_w: number;
	crop_h: number;
	width: number;
	height: number;
	format: string;
	quality?: number | null;
	date_created?: string | null;
	/** Its drawn bytes, when it had been drawn: a slot then shows the very same file. */
	archivePath?: string;
}

export interface ExportedMediaLibrary {
	items: ExportedMediaItem[];
	presets: ExportedMediaPreset[];
	renditions: ExportedMediaRendition[];
}

/** Bytes for the archive, at a path the payload names. */
export interface ArchiveFilePayload {
	archivePath: string;
	buffer: Buffer;
}

// Profile data (resume/CV/portfolio)
export interface ExportedProfileData {
	// Basic info
	name?: string;
	title?: string;
	slug?: string;
	location?: string;
	/** In no export before 2026-11-03. */
	country_code?: string;

	// Contact
	phone_number?: string;
	email_address?: string;
	personal_website?: string;

	// Social profiles
	linkedin_profile?: string;
	github_profile?: string;
	stackoverflow_profile?: string;
	npm_profile?: string;
	pypi_profile?: string;
	signal_profile?: string;
	whatsapp_number?: string;
	telegram_username?: string;

	// Professional info
	subtitle?: string;
	core_stack?: string;
	headline?: string;
	summary?: string;
	about_me_text?: string;
	nationality?: string;
	location_url?: string;
	location_timezone?: string;
	meta_image_url?: string;

	// Experience years
	dev_start_year?: number | null;
	python_js_start_year?: number | null;
	remote_start_year?: number | null;

	// Business info
	company_name?: string;
	street_address?: string;
	postal_code?: string;
	city?: string;
	vat_id?: string;
	kvk_number?: string;
	business_activities?: string;

	/** The photo's file under `media/`, in an archive from before the media library. */
	profile_photo_path?: string;
	/** The profile photo's rendition, by its source id (see media_library). */
	profile_photo_id?: string;

	// Related data
	profile_versions: ExportedProfileVersion[];
	highlights: ExportedHighlight[];
	tech_skill_categories: ExportedTechSkillCategory[];
	work_experiences: ExportedWorkExperience[];
	side_projects: ExportedSideProject[];
	education: ExportedEducation[];
	languages: ExportedLanguage[];
	/**
	 * Alternative wordings for the fields that hold one value: the profile's
	 * own, and each role's position (profile_field_variants).
	 *
	 * Optional because an export written before the feature has none, and an
	 * importer reading one must not treat that as "delete them all".
	 *
	 * Which VERSION picked which is deliberately not here. A pick is a
	 * profile_version_overrides row, and this export carries no version
	 * overrides at all — so exporting the picks would mean writing rows that
	 * point at versions the import may not have recreated.
	 */
	field_variants?: ExportedFieldVariant[];
	references: ExportedReference[];
	certificates: ExportedCertificate[];
}

export interface ExportedProfileVersion {
	status?: string;
	sort?: number | null;
	slug?: string;
	name?: string;
	/** @deprecated Legacy field from old format (was display name). Kept for backward-compatible imports. */
	description?: string;
	toggles?: unknown;
	extends_from?: string | null;
}

export interface ExportedHighlight {
	status?: string;
	sort?: number | null;
	text?: string;
	/** In no export before 2026-11-03, nor `icon_name`. */
	type?: string;
	fa_icon?: string;
	icon_name?: string;
}

export interface ExportedTechSkillCategory {
	status?: string;
	sort?: number | null;
	name?: string;
	/** The private hint that tells two groups of one name apart. In no export before 2026-11-03, nor `tags`. */
	note?: string;
	fa_icon?: string;
	tags?: unknown;
	tech_skills: ExportedTechSkill[];
}

export interface ExportedTechSkill {
	status?: string;
	sort?: number | null;
	name?: string;
	years_experience?: string;
	level?: string;
	tech_type?: string | null;
	/** In no export before 2026-11-03: a restored profile printed every skill on every version. */
	tags?: unknown;
}

export interface ExportedWorkExperience {
	name?: string;
	location?: string;
	work_mode?: string;
	position?: string;
	/** In no export before 2026-11-03; an older payload restores it empty. */
	headline?: string;
	/** The company blurb. Same history as `headline`. */
	description?: string;
	summary?: string;
	status?: string;
	sort?: number | null;
	start_date?: string | null;
	end_date?: string | null;
	website?: string;
	tags?: unknown;
	/** On the site's Selected work. In no export before 2026-11-09. */
	featured?: boolean;
	/** Its place in Selected work when ordered by hand. In no export before 2026-11-11. */
	featured_sort?: number | null;
	/** Files under `media/`, in an archive from before the media library. */
	logo_path?: string;
	banner_path?: string;
	/** Renditions by source id (see media_library). */
	logo_id?: string;
	banner_id?: string;
	achievements: ExportedWorkExperienceAchievement[];
	technologies: ExportedWorkExperienceTechnology[];
	projects: ExportedWorkExperienceProject[];
}

export interface ExportedWorkExperienceAchievement {
	status?: string;
	sort?: number | null;
	title?: string;
	description?: string;
	fa_icon?: string;
	tags?: unknown;
}

export interface ExportedWorkExperienceTechnology {
	status?: string;
	sort?: number | null;
	name?: string;
	tags?: unknown;
}

export interface ExportedWorkExperienceProject {
	status?: string;
	sort?: number | null;
	name: string;
	project_role?: string;
	url?: string;
	/** In no export before 2026-11-03. */
	repo_url?: string;
	start_date?: string | null;
	end_date?: string | null;
	description?: string;
	outcome?: string;
	tags?: unknown;
	/** On the site's Selected work. In no export before 2026-11-09. */
	featured?: boolean;
	/** Its place in Selected work when ordered by hand. In no export before 2026-11-11. */
	featured_sort?: number | null;
	technologies: ExportedWorkExperienceProjectTechnology[];
}

export interface ExportedWorkExperienceProjectTechnology {
	sort?: number | null;
	name?: string;
	tags?: unknown;
}

export interface ExportedSideProject {
	status?: string;
	sort?: number | null;
	name?: string;
	project_role?: string;
	start_date?: string | null;
	end_date?: string | null;
	url?: string;
	stars?: number | null;
	summary?: string;
	repo_url?: string;
	/** Files under `media/`, in an archive from before the media library. */
	image_path?: string;
	banner_path?: string;
	/** Renditions by source id (see media_library). */
	image_id?: string;
	banner_id?: string;
	/** In no export before 2026-11-10. */
	logo_id?: string;
	tags?: unknown;
	/** On the site's Selected work. In no export before 2026-11-09. */
	featured?: boolean;
	/** Its place in Selected work when ordered by hand. In no export before 2026-11-11. */
	featured_sort?: number | null;
	achievements: ExportedSideProjectAchievement[];
	technologies: ExportedSideProjectTechnology[];
}

export interface ExportedSideProjectAchievement {
	description?: string;
	sort?: number | null;
}

export interface ExportedSideProjectTechnology {
	sort?: number | null;
	name?: string;
	tags?: unknown;
}

export interface ExportedEducation {
	status?: string;
	sort?: number | null;
	institution?: string;
	location?: string;
	url?: string;
	area?: string;
	study_type?: string;
	graduation_year?: number | null;
	start_date?: string | null;
	end_date?: string | null;
	summary?: string;
	/** Files under `media/`, in an archive from before the media library. */
	logo_path?: string;
	banner_path?: string;
	/** Renditions by source id (see media_library). */
	logo_id?: string;
	banner_id?: string;
	tags?: unknown;
}

export interface ExportedLanguage {
	status?: string;
	sort?: number | null;
	name?: string;
	language_code?: string;
	proficiency?: string;
}

export interface ExportedCertificate {
	status?: string;
	sort?: number | null;
	name?: string;
	issuer?: string;
	date?: string | null;
	expiry_date?: string | null;
	credential_id?: string;
	url?: string;
	/** Optional: exports made before 2026-10-05 have none. */
	tags?: unknown;
	/** Optional: exports made before 2026-09-26 have none. */
	skills?: ExportedCertificateSkill[];
}

export interface ExportedCertificateSkill {
	sort?: number | null;
	name?: string;
}

export interface ExportedReference {
	status?: string;
	sort?: number | null;
	author?: string;
	author_position?: string;
	author_email?: string;
	author_phone?: string;
	text?: string;
}

// Full account additional data
export interface ExportedProjectStory {
	sort?: number | null;
	title?: string;
	situation?: string;
	task?: string;
	action?: string;
	result?: string;
	reflection?: string;
	category?: string;
}

export interface ExportedCheatSheet {
	sort?: number | null;
	title?: string;
	content?: string;
}

/**
 * A profile's salary asks, shaped as lib/salary/settings.ts shapes them.
 * Exports taken before 2026-10-05 carry one hourly `base_rate` and its
 * qualifiers instead; those still import, since `salaryFromExport` reads both.
 */
export interface ExportedSalarySettings {
	employed?: EmployedSettings | null;
	freelance?: FreelanceSettings | null;
	adjustments?: SalaryAdjustments;
	/** @deprecated The old hourly base rate, read on import only. */
	base_rate?: number | null;
	/** @deprecated With `base_rate`. */
	currency?: string;
	/** @deprecated With `base_rate`. */
	region_overrides?: Record<string, unknown>;
}

export interface ExportedJobPreferences {
	// Job matching preferences
	preferred_roles?: string[];
	preferred_locations?: string[];
	remote_preference?: string;
	salary_min?: number;
	salary_max?: number;
	salary_currency?: string;
	// Add more as needed based on actual schema
}

export interface ExportedSavedJob {
	job_id: number;
	source_url?: string;
	title?: string;
	company?: string;
	saved_at?: string;
}

export interface ExportedJobMatch {
	job_id: number;
	source_url?: string;
	title?: string;
	company?: string;
	match_score?: number;
	matched_at?: string;
}

export interface ExportedApplication {
	status?: string;
	job_title?: string;
	company?: string;
	source_url?: string;
	application_sent_date?: string;
	/**
	 * The list of notes an application kept before they moved to its timeline
	 * (migration 0063). Only read, from export files written before that, and
	 * imported as `note` entries (`legacy-notes.ts`).
	 */
	application_note?: unknown;
	salary_expectation?: number;
	salary_currency?: string;
	salary_period?: string;
	letters?: ExportedApplicationLetter[];
	questions?: ExportedApplicationQuestion[];
	/** Which picture went up on this platform and when, by rendition source id. */
	media?: { rendition: string; date_uploaded: string }[];
}

export interface ExportedApplicationLetter {
	type?: string;
	/** What it is called where the type does not tell two of them apart. */
	title?: string;
	content?: string;
}

export interface ExportedApplicationQuestion {
	question?: string;
	answer?: string;
}

// Complete export data structure
export interface ProfileExportData extends ExportEnvelope {
	scope: 'profile';
	profile: ExportedProfileData;
}

export interface FullExportData extends ExportEnvelope {
	scope: 'full';
	profile: ExportedProfileData;
	project_stories: ExportedProjectStory[];
	cheat_sheets: ExportedCheatSheet[];
	salary_settings?: ExportedSalarySettings;
	job_preferences?: ExportedJobPreferences;
	saved_jobs?: ExportedSavedJob[];
	job_matches?: ExportedJobMatch[];
	applications?: ExportedApplication[];
}

export type ExportData = ProfileExportData | FullExportData;
