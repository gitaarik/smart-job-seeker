/**
 * Applies a selective diff to an existing profile.
 * Only modifies the fields/items the user has enabled.
 */

import { dbDirect } from "$lib/server/db";
import type {
  ResumeData,
  ResumeBasics,
  WorkExperience,
  Education,
  SkillCategory,
  Language,
  SideProject,
  Certificate,
  Reference,
} from "./types";

export interface DiffApplyPayload {
  /** Basic profile fields to update (only changed+enabled ones) */
  basics?: Partial<ResumeBasics>;
  /** Work experience changes */
  work?: {
    added?: WorkExperience[];
    modified?: Array<{
      matchKey: string; // "company|||position" for matching
      fields: Partial<WorkExperience>;
      /** New achievements to add */
      addAchievements?: string[];
      /** Achievements to remove */
      removeAchievements?: string[];
      /** New technologies to add */
      addTechnologies?: string[];
      /** Technologies to remove */
      removeTechnologies?: string[];
    }>;
    removed?: string[]; // match keys of items to delete
  };
  /** Education changes */
  education?: {
    added?: Education[];
    modified?: Array<{
      matchKey: string; // "institution|||area"
      fields: Partial<Education>;
    }>;
    removed?: string[];
  };
  /** Skill category changes */
  skills?: {
    added?: SkillCategory[];
    modified?: Array<{
      matchKey: string; // category name
      fields?: Partial<{ name: string }>;
      addSkills?: Array<{ name: string; level?: string; yearsExperience?: number }>;
      removeSkills?: string[]; // skill names to remove
      modifySkills?: Array<{
        name: string;
        fields: Partial<{ name: string; level: string; yearsExperience: number }>;
      }>;
    }>;
    removed?: string[];
  };
  /** Language changes */
  languages?: {
    added?: Language[];
    modified?: Array<{
      matchKey: string; // language name
      fields: Partial<Language>;
    }>;
    removed?: string[];
  };
  /** Project changes */
  projects?: {
    added?: SideProject[];
    modified?: Array<{
      matchKey: string; // project name
      fields: Partial<SideProject>;
      addAchievements?: string[];
      removeAchievements?: string[];
      addTechnologies?: string[];
      removeTechnologies?: string[];
    }>;
    removed?: string[];
  };
  /** Certificate changes */
  certificates?: {
    added?: Certificate[];
    modified?: Array<{
      matchKey: string; // certificate name
      fields: Partial<Certificate>;
    }>;
    removed?: string[];
  };
  /** Reference changes */
  references?: {
    added?: Reference[];
    modified?: Array<{
      matchKey: string; // author name
      fields: Partial<Reference>;
    }>;
    removed?: string[];
  };
}

// Field mapping: ResumeBasics camelCase → DB snake_case
const basicsFieldMap: Record<string, string> = {
  name: "name",
  title: "title",
  email: "email_address",
  phone: "phone_number",
  location: "location",
  summary: "summary",
  website: "personal_website",
  linkedin: "linkedin_profile",
  github: "github_profile",
  stackoverflow: "stackoverflow_profile",
  headline: "headline",
  subtitle: "subtitle",
  coreStack: "core_stack",
};

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

export async function applyDiffToProfile(
  profileId: number,
  userId: string,
  payload: DiffApplyPayload,
): Promise<void> {
  // Verify ownership
  const profile = await dbDirect.profiles.findFirst({
    where: { id: profileId, user_id: userId },
    select: { id: true },
  });
  if (!profile) throw new Error("Profile not found or not owned by user");

  // --- Apply basics ---
  if (payload.basics && Object.keys(payload.basics).length > 0) {
    const updateData: Record<string, unknown> = { date_updated: new Date() };
    for (const [field, value] of Object.entries(payload.basics)) {
      const dbField = basicsFieldMap[field];
      if (dbField) {
        updateData[dbField] = (typeof value === "string" ? value.trim() : value) || null;
      }
    }
    await dbDirect.profiles.update({
      where: { id: profileId },
      data: updateData,
    });
  }

  // --- Apply work experience changes ---
  if (payload.work) {
    // Additions
    for (const w of payload.work.added ?? []) {
      const created = await dbDirect.work_experiences.create({
        data: {
          profile: profileId,
          name: w.name || "",
          position: w.position || "",
          location: w.location || "",
          description: "",
          summary: w.summary || "",
          status: "draft",
          start_date: parseDate(w.startDate),
          end_date: parseDate(w.endDate),
          website: w.website || null,
        },
      });

      let sort = 1;
      for (const ach of w.achievements ?? []) {
        await dbDirect.work_experience_achievements.create({
          data: {
            work_experience: created.id,
            description: ach,
            status: "draft",
            sort: sort++,
          },
        });
      }

      sort = 1;
      for (const tech of w.technologies ?? []) {
        await dbDirect.work_experience_technologies.create({
          data: {
            work_experience: created.id,
            name: tech,
            status: "draft",
            sort: sort++,
          },
        });
      }
    }

    // Modifications
    for (const mod of payload.work.modified ?? []) {
      const [company, position] = mod.matchKey.split("|||");
      const existing = await dbDirect.work_experiences.findFirst({
        where: { profile: profileId, name: company, position },
        select: { id: true },
      });
      if (!existing) continue;

      const updateData: Record<string, unknown> = {};
      if (mod.fields.name !== undefined) updateData.name = mod.fields.name;
      if (mod.fields.position !== undefined) updateData.position = mod.fields.position;
      if (mod.fields.location !== undefined) updateData.location = mod.fields.location || "";
      if (mod.fields.website !== undefined) updateData.website = mod.fields.website || null;
      if (mod.fields.startDate !== undefined) updateData.start_date = parseDate(mod.fields.startDate);
      if (mod.fields.endDate !== undefined) updateData.end_date = parseDate(mod.fields.endDate);
      if (mod.fields.summary !== undefined) updateData.summary = mod.fields.summary || "";

      if (Object.keys(updateData).length > 0) {
        await dbDirect.work_experiences.update({
          where: { id: existing.id },
          data: updateData,
        });
      }

      // Add new achievements
      if (mod.addAchievements?.length) {
        const maxSort = await dbDirect.work_experience_achievements.aggregate({
          where: { work_experience: existing.id },
          _max: { sort: true },
        });
        let sort = (maxSort._max.sort ?? 0) + 1;
        for (const ach of mod.addAchievements) {
          await dbDirect.work_experience_achievements.create({
            data: {
              work_experience: existing.id,
              description: ach,
              status: "draft",
              sort: sort++,
            },
          });
        }
      }

      // Remove achievements
      if (mod.removeAchievements?.length) {
        for (const ach of mod.removeAchievements) {
          await dbDirect.work_experience_achievements.deleteMany({
            where: { work_experience: existing.id, description: ach },
          });
        }
      }

      // Add new technologies
      if (mod.addTechnologies?.length) {
        const maxSort = await dbDirect.work_experience_technologies.aggregate({
          where: { work_experience: existing.id },
          _max: { sort: true },
        });
        let sort = (maxSort._max.sort ?? 0) + 1;
        for (const tech of mod.addTechnologies) {
          await dbDirect.work_experience_technologies.create({
            data: {
              work_experience: existing.id,
              name: tech,
              status: "draft",
              sort: sort++,
            },
          });
        }
      }

      // Remove technologies
      if (mod.removeTechnologies?.length) {
        for (const tech of mod.removeTechnologies) {
          await dbDirect.work_experience_technologies.deleteMany({
            where: { work_experience: existing.id, name: tech },
          });
        }
      }
    }

    // Removals
    for (const key of payload.work.removed ?? []) {
      const [company, position] = key.split("|||");
      const existing = await dbDirect.work_experiences.findFirst({
        where: { profile: profileId, name: company, position },
        select: { id: true },
      });
      if (!existing) continue;

      await dbDirect.work_experience_achievements.deleteMany({ where: { work_experience: existing.id } });
      await dbDirect.work_experience_technologies.deleteMany({ where: { work_experience: existing.id } });
      const projects = await dbDirect.work_experience_projects.findMany({
        where: { work_experience: existing.id },
        select: { id: true },
      });
      for (const proj of projects) {
        await dbDirect.work_experience_project_technologies.deleteMany({ where: { work_experience_project: proj.id } });
      }
      await dbDirect.work_experience_projects.deleteMany({ where: { work_experience: existing.id } });
      await dbDirect.work_experiences.delete({ where: { id: existing.id } });
    }
  }

  // --- Apply education changes ---
  if (payload.education) {
    for (const e of payload.education.added ?? []) {
      await dbDirect.education.create({
        data: {
          profile: profileId,
          status: "draft",
          institution: e.institution || null,
          area: e.area || null,
          study_type: e.studyType || null,
          location: e.location || null,
          url: e.url || null,
          start_date: parseDate(e.startDate),
          end_date: parseDate(e.endDate),
          graduation_year: e.graduationYear ?? null,
          summary: e.summary || null,
        },
      });
    }

    for (const mod of payload.education.modified ?? []) {
      const [institution, area] = mod.matchKey.split("|||");
      const existing = await dbDirect.education.findFirst({
        where: { profile: profileId, institution, area: area || null },
        select: { id: true },
      });
      if (!existing) continue;

      const updateData: Record<string, unknown> = {};
      if (mod.fields.institution !== undefined) updateData.institution = mod.fields.institution || null;
      if (mod.fields.area !== undefined) updateData.area = mod.fields.area || null;
      if (mod.fields.studyType !== undefined) updateData.study_type = mod.fields.studyType || null;
      if (mod.fields.location !== undefined) updateData.location = mod.fields.location || null;
      if (mod.fields.url !== undefined) updateData.url = mod.fields.url || null;
      if (mod.fields.startDate !== undefined) updateData.start_date = parseDate(mod.fields.startDate);
      if (mod.fields.endDate !== undefined) updateData.end_date = parseDate(mod.fields.endDate);
      if (mod.fields.graduationYear !== undefined) updateData.graduation_year = mod.fields.graduationYear ?? null;
      if (mod.fields.summary !== undefined) updateData.summary = mod.fields.summary || null;

      if (Object.keys(updateData).length > 0) {
        await dbDirect.education.update({ where: { id: existing.id }, data: updateData });
      }
    }

    for (const key of payload.education.removed ?? []) {
      const [institution, area] = key.split("|||");
      await dbDirect.education.deleteMany({
        where: { profile: profileId, institution, area: area || null },
      });
    }
  }

  // --- Apply skill changes ---
  if (payload.skills) {
    for (const cat of payload.skills.added ?? []) {
      const created = await dbDirect.tech_skill_categories.create({
        data: {
          profile: profileId,
          name: cat.name || null,
          status: "draft",
        },
      });
      let sort = 1;
      for (const skill of cat.skills ?? []) {
        await dbDirect.tech_skills.create({
          data: {
            category: created.id,
            name: skill.name || null,
            level: skill.level || null,
            years_experience: skill.yearsExperience ?? null,
            status: "draft",
            sort: sort++,
          },
        });
      }
    }

    for (const mod of payload.skills.modified ?? []) {
      const existing = await dbDirect.tech_skill_categories.findFirst({
        where: { profile: profileId, name: mod.matchKey },
        select: { id: true },
      });
      if (!existing) continue;

      // Add new skills
      if (mod.addSkills?.length) {
        const maxSort = await dbDirect.tech_skills.aggregate({
          where: { category: existing.id },
          _max: { sort: true },
        });
        let sort = (maxSort._max.sort ?? 0) + 1;
        for (const skill of mod.addSkills) {
          await dbDirect.tech_skills.create({
            data: {
              category: existing.id,
              name: skill.name || null,
              level: skill.level || null,
              years_experience: skill.yearsExperience ?? null,
              status: "draft",
              sort: sort++,
            },
          });
        }
      }

      // Remove skills
      if (mod.removeSkills?.length) {
        for (const name of mod.removeSkills) {
          await dbDirect.tech_skills.deleteMany({
            where: { category: existing.id, name },
          });
        }
      }

      // Modify skills
      if (mod.modifySkills?.length) {
        for (const skillMod of mod.modifySkills) {
          const skill = await dbDirect.tech_skills.findFirst({
            where: { category: existing.id, name: skillMod.name },
            select: { id: true },
          });
          if (!skill) continue;

          const updateData: Record<string, unknown> = {};
          if (skillMod.fields.level !== undefined) updateData.level = skillMod.fields.level || null;
          if (skillMod.fields.yearsExperience !== undefined)
            updateData.years_experience = skillMod.fields.yearsExperience ?? null;

          if (Object.keys(updateData).length > 0) {
            await dbDirect.tech_skills.update({ where: { id: skill.id }, data: updateData });
          }
        }
      }
    }

    for (const name of payload.skills.removed ?? []) {
      const existing = await dbDirect.tech_skill_categories.findFirst({
        where: { profile: profileId, name },
        select: { id: true },
      });
      if (!existing) continue;
      await dbDirect.tech_skills.deleteMany({ where: { category: existing.id } });
      await dbDirect.tech_skill_categories.delete({ where: { id: existing.id } });
    }
  }

  // --- Apply language changes ---
  if (payload.languages) {
    for (const l of payload.languages.added ?? []) {
      await dbDirect.languages.create({
        data: {
          profile: profileId,
          status: "draft",
          name: l.name || null,
          language_code: l.languageCode || null,
          proficiency: l.proficiency || null,
        },
      });
    }

    for (const mod of payload.languages.modified ?? []) {
      const existing = await dbDirect.languages.findFirst({
        where: { profile: profileId, name: mod.matchKey },
        select: { id: true },
      });
      if (!existing) continue;

      const updateData: Record<string, unknown> = {};
      if (mod.fields.languageCode !== undefined) updateData.language_code = mod.fields.languageCode || null;
      if (mod.fields.proficiency !== undefined) updateData.proficiency = mod.fields.proficiency || null;

      if (Object.keys(updateData).length > 0) {
        await dbDirect.languages.update({ where: { id: existing.id }, data: updateData });
      }
    }

    for (const name of payload.languages.removed ?? []) {
      await dbDirect.languages.deleteMany({
        where: { profile: profileId, name },
      });
    }
  }

  // --- Apply project changes ---
  if (payload.projects) {
    for (const p of payload.projects.added ?? []) {
      const created = await dbDirect.side_projects.create({
        data: {
          profile: profileId,
          status: "draft",
          name: p.name || null,
          url: p.url || null,
          url_label: p.urlLabel || null,
          summary: p.summary || null,
          start_date: parseDate(p.startDate),
          end_date: parseDate(p.endDate),
          stars: p.stars ?? null,
        },
      });

      let sort = 1;
      for (const ach of p.achievements ?? []) {
        await dbDirect.side_project_achievements.create({
          data: { side_project: created.id, description: ach, sort: sort++ },
        });
      }

      sort = 1;
      for (const tech of p.technologies ?? []) {
        await dbDirect.side_project_technologies.create({
          data: { side_project: created.id, name: tech, sort: sort++ },
        });
      }
    }

    for (const mod of payload.projects.modified ?? []) {
      const existing = await dbDirect.side_projects.findFirst({
        where: { profile: profileId, name: mod.matchKey },
        select: { id: true },
      });
      if (!existing) continue;

      const updateData: Record<string, unknown> = {};
      if (mod.fields.name !== undefined) updateData.name = mod.fields.name || null;
      if (mod.fields.url !== undefined) updateData.url = mod.fields.url || null;
      if (mod.fields.urlLabel !== undefined) updateData.url_label = mod.fields.urlLabel || null;
      if (mod.fields.summary !== undefined) updateData.summary = mod.fields.summary || null;
      if (mod.fields.startDate !== undefined) updateData.start_date = parseDate(mod.fields.startDate);
      if (mod.fields.endDate !== undefined) updateData.end_date = parseDate(mod.fields.endDate);
      if (mod.fields.stars !== undefined) updateData.stars = mod.fields.stars ?? null;

      if (Object.keys(updateData).length > 0) {
        await dbDirect.side_projects.update({ where: { id: existing.id }, data: updateData });
      }

      // Add achievements
      if (mod.addAchievements?.length) {
        const maxSort = await dbDirect.side_project_achievements.aggregate({
          where: { side_project: existing.id },
          _max: { sort: true },
        });
        let sort = (maxSort._max.sort ?? 0) + 1;
        for (const ach of mod.addAchievements) {
          await dbDirect.side_project_achievements.create({
            data: { side_project: existing.id, description: ach, sort: sort++ },
          });
        }
      }

      if (mod.removeAchievements?.length) {
        for (const ach of mod.removeAchievements) {
          await dbDirect.side_project_achievements.deleteMany({
            where: { side_project: existing.id, description: ach },
          });
        }
      }

      if (mod.addTechnologies?.length) {
        const maxSort = await dbDirect.side_project_technologies.aggregate({
          where: { side_project: existing.id },
          _max: { sort: true },
        });
        let sort = (maxSort._max.sort ?? 0) + 1;
        for (const tech of mod.addTechnologies) {
          await dbDirect.side_project_technologies.create({
            data: { side_project: existing.id, name: tech, sort: sort++ },
          });
        }
      }

      if (mod.removeTechnologies?.length) {
        for (const tech of mod.removeTechnologies) {
          await dbDirect.side_project_technologies.deleteMany({
            where: { side_project: existing.id, name: tech },
          });
        }
      }
    }

    for (const name of payload.projects.removed ?? []) {
      const existing = await dbDirect.side_projects.findFirst({
        where: { profile: profileId, name },
        select: { id: true },
      });
      if (!existing) continue;
      await dbDirect.side_project_achievements.deleteMany({ where: { side_project: existing.id } });
      await dbDirect.side_project_technologies.deleteMany({ where: { side_project: existing.id } });
      await dbDirect.side_projects.delete({ where: { id: existing.id } });
    }
  }

  // --- Apply certificate changes ---
  if (payload.certificates) {
    for (const c of payload.certificates.added ?? []) {
      await dbDirect.certificates.create({
        data: {
          profile: profileId,
          status: "draft",
          name: c.name || "",
          issuer: c.issuer || null,
          date: parseDate(c.date),
          url: c.url || null,
          sort: 0,
          date_created: new Date(),
        },
      });
    }

    for (const mod of payload.certificates.modified ?? []) {
      const existing = await dbDirect.certificates.findFirst({
        where: { profile: profileId, name: mod.matchKey },
        select: { id: true },
      });
      if (!existing) continue;

      const updateData: Record<string, unknown> = {};
      if (mod.fields.name !== undefined) updateData.name = mod.fields.name || "";
      if (mod.fields.issuer !== undefined) updateData.issuer = mod.fields.issuer || null;
      if (mod.fields.date !== undefined) updateData.date = parseDate(mod.fields.date);
      if (mod.fields.url !== undefined) updateData.url = mod.fields.url || null;

      if (Object.keys(updateData).length > 0) {
        updateData.date_updated = new Date();
        await dbDirect.certificates.update({ where: { id: existing.id }, data: updateData });
      }
    }

    for (const name of payload.certificates.removed ?? []) {
      await dbDirect.certificates.deleteMany({
        where: { profile: profileId, name },
      });
    }
  }

  // --- Apply reference changes ---
  if (payload.references) {
    for (const r of payload.references.added ?? []) {
      await dbDirect.references.create({
        data: {
          profile: profileId,
          status: "draft",
          author: r.author || "",
          author_position: r.authorPosition || null,
          text: r.text || null,
        },
      });
    }

    for (const mod of payload.references.modified ?? []) {
      const existing = await dbDirect.references.findFirst({
        where: { profile: profileId, author: mod.matchKey },
        select: { id: true },
      });
      if (!existing) continue;

      const updateData: Record<string, unknown> = {};
      if (mod.fields.author !== undefined) updateData.author = mod.fields.author || "";
      if (mod.fields.authorPosition !== undefined) updateData.author_position = mod.fields.authorPosition || null;
      if (mod.fields.text !== undefined) updateData.text = mod.fields.text || null;

      if (Object.keys(updateData).length > 0) {
        await dbDirect.references.update({ where: { id: existing.id }, data: updateData });
      }
    }

    for (const author of payload.references.removed ?? []) {
      await dbDirect.references.deleteMany({
        where: { profile: profileId, author },
      });
    }
  }
}
