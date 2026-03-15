/**
 * Unit tests for JSON Resume mapper
 * Tests conversion from JSON Resume schema to internal ResumeData format
 */

import { describe, expect, it } from "vitest";
import {
  type JsonResumeSchema,
  mapJsonResumeToInternal,
  validateJsonResume,
} from "../json-resume-mapper";

describe("validateJsonResume", () => {
  it("should validate a valid minimal JSON Resume", () => {
    const validResume = {
      basics: {
        name: "John Doe",
      },
    };

    expect(() => validateJsonResume(validResume)).not.toThrow();
    expect(validateJsonResume(validResume)).toBe(true);
  });

  it("should throw error for non-object input", () => {
    expect(() => validateJsonResume(null)).toThrow(
      "Invalid JSON Resume: data must be an object",
    );
    expect(() => validateJsonResume("string")).toThrow(
      "Invalid JSON Resume: data must be an object",
    );
    expect(() => validateJsonResume(123)).toThrow(
      "Invalid JSON Resume: data must be an object",
    );
  });

  it("should throw error for missing basics field", () => {
    const invalidResume = {
      work: [],
    };

    expect(() => validateJsonResume(invalidResume)).toThrow(
      "Invalid JSON Resume: missing 'basics' field",
    );
  });

  it("should throw error for missing basics.name field", () => {
    const invalidResume = {
      basics: {
        email: "john@example.com",
      },
    };

    expect(() => validateJsonResume(invalidResume)).toThrow(
      "Invalid JSON Resume: missing 'basics.name' field",
    );
  });
});

describe("mapJsonResumeToInternal", () => {
  it("should map minimal JSON Resume with only name", async () => {
    const jsonResume: JsonResumeSchema = {
      basics: {
        name: "John Doe",
      },
    };

    const result = await mapJsonResumeToInternal(jsonResume);

    expect(result.basics.name).toBe("John Doe");
    expect(result.basics.email).toBeUndefined();
    expect(result.basics.phone).toBeUndefined();
  });

  it("should throw error if basics.name is missing", () => {
    const jsonResume: JsonResumeSchema = {
      basics: {
        email: "john@example.com",
      },
    };

    expect(() => mapJsonResumeToInternal(jsonResume)).toThrow(
      "JSON Resume must include basics.name field",
    );
  });

  it("should map complete basics information", async () => {
    const jsonResume: JsonResumeSchema = {
      basics: {
        name: "John Doe",
        label: "Senior Software Engineer",
        email: "john@example.com",
        phone: "(555) 123-4567",
        url: "https://johndoe.com",
        summary:
          "Experienced software engineer with 10 years in web development",
        location: {
          city: "San Francisco",
          region: "California",
          countryCode: "US",
        },
        profiles: [
          {
            network: "LinkedIn",
            url: "https://linkedin.com/in/johndoe",
          },
          {
            network: "GitHub",
            url: "https://github.com/johndoe",
          },
          {
            network: "Stack Overflow",
            url: "https://stackoverflow.com/users/123456",
          },
        ],
      },
    };

    const result = await mapJsonResumeToInternal(jsonResume);

    expect(result.basics.name).toBe("John Doe");
    expect(result.basics.title).toBe("Senior Software Engineer");
    expect(result.basics.email).toBe("john@example.com");
    expect(result.basics.phone).toBe("(555) 123-4567");
    expect(result.basics.website).toBe("https://johndoe.com");
    expect(result.basics.summary).toBe(
      "Experienced software engineer with 10 years in web development",
    );
    expect(result.basics.location).toBe("San Francisco, California, US");
    expect(result.basics.linkedin).toBe("https://linkedin.com/in/johndoe");
    expect(result.basics.github).toBe("https://github.com/johndoe");
    expect(result.basics.stackoverflow).toBe(
      "https://stackoverflow.com/users/123456",
    );
  });

  it("should map location fields correctly with partial data", async () => {
    const jsonResume: JsonResumeSchema = {
      basics: {
        name: "John Doe",
        location: {
          city: "Amsterdam",
        },
      },
    };

    const result = await mapJsonResumeToInternal(jsonResume);
    expect(result.basics.location).toBe("Amsterdam");
  });

  it("should handle location with city and country", async () => {
    const jsonResume: JsonResumeSchema = {
      basics: {
        name: "John Doe",
        location: {
          city: "London",
          countryCode: "UK",
        },
      },
    };

    const result = await mapJsonResumeToInternal(jsonResume);
    expect(result.basics.location).toBe("London, UK");
  });

  it("should map work experience correctly", async () => {
    const jsonResume: JsonResumeSchema = {
      basics: {
        name: "John Doe",
      },
      work: [
        {
          name: "Tech Corp",
          position: "Senior Developer",
          url: "https://techcorp.com",
          startDate: "2020-01-01",
          endDate: "2023-12-31",
          summary: "Led development team",
          highlights: [
            "Improved performance by 50%",
            "Mentored 5 junior developers",
          ],
        },
      ],
    };

    const result = await mapJsonResumeToInternal(jsonResume);

    expect(result.work).toHaveLength(1);
    expect(result.work?.[0].name).toBe("Tech Corp");
    expect(result.work?.[0].position).toBe("Senior Developer");
    expect(result.work?.[0].website).toBe("https://techcorp.com");
    expect(result.work?.[0].startDate).toBe("2020-01-01");
    expect(result.work?.[0].endDate).toBe("2023-12-31");
    expect(result.work?.[0].summary).toBe("Led development team");
    expect(result.work?.[0].achievements).toHaveLength(2);
    expect(result.work?.[0].achievements?.[0]).toBe(
      "Improved performance by 50%",
    );
  });

  it("should map education with graduation year extraction", async () => {
    const jsonResume: JsonResumeSchema = {
      basics: {
        name: "John Doe",
      },
      education: [
        {
          institution: "University of Technology",
          area: "Computer Science",
          studyType: "Bachelor",
          url: "https://university.edu",
          startDate: "2010-09-01",
          endDate: "2014-06-30",
        },
      ],
    };

    const result = await mapJsonResumeToInternal(jsonResume);

    expect(result.education).toHaveLength(1);
    expect(result.education?.[0].institution).toBe("University of Technology");
    expect(result.education?.[0].area).toBe("Computer Science");
    expect(result.education?.[0].studyType).toBe("Bachelor");
    expect(result.education?.[0].url).toBe("https://university.edu");
    expect(result.education?.[0].graduationYear).toBe(2014);
  });

  it("should map skills with level conversion", async () => {
    const jsonResume: JsonResumeSchema = {
      basics: {
        name: "John Doe",
      },
      skills: [
        {
          name: "Web Development",
          level: "Master",
          keywords: ["HTML", "CSS", "JavaScript"],
        },
        {
          name: "Backend",
          level: "Advanced",
          keywords: ["Node.js", "Python"],
        },
      ],
    };

    const result = await mapJsonResumeToInternal(jsonResume);

    expect(result.skills).toHaveLength(2);
    expect(result.skills?.[0].name).toBe("Web Development");
    expect(result.skills?.[0].skills).toHaveLength(3);
    expect(result.skills?.[0].skills?.[0].name).toBe("HTML");
    expect(result.skills?.[0].skills?.[0].level).toBe("expert");
    expect(result.skills?.[1].skills?.[0].level).toBe("proficient");
  });

  it("should map languages with fluency conversion", async () => {
    const jsonResume: JsonResumeSchema = {
      basics: {
        name: "John Doe",
      },
      languages: [
        {
          language: "English",
          fluency: "Native speaker",
        },
        {
          language: "Spanish",
          fluency: "Fluent",
        },
        {
          language: "French",
          fluency: "Conversational",
        },
      ],
    };

    const result = await mapJsonResumeToInternal(jsonResume);

    expect(result.languages).toHaveLength(3);
    expect(result.languages?.[0].name).toBe("English");
    expect(result.languages?.[0].proficiency).toBe("native");
    expect(result.languages?.[1].proficiency).toBe("fluent");
    expect(result.languages?.[2].proficiency).toBe("conversational");
  });

  it("should map projects correctly", async () => {
    const jsonResume: JsonResumeSchema = {
      basics: {
        name: "John Doe",
      },
      projects: [
        {
          name: "Open Source Library",
          description: "A popular JavaScript library",
          url: "https://github.com/johndoe/library",
          startDate: "2021-01-01",
          endDate: "2023-12-31",
          highlights: ["10k+ GitHub stars", "Used by major companies"],
          keywords: ["JavaScript", "TypeScript", "React"],
        },
      ],
    };

    const result = await mapJsonResumeToInternal(jsonResume);

    expect(result.projects).toHaveLength(1);
    expect(result.projects?.[0].name).toBe("Open Source Library");
    expect(result.projects?.[0].url).toBe("https://github.com/johndoe/library");
    expect(result.projects?.[0].summary).toBe("A popular JavaScript library");
    expect(result.projects?.[0].achievements).toHaveLength(2);
    expect(result.projects?.[0].technologies).toHaveLength(3);
  });

  it("should map references correctly", async () => {
    const jsonResume: JsonResumeSchema = {
      basics: {
        name: "John Doe",
      },
      references: [
        {
          name: "Jane Smith",
          reference: "John is an excellent developer and team player.",
        },
      ],
    };

    const result = await mapJsonResumeToInternal(jsonResume);

    expect(result.references).toHaveLength(1);
    expect(result.references?.[0].author).toBe("Jane Smith");
    expect(result.references?.[0].text).toBe(
      "John is an excellent developer and team player.",
    );
  });

  it("should handle case-insensitive social network matching", async () => {
    const jsonResume: JsonResumeSchema = {
      basics: {
        name: "John Doe",
        profiles: [
          { network: "linkedin", url: "https://linkedin.com/in/john" },
          { network: "GITHUB", url: "https://github.com/john" },
          {
            network: "stackoverflow",
            url: "https://stackoverflow.com/users/123",
          },
        ],
      },
    };

    const result = await mapJsonResumeToInternal(jsonResume);

    expect(result.basics.linkedin).toBe("https://linkedin.com/in/john");
    expect(result.basics.github).toBe("https://github.com/john");
    expect(result.basics.stackoverflow).toBe(
      "https://stackoverflow.com/users/123",
    );
  });

  it("should handle empty arrays gracefully", async () => {
    const jsonResume: JsonResumeSchema = {
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

    const result = await mapJsonResumeToInternal(jsonResume);

    expect(result.work).toHaveLength(0);
    expect(result.education).toHaveLength(0);
    expect(result.skills).toHaveLength(0);
    expect(result.languages).toHaveLength(0);
    expect(result.projects).toHaveLength(0);
    expect(result.references).toHaveLength(0);
  });
});
