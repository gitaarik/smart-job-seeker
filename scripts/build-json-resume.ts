#!/usr/bin/env node

import { writeFileSync } from "fs";
import { resume } from "../src/lib/data/resume.ts";

// Convert to JSON Resume format
function convertToJsonResume(data) {
  const jsonResume = {
    $schema:
      "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: {
      name: data.basics.name,
      label: data.basics.label,
      image: data.basics.image,
      email: data.basics.email,
      phone: data.basics.phone,
      url: data.basics.url,
      summary: data.basics.summary,
      location: {
        address: data.basics.location.address,
        postalCode: "", // Not available in source
        city: data.basics.location.city,
        countryCode: data.basics.location.countryCode,
        region: data.basics.location.region,
      },
      profiles: data.basics.profiles.map((profile) => ({
        network: profile.network,
        username: profile.username,
        url: profile.url,
      })),
    },
    work: data.work.map((job) => ({
      name: job.name,
      position: job.position,
      url: job.url || "",
      startDate: job.startDate,
      endDate: job.endDate || "",
      summary: job.summary,
      highlights: job.highlights
        ? job.highlights.map((h) => h.description || h.title)
        : [],
    })),
    volunteer: [], // Not available in source data
    education: [], // Not available in source data
    awards: [], // Not available in source data
    certificates: [], // Not available in source data
    publications: [], // Not available in source data
    skills: data.skills.map((skill) => ({
      name: skill.name,
      level: skill.level,
      keywords: skill.keywords,
    })),
    languages: data.languages.map((lang) => ({
      language: lang.language,
      fluency: lang.fluency,
    })),
    interests: [], // Not available in source data
    references: data.references.map((ref) => ({
      name: ref.name,
      reference: ref.reference,
    })),
    projects: data.projects || [],
  };

  return jsonResume;
}

// Convert and output
try {
  const jsonResumeData = convertToJsonResume(resume);
  const outputPath = "./dist/resume.json";

  writeFileSync(outputPath, JSON.stringify(jsonResumeData, null, 2));
  console.log(`✅ JSON Resume successfully generated at: ${outputPath}`);
  console.log(`📊 Generated resume contains:`);
  console.log(`   - ${jsonResumeData.work.length} work experiences`);
  console.log(`   - ${jsonResumeData.skills.length} skills`);
  console.log(`   - ${jsonResumeData.languages.length} languages`);
  console.log(`   - ${jsonResumeData.references.length} references`);
} catch (error) {
  console.error("Error generating JSON Resume:", error.message);
  process.exit(1);
}

