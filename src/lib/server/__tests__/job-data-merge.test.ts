/**
 * Tests for job data merging logic
 * Tests mergeSkills() and mergeJobData() functions
 */

import { describe, expect, it } from "vitest";
import { mergeJobData, mergeSkills } from "../job-scraper";

describe("mergeSkills", () => {
  it("should return null when both inputs are null", () => {
    expect(mergeSkills(null, null)).toBe(null);
  });

  it("should return search skills when detail skills are null", () => {
    const searchSkills = ["TypeScript", "React"];
    expect(mergeSkills(searchSkills, null)).toEqual(searchSkills);
  });

  it("should return detail skills when search skills are null", () => {
    const detailSkills = ["Node.js", "PostgreSQL"];
    expect(mergeSkills(null, detailSkills)).toEqual(detailSkills);
  });

  it("should merge and deduplicate skills (case-insensitive)", () => {
    const searchSkills = ["TypeScript", "React", "Node.js"];
    const detailSkills = ["typescript", "AWS", "Docker"];

    const merged = mergeSkills(searchSkills, detailSkills);

    // Should have 5 unique skills (TypeScript appears twice but different case)
    expect(merged).toHaveLength(5);
    expect(merged).toContain("TypeScript"); // First occurrence wins for casing
    expect(merged).toContain("React");
    expect(merged).toContain("Node.js");
    expect(merged).toContain("AWS");
    expect(merged).toContain("Docker");
  });

  it("should preserve first occurrence's casing", () => {
    const searchSkills = ["JavaScript"];
    const detailSkills = ["javascript", "JAVASCRIPT"];

    const merged = mergeSkills(searchSkills, detailSkills);

    expect(merged).toHaveLength(1);
    expect(merged).toEqual(["JavaScript"]); // First occurrence wins
  });

  it("should handle empty arrays", () => {
    expect(mergeSkills([], [])).toEqual([]);
    expect(mergeSkills(["TypeScript"], [])).toEqual(["TypeScript"]);
    expect(mergeSkills([], ["React"])).toEqual(["React"]);
  });
});

describe("mergeJobData", () => {
  const detailData = {
    title: "Senior Engineer",
    job_description: "Full job description from detail page",
    company_description: "Company info from detail page",
    job_poster: "Acme Corp",
    date_posted: new Date("2026-01-01"),
    location: "San Francisco, CA",
    remote: "Hybrid",
    experience_level: "senior",
    job_type: "full_time",
    salary_min: 150000,
    salary_max: 200000,
    salary_currency: "USD",
    salary_period: "year",
    skills: ["TypeScript", "React", "AWS"],
    status: "hiring",
    source_html_stripped: "<stripped html>",
  };

  it("should use detail page for job_description and company_description", () => {
    const searchData = {}; // Search page doesn't have descriptions
    const merged = mergeJobData(searchData, detailData);

    expect(merged.job_description).toBe(
      "Full job description from detail page",
    );
    expect(merged.company_description).toBe("Company info from detail page");
  });

  it("should prioritize detail page data when both are present", () => {
    const searchData = {
      title: "Search Page Title",
      company: "Search Page Company",
      location: "Search Page Location",
      salary_min: 100000,
    };

    const merged = mergeJobData(searchData, detailData);

    expect(merged.title).toBe("Senior Engineer"); // Detail wins
    expect(merged.job_poster).toBe("Acme Corp"); // Detail wins
    expect(merged.location).toBe("San Francisco, CA"); // Detail wins
    expect(merged.salary_min).toBe(150000); // Detail wins
  });

  it("should use search page as fallback when detail has nulls", () => {
    const searchData = {
      title: "Fallback Title",
      company: "Fallback Company",
      location: "Remote",
      salary_min: 80000,
      salary_max: 120000,
      salary_currency: "EUR",
      salary_period: "year",
    };

    const detailDataWithNulls = {
      ...detailData,
      title: "",
      job_poster: null,
      location: null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      salary_period: null,
    };

    const merged = mergeJobData(searchData, detailDataWithNulls);

    expect(merged.title).toBe("Fallback Title"); // Search fallback
    expect(merged.job_poster).toBe("Fallback Company"); // Search fallback
    expect(merged.location).toBe("Remote"); // Search fallback
    expect(merged.salary_min).toBe(80000); // Search fallback
    expect(merged.salary_max).toBe(120000); // Search fallback
    expect(merged.salary_currency).toBe("EUR"); // Search fallback
    expect(merged.salary_period).toBe("year"); // Search fallback
  });

  it("should merge skills from both sources", () => {
    const searchData = {
      skills: ["Python", "Django"],
    };

    const detailDataWithSkills = {
      ...detailData,
      skills: ["python", "FastAPI", "PostgreSQL"],
    };

    const merged = mergeJobData(searchData, detailDataWithSkills);

    expect(merged.skills).toHaveLength(4); // Python, Django, FastAPI, PostgreSQL
    expect(merged.skills).toContain("Python"); // First occurrence wins casing
    expect(merged.skills).toContain("Django");
    expect(merged.skills).toContain("FastAPI");
    expect(merged.skills).toContain("PostgreSQL");
  });

  it("should parse search date when detail date is null", () => {
    const searchData = {
      date_posted: "Posted 3 days ago",
    };

    const detailDataWithoutDate = {
      ...detailData,
      date_posted: null,
    };

    const merged = mergeJobData(searchData, detailDataWithoutDate);

    // parseRelativeDate should parse the string
    expect(merged.date_posted).toBeInstanceOf(Date);
  });

  it("should handle search data with all nulls", () => {
    const searchData = {
      clickableId: 42,
      title: null,
      company: null,
      location: null,
      salary_min: null,
      salary_max: null,
      salary_currency: null,
      salary_period: null,
      skills: null,
      remote: null,
      date_posted: null,
    };

    const merged = mergeJobData(searchData, detailData);

    // All detail data should be used
    expect(merged.title).toBe("Senior Engineer");
    expect(merged.job_poster).toBe("Acme Corp");
    expect(merged.location).toBe("San Francisco, CA");
    expect(merged.salary_min).toBe(150000);
  });

  it("should use fallback title 'Untitled Position' when both are empty", () => {
    const searchData = { title: null };
    const detailDataWithoutTitle = {
      ...detailData,
      title: "",
    };

    const merged = mergeJobData(searchData, detailDataWithoutTitle);

    expect(merged.title).toBe("Untitled Position");
  });

  it("should preserve zero salary values using nullish coalescing", () => {
    const searchData = {
      salary_min: 0,
      salary_max: 0,
    };

    const detailDataWithNullSalary = {
      ...detailData,
      salary_min: null,
      salary_max: null,
    };

    const merged = mergeJobData(searchData, detailDataWithNullSalary);

    expect(merged.salary_min).toBe(0); // Should preserve 0, not treat as falsy
    expect(merged.salary_max).toBe(0);
  });

  it("should keep detail page-only fields unchanged", () => {
    const searchData = {
      title: "Search Title",
    };

    const merged = mergeJobData(searchData, detailData);

    expect(merged.job_description).toBe(
      "Full job description from detail page",
    );
    expect(merged.company_description).toBe("Company info from detail page");
    expect(merged.experience_level).toBe("senior");
    expect(merged.job_type).toBe("full_time");
    expect(merged.status).toBe("hiring");
    expect(merged.source_html_stripped).toBe("<stripped html>");
  });
});
