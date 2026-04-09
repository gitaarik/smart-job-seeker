/**
 * Resume diff engine
 * Compares two ResumeData objects and produces a structured diff
 * with per-field toggles for selective import.
 */

import type {
  ResumeData,
  ResumeBasics,
  WorkExperience,
  Education,
  SkillCategory,
  TechSkill,
  Language,
  SideProject,
  Certificate,
  Reference,
} from "$lib/server/resume/types";

// --- Diff types ---

export interface FieldDiff {
  field: string;
  label: string;
  current: string | undefined;
  incoming: string | undefined;
  changed: boolean;
  enabled: boolean;
}

export type ItemDiffType = "added" | "removed" | "modified" | "unchanged";

export interface ItemDiff<T> {
  type: ItemDiffType;
  current?: T & { _id?: number };
  incoming?: T;
  fieldDiffs?: FieldDiff[];
  /** For nested arrays (achievements, technologies) */
  nestedDiffs?: {
    field: string;
    label: string;
    added: string[];
    removed: string[];
    addedEnabled: boolean[];
    removedEnabled: boolean[];
  }[];
  enabled: boolean;
}

export interface SkillItemDiff {
  type: ItemDiffType;
  current?: TechSkill;
  incoming?: TechSkill;
  fieldDiffs?: FieldDiff[];
  enabled: boolean;
}

export interface SkillCategoryDiff {
  type: ItemDiffType;
  current?: SkillCategory & { _id?: number };
  incoming?: SkillCategory;
  fieldDiffs?: FieldDiff[];
  skillDiffs?: SkillItemDiff[];
  enabled: boolean;
}

export interface ResumeDataDiff {
  basics: FieldDiff[];
  work: ItemDiff<WorkExperience>[];
  education: ItemDiff<Education>[];
  skills: SkillCategoryDiff[];
  languages: ItemDiff<Language>[];
  projects: ItemDiff<SideProject>[];
  certificates: ItemDiff<Certificate>[];
  references: ItemDiff<Reference>[];
  stats: DiffStats;
}

export interface DiffStats {
  basicsChanged: number;
  basicsTotal: number;
  workAdded: number;
  workModified: number;
  workRemoved: number;
  educationAdded: number;
  educationModified: number;
  educationRemoved: number;
  skillsAdded: number;
  skillsModified: number;
  skillsRemoved: number;
  languagesAdded: number;
  languagesModified: number;
  languagesRemoved: number;
  projectsAdded: number;
  projectsModified: number;
  projectsRemoved: number;
  certificatesAdded: number;
  certificatesModified: number;
  certificatesRemoved: number;
  referencesAdded: number;
  referencesModified: number;
  referencesRemoved: number;
  totalChanges: number;
}

// --- Helpers ---

function normalize(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  return String(value).trim();
}

function valuesEqual(a: unknown, b: unknown): boolean {
  return normalize(a) === normalize(b);
}

function diffField(
  field: string,
  label: string,
  current: unknown,
  incoming: unknown,
): FieldDiff {
  const c = normalize(current);
  const i = normalize(incoming);
  const changed = c !== i;
  return { field, label, current: c, incoming: i, changed, enabled: changed };
}

function diffStringArrays(
  field: string,
  label: string,
  current: string[] | undefined,
  incoming: string[] | undefined,
) {
  const cur = new Set(current ?? []);
  const inc = new Set(incoming ?? []);
  const added = [...inc].filter((item) => !cur.has(item));
  const removed = [...cur].filter((item) => !inc.has(item));
  return {
    field,
    label,
    added,
    removed,
    addedEnabled: added.map(() => true),
    removedEnabled: removed.map(() => false), // removals not pre-selected
  };
}

// --- Matching ---

function matchItems<T>(
  current: T[],
  incoming: T[],
  getKey: (item: T) => string,
): { matched: [T, T][]; added: T[]; removed: T[] } {
  const currentMap = new Map<string, T>();
  for (const item of current) {
    const key = getKey(item);
    if (key) currentMap.set(key.toLowerCase(), item);
  }

  const matched: [T, T][] = [];
  const added: T[] = [];
  const matchedKeys = new Set<string>();

  for (const item of incoming) {
    const key = getKey(item)?.toLowerCase();
    if (key && currentMap.has(key)) {
      matched.push([currentMap.get(key)!, item]);
      matchedKeys.add(key);
    } else {
      added.push(item);
    }
  }

  const removed = current.filter((item) => {
    const key = getKey(item)?.toLowerCase();
    return !key || !matchedKeys.has(key);
  });

  return { matched, added, removed };
}

// --- Basics diff ---

function diffBasics(current: ResumeBasics, incoming: ResumeBasics): FieldDiff[] {
  return [
    diffField("name", "Full Name", current.name, incoming.name),
    diffField("title", "Professional Title", current.title, incoming.title),
    diffField("email", "Email", current.email, incoming.email),
    diffField("phone", "Phone", current.phone, incoming.phone),
    diffField("location", "Location", current.location, incoming.location),
    diffField("summary", "Summary", current.summary, incoming.summary),
    diffField("website", "Website", current.website, incoming.website),
    diffField("linkedin", "LinkedIn", current.linkedin, incoming.linkedin),
    diffField("github", "GitHub", current.github, incoming.github),
    diffField("stackoverflow", "Stack Overflow", current.stackoverflow, incoming.stackoverflow),
    diffField("headline", "Headline", current.headline, incoming.headline),
    diffField("subtitle", "Subtitle", current.subtitle, incoming.subtitle),
    diffField("coreStack", "Core Stack", current.coreStack, incoming.coreStack),
  ];
}

/**
 * Partial-mode basics diff: only show fields where the incoming value has
 * actual content. If incoming is empty but current has data, treat as
 * unchanged (the document simply didn't mention this field).
 */
function diffBasicsPartial(current: ResumeBasics, incoming: ResumeBasics): FieldDiff[] {
  return diffBasics(current, incoming).map((fd) => {
    // If incoming is empty but current has a value, treat as unchanged
    // (partial document didn't contain this field — not a deliberate removal)
    if (fd.changed && !fd.incoming && fd.current) {
      return { ...fd, changed: false, enabled: false };
    }
    return fd;
  });
}

// --- Work diff ---

function diffWorkItem(current: WorkExperience, incoming: WorkExperience): ItemDiff<WorkExperience> {
  const fieldDiffs = [
    diffField("name", "Company", current.name, incoming.name),
    diffField("position", "Position", current.position, incoming.position),
    diffField("location", "Location", current.location, incoming.location),
    diffField("website", "Website", current.website, incoming.website),
    diffField("startDate", "Start Date", current.startDate, incoming.startDate),
    diffField("endDate", "End Date", current.endDate, incoming.endDate),
    diffField("summary", "Summary", current.summary, incoming.summary),
  ];

  const nestedDiffs = [
    diffStringArrays("achievements", "Achievements", current.achievements, incoming.achievements),
    diffStringArrays("technologies", "Technologies", current.technologies, incoming.technologies),
  ].filter((d) => d.added.length > 0 || d.removed.length > 0);

  const hasChanges = fieldDiffs.some((d) => d.changed) || nestedDiffs.length > 0;

  return {
    type: hasChanges ? "modified" : "unchanged",
    current,
    incoming,
    fieldDiffs,
    nestedDiffs: nestedDiffs.length > 0 ? nestedDiffs : undefined,
    enabled: hasChanges,
  };
}

function diffWork(
  current: WorkExperience[],
  incoming: WorkExperience[],
): ItemDiff<WorkExperience>[] {
  const { matched, added, removed } = matchItems(
    current,
    incoming,
    (w) => `${w.name}|||${w.position}`,
  );

  const result: ItemDiff<WorkExperience>[] = [];

  for (const [cur, inc] of matched) {
    result.push(diffWorkItem(cur, inc));
  }

  for (const item of added) {
    result.push({ type: "added", incoming: item, enabled: true });
  }

  for (const item of removed) {
    result.push({ type: "removed", current: item, enabled: false });
  }

  return result;
}

// --- Education diff ---

function diffEducationItem(current: Education, incoming: Education): ItemDiff<Education> {
  const fieldDiffs = [
    diffField("institution", "Institution", current.institution, incoming.institution),
    diffField("area", "Field of Study", current.area, incoming.area),
    diffField("studyType", "Degree", current.studyType, incoming.studyType),
    diffField("location", "Location", current.location, incoming.location),
    diffField("url", "URL", current.url, incoming.url),
    diffField("startDate", "Start Date", current.startDate, incoming.startDate),
    diffField("endDate", "End Date", current.endDate, incoming.endDate),
    diffField("graduationYear", "Graduation Year", current.graduationYear, incoming.graduationYear),
    diffField("summary", "Summary", current.summary, incoming.summary),
  ];

  const hasChanges = fieldDiffs.some((d) => d.changed);

  return {
    type: hasChanges ? "modified" : "unchanged",
    current,
    incoming,
    fieldDiffs,
    enabled: hasChanges,
  };
}

function diffEducation(
  current: Education[],
  incoming: Education[],
): ItemDiff<Education>[] {
  const { matched, added, removed } = matchItems(
    current,
    incoming,
    (e) => `${e.institution}|||${e.area ?? ""}`,
  );

  const result: ItemDiff<Education>[] = [];

  for (const [cur, inc] of matched) {
    result.push(diffEducationItem(cur, inc));
  }

  for (const item of added) {
    result.push({ type: "added", incoming: item, enabled: true });
  }

  for (const item of removed) {
    result.push({ type: "removed", current: item, enabled: false });
  }

  return result;
}

// --- Skills diff ---

function diffSkillItem(current: TechSkill, incoming: TechSkill): SkillItemDiff {
  const fieldDiffs = [
    diffField("name", "Name", current.name, incoming.name),
    diffField("level", "Level", current.level, incoming.level),
    diffField("yearsExperience", "Years", current.yearsExperience, incoming.yearsExperience),
  ];

  const hasChanges = fieldDiffs.some((d) => d.changed);

  return {
    type: hasChanges ? "modified" : "unchanged",
    current,
    incoming,
    fieldDiffs,
    enabled: hasChanges,
  };
}

function diffSkillCategory(
  current: SkillCategory,
  incoming: SkillCategory,
): SkillCategoryDiff {
  const fieldDiffs = [
    diffField("name", "Category Name", current.name, incoming.name),
  ];

  // Match skills by name within category
  const { matched, added, removed } = matchItems(
    current.skills,
    incoming.skills,
    (s) => s.name,
  );

  const skillDiffs: SkillItemDiff[] = [];

  for (const [cur, inc] of matched) {
    skillDiffs.push(diffSkillItem(cur, inc));
  }

  for (const item of added) {
    skillDiffs.push({ type: "added", incoming: item, enabled: true });
  }

  for (const item of removed) {
    skillDiffs.push({ type: "removed", current: item, enabled: false });
  }

  const hasChanges =
    fieldDiffs.some((d) => d.changed) ||
    skillDiffs.some((d) => d.type !== "unchanged");

  return {
    type: hasChanges ? "modified" : "unchanged",
    current,
    incoming,
    fieldDiffs,
    skillDiffs,
    enabled: hasChanges,
  };
}

function diffSkills(
  current: SkillCategory[],
  incoming: SkillCategory[],
): SkillCategoryDiff[] {
  const { matched, added, removed } = matchItems(
    current,
    incoming,
    (c) => c.name,
  );

  const result: SkillCategoryDiff[] = [];

  for (const [cur, inc] of matched) {
    result.push(diffSkillCategory(cur, inc));
  }

  for (const item of added) {
    result.push({ type: "added", incoming: item, enabled: true });
  }

  for (const item of removed) {
    result.push({ type: "removed", current: item, enabled: false });
  }

  return result;
}

// --- Language diff ---

function diffLanguageItem(current: Language, incoming: Language): ItemDiff<Language> {
  const fieldDiffs = [
    diffField("name", "Language", current.name, incoming.name),
    diffField("languageCode", "Code", current.languageCode, incoming.languageCode),
    diffField("proficiency", "Proficiency", current.proficiency, incoming.proficiency),
  ];

  const hasChanges = fieldDiffs.some((d) => d.changed);

  return {
    type: hasChanges ? "modified" : "unchanged",
    current,
    incoming,
    fieldDiffs,
    enabled: hasChanges,
  };
}

function diffLanguages(
  current: Language[],
  incoming: Language[],
): ItemDiff<Language>[] {
  const { matched, added, removed } = matchItems(
    current,
    incoming,
    (l) => l.name,
  );

  const result: ItemDiff<Language>[] = [];

  for (const [cur, inc] of matched) {
    result.push(diffLanguageItem(cur, inc));
  }

  for (const item of added) {
    result.push({ type: "added", incoming: item, enabled: true });
  }

  for (const item of removed) {
    result.push({ type: "removed", current: item, enabled: false });
  }

  return result;
}

// --- Projects diff ---

function diffProjectItem(current: SideProject, incoming: SideProject): ItemDiff<SideProject> {
  const fieldDiffs = [
    diffField("name", "Name", current.name, incoming.name),
    diffField("url", "URL", current.url, incoming.url),
    diffField("urlLabel", "URL Label", current.urlLabel, incoming.urlLabel),
    diffField("summary", "Summary", current.summary, incoming.summary),
    diffField("startDate", "Start Date", current.startDate, incoming.startDate),
    diffField("endDate", "End Date", current.endDate, incoming.endDate),
    diffField("stars", "Stars", current.stars, incoming.stars),
  ];

  const nestedDiffs = [
    diffStringArrays("achievements", "Achievements", current.achievements, incoming.achievements),
    diffStringArrays("technologies", "Technologies", current.technologies, incoming.technologies),
  ].filter((d) => d.added.length > 0 || d.removed.length > 0);

  const hasChanges = fieldDiffs.some((d) => d.changed) || nestedDiffs.length > 0;

  return {
    type: hasChanges ? "modified" : "unchanged",
    current,
    incoming,
    fieldDiffs,
    nestedDiffs: nestedDiffs.length > 0 ? nestedDiffs : undefined,
    enabled: hasChanges,
  };
}

function diffProjects(
  current: SideProject[],
  incoming: SideProject[],
): ItemDiff<SideProject>[] {
  const { matched, added, removed } = matchItems(
    current,
    incoming,
    (p) => p.name,
  );

  const result: ItemDiff<SideProject>[] = [];

  for (const [cur, inc] of matched) {
    result.push(diffProjectItem(cur, inc));
  }

  for (const item of added) {
    result.push({ type: "added", incoming: item, enabled: true });
  }

  for (const item of removed) {
    result.push({ type: "removed", current: item, enabled: false });
  }

  return result;
}

// --- Certificates diff ---

function diffCertificateItem(current: Certificate, incoming: Certificate): ItemDiff<Certificate> {
  const fieldDiffs = [
    diffField("name", "Name", current.name, incoming.name),
    diffField("issuer", "Issuer", current.issuer, incoming.issuer),
    diffField("date", "Date", current.date, incoming.date),
    diffField("url", "URL", current.url, incoming.url),
  ];

  const hasChanges = fieldDiffs.some((d) => d.changed);

  return {
    type: hasChanges ? "modified" : "unchanged",
    current,
    incoming,
    fieldDiffs,
    enabled: hasChanges,
  };
}

function diffCertificates(
  current: Certificate[],
  incoming: Certificate[],
): ItemDiff<Certificate>[] {
  const { matched, added, removed } = matchItems(
    current,
    incoming,
    (c) => c.name,
  );

  const result: ItemDiff<Certificate>[] = [];

  for (const [cur, inc] of matched) {
    result.push(diffCertificateItem(cur, inc));
  }

  for (const item of added) {
    result.push({ type: "added", incoming: item, enabled: true });
  }

  for (const item of removed) {
    result.push({ type: "removed", current: item, enabled: false });
  }

  return result;
}

// --- References diff ---

function diffReferenceItem(current: Reference, incoming: Reference): ItemDiff<Reference> {
  const fieldDiffs = [
    diffField("author", "Author", current.author, incoming.author),
    diffField("authorPosition", "Position", current.authorPosition, incoming.authorPosition),
    diffField("text", "Text", current.text, incoming.text),
  ];

  const hasChanges = fieldDiffs.some((d) => d.changed);

  return {
    type: hasChanges ? "modified" : "unchanged",
    current,
    incoming,
    fieldDiffs,
    enabled: hasChanges,
  };
}

function diffReferences(
  current: Reference[],
  incoming: Reference[],
): ItemDiff<Reference>[] {
  const { matched, added, removed } = matchItems(
    current,
    incoming,
    (r) => r.author,
  );

  const result: ItemDiff<Reference>[] = [];

  for (const [cur, inc] of matched) {
    result.push(diffReferenceItem(cur, inc));
  }

  for (const item of added) {
    result.push({ type: "added", incoming: item, enabled: true });
  }

  for (const item of removed) {
    result.push({ type: "removed", current: item, enabled: false });
  }

  return result;
}

// --- Stats ---

function countDiffType<T>(diffs: { type: ItemDiffType }[]): {
  added: number;
  modified: number;
  removed: number;
} {
  let added = 0,
    modified = 0,
    removed = 0;
  for (const d of diffs) {
    if (d.type === "added") added++;
    else if (d.type === "modified") modified++;
    else if (d.type === "removed") removed++;
  }
  return { added, modified, removed };
}

function computeStats(diff: Omit<ResumeDataDiff, "stats">): DiffStats {
  const basicsChanged = diff.basics.filter((d) => d.changed).length;
  const w = countDiffType(diff.work);
  const e = countDiffType(diff.education);
  const s = countDiffType(diff.skills);
  const l = countDiffType(diff.languages);
  const p = countDiffType(diff.projects);
  const c = countDiffType(diff.certificates);
  const r = countDiffType(diff.references);

  return {
    basicsChanged,
    basicsTotal: diff.basics.length,
    workAdded: w.added,
    workModified: w.modified,
    workRemoved: w.removed,
    educationAdded: e.added,
    educationModified: e.modified,
    educationRemoved: e.removed,
    skillsAdded: s.added,
    skillsModified: s.modified,
    skillsRemoved: s.removed,
    languagesAdded: l.added,
    languagesModified: l.modified,
    languagesRemoved: l.removed,
    projectsAdded: p.added,
    projectsModified: p.modified,
    projectsRemoved: p.removed,
    certificatesAdded: c.added,
    certificatesModified: c.modified,
    certificatesRemoved: c.removed,
    referencesAdded: r.added,
    referencesModified: r.modified,
    referencesRemoved: r.removed,
    totalChanges:
      basicsChanged +
      w.added + w.modified + w.removed +
      e.added + e.modified + e.removed +
      s.added + s.modified + s.removed +
      l.added + l.modified + l.removed +
      p.added + p.modified + p.removed +
      c.added + c.modified + c.removed +
      r.added + r.modified + r.removed,
  };
}

// --- Partial document detection ---

/** Check if a section has actual data (not undefined and not empty array) */
function hasData<T>(section: T[] | undefined): section is T[] {
  return section !== undefined && section.length > 0;
}

/**
 * Detect whether the incoming data is a partial document (e.g. only references,
 * only education). A document is partial if most list sections are missing/empty.
 * Full resumes/CVs typically have at least work + skills or work + education.
 */
function isPartialDocument(incoming: ResumeData): boolean {
  const sections: (unknown[] | undefined)[] = [
    incoming.work,
    incoming.education,
    incoming.skills,
    incoming.languages,
    incoming.projects,
    incoming.certificates,
    incoming.references,
  ];
  const presentSections = sections.filter((s) => s !== undefined && s.length > 0).length;
  // If 2 or fewer sections have data, treat as partial
  return presentSections <= 2;
}

// --- Main ---

export function diffResumeData(
  current: ResumeData,
  incoming: ResumeData,
): ResumeDataDiff {
  // For partial documents: only diff sections that actually have data in
  // the incoming document. An undefined or empty section means the document
  // simply didn't contain that type of information — not that everything
  // should be deleted. Empty arrays from the LLM parser mean "not found."
  const partial = isPartialDocument(incoming);

  // For basics in partial documents: only show fields where the incoming
  // value has content (don't show "current → empty" as a removal).
  const basics = partial
    ? diffBasicsPartial(current.basics, incoming.basics)
    : diffBasics(current.basics, incoming.basics);

  const work = hasData(incoming.work)
    ? diffWork(current.work ?? [], incoming.work)
    : [];
  const education = hasData(incoming.education)
    ? diffEducation(current.education ?? [], incoming.education)
    : [];
  const skills = hasData(incoming.skills)
    ? diffSkills(current.skills ?? [], incoming.skills)
    : [];
  const languages = hasData(incoming.languages)
    ? diffLanguages(current.languages ?? [], incoming.languages)
    : [];
  const projects = hasData(incoming.projects)
    ? diffProjects(current.projects ?? [], incoming.projects)
    : [];
  const certificates = hasData(incoming.certificates)
    ? diffCertificates(current.certificates ?? [], incoming.certificates)
    : [];
  const references = hasData(incoming.references)
    ? diffReferences(current.references ?? [], incoming.references)
    : [];

  const result = { basics, work, education, skills, languages, projects, certificates, references };

  return {
    ...result,
    stats: computeStats(result),
  };
}

/**
 * Count how many changes are currently enabled in a diff.
 */
export function countEnabledChanges(diff: ResumeDataDiff): number {
  let count = 0;

  count += diff.basics.filter((d) => d.changed && d.enabled).length;

  for (const section of [diff.work, diff.education, diff.languages, diff.projects, diff.certificates, diff.references] as { type: ItemDiffType; enabled: boolean }[][]) {
    for (const item of section) {
      if (item.type === "unchanged") continue;
      if (item.enabled) count++;
    }
  }

  for (const cat of diff.skills) {
    if (cat.type === "unchanged") continue;
    if (cat.enabled) count++;
  }

  return count;
}
