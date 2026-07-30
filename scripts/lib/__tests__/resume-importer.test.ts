/**
 * Unit tests for resume importer
 * Tests core profile creation logic with mocked database
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ResumeData } from "../types/resume-import.types";

// Mock the database
vi.mock("$lib/server/db", () => ({
  dbDirect: {
    profiles: {
      create: vi.fn(),
    },
    work_experiences: {
      create: vi.fn(),
    },
    work_experience_achievements: {
      create: vi.fn(),
    },
    work_experience_technologies: {
      create: vi.fn(),
    },
    education: {
      create: vi.fn(),
    },
    tech_skill_categories: {
      create: vi.fn(),
    },
    tech_skills: {
      create: vi.fn(),
    },
    languages: {
      create: vi.fn(),
    },
    side_projects: {
      create: vi.fn(),
    },
    side_project_achievements: {
      create: vi.fn(),
    },
    side_project_technologies: {
      create: vi.fn(),
    },
    references: {
      create: vi.fn(),
    },
  },
}));

import { createProfileFromResume } from "../resume-importer";
import { dbDirect } from "$lib/server/db";

describe("createProfileFromResume", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create a minimal profile with only name", async () => {
    const resumeData: ResumeData = {
      basics: {
        name: "John Doe",
      },
    };

    const mockProfile = { id: 1, name: "John Doe" };
    (dbDirect.profiles.create as any).mockResolvedValue(mockProfile);

    const result = await createProfileFromResume(resumeData);

    expect(result.success).toBe(true);
    expect(result.profileId).toBe(1);
    expect(result.message).toBe("Profile imported successfully");
    expect(dbDirect.profiles.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "John Doe",
      }),
    });
  });

  it("should return error if name is missing", async () => {
    const resumeData: ResumeData = {
      basics: {
        name: "",
      },
    };

    const result = await createProfileFromResume(resumeData);

    expect(result.success).toBe(false);
    expect(result.message).toContain("Profile name is required");
    expect(dbDirect.profiles.create).not.toHaveBeenCalled();
  });

  it("should create profile with complete basics information", async () => {
    const resumeData: ResumeData = {
      basics: {
        name: "John Doe",
        title: "Senior Developer",
        location: "San Francisco, CA, US",
        phone: "555-1234",
        email: "john@example.com",
        website: "https://johndoe.com",
        linkedin: "https://linkedin.com/in/johndoe",
        github: "https://github.com/johndoe",
        stackoverflow: "https://stackoverflow.com/users/123",
        headline: "Passionate developer",
        summary: "10 years of experience in web development",
        subtitle: "Full Stack Engineer",
        coreStack: "React, Node.js, PostgreSQL",
      },
    };

    const mockProfile = { id: 1, name: "John Doe" };
    (dbDirect.profiles.create as any).mockResolvedValue(mockProfile);

    const result = await createProfileFromResume(resumeData);

    expect(result.success).toBe(true);
    expect(dbDirect.profiles.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "John Doe",
        title: "Senior Developer",
        location: "San Francisco, CA, US",
        phone_number: "555-1234",
        email_address: "john@example.com",
        personal_website: "https://johndoe.com",
        linkedin_profile: "https://linkedin.com/in/johndoe",
        github_profile: "https://github.com/johndoe",
        stackoverflow_profile: "https://stackoverflow.com/users/123",
        headline: "Passionate developer",
        summary: "10 years of experience in web development",
        subtitle: "Full Stack Engineer",
        core_stack: "React, Node.js, PostgreSQL",
      }),
    });
  });

  it("should create work experiences with achievements and technologies", async () => {
    const resumeData: ResumeData = {
      basics: {
        name: "John Doe",
      },
      work: [
        {
          name: "Tech Corp",
          position: "Senior Developer",
          location: "New York",
          description: "Led development team",
          summary: "Full stack development",
          website: "https://techcorp.com",
          startDate: "2020-01-01",
          endDate: "2023-12-31",
          achievements: [
            "Improved performance by 50%",
            "Mentored 5 developers",
          ],
          technologies: ["React", "Node.js", "PostgreSQL"],
        },
      ],
    };

    const mockProfile = { id: 1, name: "John Doe" };
    const mockWorkExperience = { id: 10 };

    (dbDirect.profiles.create as any).mockResolvedValue(mockProfile);
    (dbDirect.work_experiences.create as any).mockResolvedValue(
      mockWorkExperience,
    );
    (dbDirect.work_experience_achievements.create as any).mockResolvedValue({});
    (dbDirect.work_experience_technologies.create as any).mockResolvedValue({});

    const result = await createProfileFromResume(resumeData);

    expect(result.success).toBe(true);
    expect(result.stats?.workExperiences).toBe(1);
    expect(dbDirect.work_experiences.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Tech Corp",
        position: "Senior Developer",
        location: "New York",
        description: "Led development team",
        summary: "Full stack development",
        website: "https://techcorp.com",
        status: "draft",
        profiles: {
          connect: { id: 1 },
        },
      }),
    });

    // Verify achievements were created
    expect(dbDirect.work_experience_achievements.create).toHaveBeenCalledTimes(
      2,
    );
    expect(dbDirect.work_experience_achievements.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        title: "Improved performance by 50%",
        status: "draft",
        sort: 1,
        work_experiences: {
          connect: { id: 10 },
        },
      }),
    });

    // Verify technologies were created
    expect(dbDirect.work_experience_technologies.create).toHaveBeenCalledTimes(
      3,
    );
    expect(dbDirect.work_experience_technologies.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "React",
        status: "draft",
        sort: 1,
        work_experiences: {
          connect: { id: 10 },
        },
      }),
    });
  });

  it("should create education entries with graduation year", async () => {
    const resumeData: ResumeData = {
      basics: {
        name: "John Doe",
      },
      education: [
        {
          institution: "University of Technology",
          area: "Computer Science",
          studyType: "Bachelor",
          location: "Boston, MA",
          url: "https://university.edu",
          startDate: "2010-09-01",
          endDate: "2014-06-30",
          graduationYear: 2014,
          summary: "Graduated with honors",
        },
      ],
    };

    const mockProfile = { id: 1, name: "John Doe" };
    (dbDirect.profiles.create as any).mockResolvedValue(mockProfile);
    (dbDirect.education.create as any).mockResolvedValue({});

    const result = await createProfileFromResume(resumeData);

    expect(result.success).toBe(true);
    expect(result.stats?.education).toBe(1);
    expect(dbDirect.education.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        institution: "University of Technology",
        area: "Computer Science",
        study_type: "Bachelor",
        location: "Boston, MA",
        url: "https://university.edu",
        graduation_year: 2014,
        summary: "Graduated with honors",
        status: "draft",
        profiles: {
          connect: { id: 1 },
        },
      }),
    });
  });

  it("should create skill categories with individual skills", async () => {
    const resumeData: ResumeData = {
      basics: {
        name: "John Doe",
      },
      skills: [
        {
          name: "Frontend Development",
          skills: [
            { name: "React", level: "expert", yearsExperience: 5 },
            { name: "Vue", level: "proficient", yearsExperience: 3 },
            { name: "Angular", level: "intermediate" },
          ],
        },
        {
          name: "Backend Development",
          skills: [
            { name: "Node.js", level: "expert" },
            { name: "Python" },
          ],
        },
      ],
    };

    const mockProfile = { id: 1, name: "John Doe" };
    const mockCategory1 = { id: 20 };
    const mockCategory2 = { id: 21 };

    (dbDirect.profiles.create as any).mockResolvedValue(mockProfile);
    (dbDirect.tech_skill_categories.create as any)
      .mockResolvedValueOnce(mockCategory1)
      .mockResolvedValueOnce(mockCategory2);
    (dbDirect.tech_skills.create as any).mockResolvedValue({});

    const result = await createProfileFromResume(resumeData);

    expect(result.success).toBe(true);
    expect(result.stats?.skillCategories).toBe(2);
    expect(result.stats?.totalSkills).toBe(5);

    expect(dbDirect.tech_skill_categories.create).toHaveBeenCalledTimes(2);
    expect(dbDirect.tech_skills.create).toHaveBeenCalledTimes(5);

    // Verify first skill
    expect(dbDirect.tech_skills.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "React",
        level: "expert",
        years_experience: 5,
        status: "draft",
        sort: 1,
        tech_skill_categories: {
          connect: { id: 20 },
        },
      }),
    });
  });

  it("should create language entries", async () => {
    const resumeData: ResumeData = {
      basics: {
        name: "John Doe",
      },
      languages: [
        {
          name: "English",
          languageCode: "en",
          proficiency: "native",
        },
        {
          name: "Spanish",
          languageCode: "es",
          proficiency: "fluent",
        },
      ],
    };

    const mockProfile = { id: 1, name: "John Doe" };
    (dbDirect.profiles.create as any).mockResolvedValue(mockProfile);
    (dbDirect.languages.create as any).mockResolvedValue({});

    const result = await createProfileFromResume(resumeData);

    expect(result.success).toBe(true);
    expect(result.stats?.languages).toBe(2);
    expect(dbDirect.languages.create).toHaveBeenCalledTimes(2);
    expect(dbDirect.languages.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "English",
        language_code: "en",
        proficiency: "native",
        status: "draft",
        profiles: {
          connect: { id: 1 },
        },
      }),
    });
  });

  it("should create side projects with achievements and technologies", async () => {
    const resumeData: ResumeData = {
      basics: {
        name: "John Doe",
      },
      projects: [
        {
          name: "Open Source Library",
          url: "https://github.com/johndoe/library",
          repoUrl: "https://github.com/johndoe/library",
          summary: "A popular library",
          startDate: "2021-01-01",
          endDate: "2023-12-31",
          stars: 1500,
          achievements: ["10k downloads", "Featured in conference"],
          technologies: ["TypeScript", "React", "Vite"],
        },
      ],
    };

    const mockProfile = { id: 1, name: "John Doe" };
    const mockProject = { id: 30 };

    (dbDirect.profiles.create as any).mockResolvedValue(mockProfile);
    (dbDirect.side_projects.create as any).mockResolvedValue(mockProject);
    (dbDirect.side_project_achievements.create as any).mockResolvedValue({});
    (dbDirect.side_project_technologies.create as any).mockResolvedValue({});

    const result = await createProfileFromResume(resumeData);

    expect(result.success).toBe(true);
    expect(result.stats?.projects).toBe(1);
    expect(dbDirect.side_projects.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: "Open Source Library",
        url: "https://github.com/johndoe/library",
        repo_url: "https://github.com/johndoe/library",
        summary: "A popular library",
        stars: 1500,
        status: "draft",
        profiles: {
          connect: { id: 1 },
        },
      }),
    });

    expect(dbDirect.side_project_achievements.create).toHaveBeenCalledTimes(2);
    expect(dbDirect.side_project_achievements.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        description: "10k downloads",
        sort: 1,
        side_projects: {
          connect: { id: 30 },
        },
      }),
    });

    expect(dbDirect.side_project_technologies.create).toHaveBeenCalledTimes(3);
  });

  it("should create references", async () => {
    const resumeData: ResumeData = {
      basics: {
        name: "John Doe",
      },
      references: [
        {
          author: "Jane Smith",
          authorPosition: "CTO at Tech Corp",
          text: "John is an excellent developer and team player.",
        },
      ],
    };

    const mockProfile = { id: 1, name: "John Doe" };
    (dbDirect.profiles.create as any).mockResolvedValue(mockProfile);
    (dbDirect.references.create as any).mockResolvedValue({});

    const result = await createProfileFromResume(resumeData);

    expect(result.success).toBe(true);
    expect(result.stats?.references).toBe(1);
    expect(dbDirect.references.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        author: "Jane Smith",
        author_position: "CTO at Tech Corp",
        text: "John is an excellent developer and team player.",
        status: "draft",
        profiles: {
          connect: { id: 1 },
        },
      }),
    });
  });

  it("should handle database errors gracefully", async () => {
    const resumeData: ResumeData = {
      basics: {
        name: "John Doe",
      },
    };

    (dbDirect.profiles.create as any).mockRejectedValue(
      new Error("Database connection failed"),
    );

    const result = await createProfileFromResume(resumeData);

    expect(result.success).toBe(false);
    expect(result.message).toBe("Database connection failed");
    expect(result.errors).toContain("Database connection failed");
  });

  it("should create complete profile with all sections", async () => {
    const resumeData: ResumeData = {
      basics: {
        name: "Jane Smith",
        title: "Full Stack Developer",
        email: "jane@example.com",
      },
      work: [
        {
          name: "Company A",
          position: "Developer",
        },
      ],
      education: [
        {
          institution: "University",
        },
      ],
      skills: [
        {
          name: "Programming",
          skills: [{ name: "JavaScript" }],
        },
      ],
      languages: [
        {
          name: "English",
        },
      ],
      projects: [
        {
          name: "Project X",
        },
      ],
      references: [
        {
          author: "Manager",
          text: "Great work",
        },
      ],
    };

    const mockProfile = { id: 1, name: "Jane Smith" };
    const mockWorkExp = { id: 10 };
    const mockCategory = { id: 20 };
    const mockProject = { id: 30 };

    (dbDirect.profiles.create as any).mockResolvedValue(mockProfile);
    (dbDirect.work_experiences.create as any).mockResolvedValue(mockWorkExp);
    (dbDirect.education.create as any).mockResolvedValue({});
    (dbDirect.tech_skill_categories.create as any).mockResolvedValue(
      mockCategory,
    );
    (dbDirect.tech_skills.create as any).mockResolvedValue({});
    (dbDirect.languages.create as any).mockResolvedValue({});
    (dbDirect.side_projects.create as any).mockResolvedValue(mockProject);
    (dbDirect.references.create as any).mockResolvedValue({});

    const result = await createProfileFromResume(resumeData);

    expect(result.success).toBe(true);
    expect(result.profileId).toBe(1);
    expect(result.stats).toEqual({
      workExperiences: 1,
      education: 1,
      skillCategories: 1,
      totalSkills: 1,
      languages: 1,
      projects: 1,
      references: 1,
    });
  });

  it("should handle empty arrays for all sections", async () => {
    const resumeData: ResumeData = {
      basics: {
        name: "John Doe",
      },
      work: [],
      education: [],
      skills: [],
      languages: [],
      projects: [],
      references: [],
    };

    const mockProfile = { id: 1, name: "John Doe" };
    (dbDirect.profiles.create as any).mockResolvedValue(mockProfile);

    const result = await createProfileFromResume(resumeData);

    expect(result.success).toBe(true);
    expect(result.stats).toEqual({
      workExperiences: 0,
      education: 0,
      skillCategories: 0,
      totalSkills: 0,
      languages: 0,
      projects: 0,
      references: 0,
    });
  });
});
