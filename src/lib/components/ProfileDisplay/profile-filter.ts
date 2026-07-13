/**
 * Version/tag filtering shared by the resume/CV templates (default
 * ProfileDisplay and the Citrus template).
 *
 * A resume "version" is a named slug whose extension chain (via
 * profile_version_extensions) plus the base template type ("resume"/"cv")
 * forms the set of active identifiers. Each item (work experience,
 * achievement, skill category, education, …) can carry `tags`:
 *   - a positive `slug`  → whitelist: show only on matching versions
 *   - a negated `!slug`   → blacklist: hide on that version/template (wins)
 *   - `resume` / `cv`     → restrict to that base template
 */

interface VersionObj {
  id: number;
  slug: string | null;
  toggles: string[] | unknown;
  extension_links: Array<{ extended_id: number | null } & Record<string, unknown>>;
}

export interface ProfileFilter {
  filterOnTags: <T extends { tags?: string[] | unknown } & Record<string, any>>(
    objList: T[],
  ) => T[];
  versionSlugs: string[];
  toggles: string[];
}

export function createProfileFilter(
  profileVersions: VersionObj[] | undefined,
  type: string | null,
  versionId: number | null,
  versionFromUrl: string,
): ProfileFilter {
  function getVersion(idx: string | number): VersionObj | undefined {
    if (!profileVersions) return undefined;
    if (typeof idx === "number") {
      return profileVersions.find((v) => v.id === idx);
    }
    return profileVersions.find((v) => v.slug === idx);
  }

  const rootVersion = versionId
    ? getVersion(versionId)
    : getVersion(versionFromUrl);

  function getAllVersionObjs(versionObj: VersionObj | undefined) {
    const versionObjs: Array<VersionObj | undefined> = [versionObj];

    const addVersionObjs = (vo: VersionObj | undefined) => {
      if (vo && vo.extension_links) {
        for (const junctionObj of vo.extension_links) {
          if (junctionObj.extended_id == null) continue;
          const extObj = getVersion(junctionObj.extended_id);
          versionObjs.push(extObj);
          addVersionObjs(extObj);
        }
      }
    };

    addVersionObjs(versionObj);
    return versionObjs;
  }

  const versionObjs = getAllVersionObjs(rootVersion);
  const versionSlugs = versionObjs.map((v) => v?.slug).filter(Boolean) as string[];

  const toggles: string[] = [];
  versionObjs.forEach((vo) => {
    if (Array.isArray(vo?.toggles) && vo.toggles.length) {
      (vo.toggles as string[]).forEach((t) => toggles.push(t));
    }
  });

  function filterOnTags<
    T extends { tags?: string[] | unknown } & Record<string, any>,
  >(objList: T[]): T[] {
    const currentType = type || "resume";
    // The identifiers active for the currently-rendered document: the base
    // template ("resume"/"cv") plus the viewed version's extension chain.
    const activeIds = [
      currentType.toLowerCase(),
      ...versionSlugs.map((s) => s.toLowerCase()),
    ];

    return objList.filter((obj) => {
      if (!("tags" in obj && Array.isArray(obj.tags) && obj.tags.length)) {
        return true;
      }
      const tagsArr = obj.tags as string[];

      // A `!slug` tag excludes the item from that version/template. Negations
      // are a blacklist and win over any positive (whitelist) tags.
      const negatedIds = tagsArr
        .filter((t) => t.startsWith("!"))
        .map((t) => t.slice(1).trim().toLowerCase())
        .filter(Boolean);
      if (negatedIds.some((id) => activeIds.includes(id))) return false;

      const positives = tagsArr.filter((t) => !t.startsWith("!"));

      if (
        !positives.includes(currentType) &&
        positives.includes(currentType === "resume" ? "cv" : "resume")
      ) {
        // The opposite base template is tagged but the current one isn't —
        // e.g. `type` is "cv" and tags contain "resume" but not "cv" → hide.
        return false;
      }

      const versionTags = positives.filter(
        (item) => !(["resume", "cv"].includes(item)),
      );
      if (!(versionTags.length && versionSlugs.length)) return true;

      // Positive version tags act as a whitelist: show only on matching versions.
      return versionSlugs.some((versionSlug) => versionTags.includes(versionSlug));
    });
  }

  return { filterOnTags, versionSlugs, toggles };
}
