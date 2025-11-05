#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Tech skill type IDs from database
const TECH_TYPES = {
  PROGRAMMING_LANGUAGE: 1,
  FRAMEWORK_LIBRARY: 2,
  RELATIONAL_DATABASE: 3,
  DEVELOPMENT_TOOL: 4,
  NOSQL_DATABASE: 5,
  VERSION_CONTROL: 6,
  CODE_EDITOR_IDE: 7,
  CONTAINER_ORCHESTRATION: 8,
  CI_CD_AUTOMATION: 9,
  INFRASTRUCTURE_AS_CODE: 10,
  CLOUD_PLATFORM: 11,
  NETWORKING_CACHING: 12,
  APIS_INTEGRATION: 13,
  DEVELOPMENT_METHODOLOGY: 14,
};

// Map skills to categories based on context from work experiences
const SKILLS_BY_CATEGORY: Record<string, { name: string; yearsExperience?: number; level?: string; techType?: number }[]> = {
  Backend: [
    { name: "Python", yearsExperience: 10, techType: TECH_TYPES.PROGRAMMING_LANGUAGE },
    { name: "Django", yearsExperience: 10, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "Django REST Framework", yearsExperience: 10, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "Django Channels", yearsExperience: 8, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "Django Silk", yearsExperience: 7, techType: TECH_TYPES.DEVELOPMENT_TOOL },
    { name: "Jinja2", yearsExperience: 10, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "Weasyprint", yearsExperience: 5, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "Node.js", yearsExperience: 8, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "Express", yearsExperience: 7, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "Flask", yearsExperience: 5, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "PHP", yearsExperience: 10, techType: TECH_TYPES.PROGRAMMING_LANGUAGE },
    { name: "Laravel", yearsExperience: 3, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
  ],
  Frontend: [
    { name: "React", yearsExperience: 8, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "MobX", yearsExperience: 7, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "Lit", yearsExperience: 4, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "Web Components", yearsExperience: 4, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "Vue.js", yearsExperience: 6, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "JavaScript", yearsExperience: 12, techType: TECH_TYPES.PROGRAMMING_LANGUAGE },
    { name: "TypeScript", yearsExperience: 5, techType: TECH_TYPES.PROGRAMMING_LANGUAGE },
    { name: "Svelte", yearsExperience: 2, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "jQuery", yearsExperience: 8, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "Bootstrap", yearsExperience: 8, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "Tailwind CSS", yearsExperience: 3, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
    { name: "HTML5", yearsExperience: 12, techType: TECH_TYPES.PROGRAMMING_LANGUAGE },
    { name: "CSS3", yearsExperience: 12, techType: TECH_TYPES.PROGRAMMING_LANGUAGE },
    { name: "AJAX", yearsExperience: 10, techType: TECH_TYPES.APIS_INTEGRATION },
    { name: "Responsive design", yearsExperience: 10, techType: TECH_TYPES.DEVELOPMENT_TOOL },
    { name: "Webpack", yearsExperience: 6, techType: TECH_TYPES.DEVELOPMENT_TOOL },
    { name: "Sveltekit", yearsExperience: 1, techType: TECH_TYPES.FRAMEWORK_LIBRARY },
  ],
  Databases: [
    { name: "MySQL", yearsExperience: 10, techType: TECH_TYPES.RELATIONAL_DATABASE },
    { name: "PostgreSQL", yearsExperience: 8, techType: TECH_TYPES.RELATIONAL_DATABASE },
    { name: "MongoDB", yearsExperience: 6, techType: TECH_TYPES.NOSQL_DATABASE },
    { name: "Redis", yearsExperience: 8, techType: TECH_TYPES.NOSQL_DATABASE },
    { name: "Elasticsearch", yearsExperience: 5, techType: TECH_TYPES.NOSQL_DATABASE },
  ],
  "Development Tools": [
    { name: "Git", yearsExperience: 12, techType: TECH_TYPES.VERSION_CONTROL },
    { name: "GitHub", yearsExperience: 10, techType: TECH_TYPES.VERSION_CONTROL },
    { name: "GitLab", yearsExperience: 5, techType: TECH_TYPES.VERSION_CONTROL },
    { name: "Bitbucket", yearsExperience: 5, techType: TECH_TYPES.VERSION_CONTROL },
    { name: "Docker", yearsExperience: 7, techType: TECH_TYPES.CONTAINER_ORCHESTRATION },
    { name: "Docker Compose", yearsExperience: 7, techType: TECH_TYPES.CONTAINER_ORCHESTRATION },
    { name: "Selenium", yearsExperience: 7, techType: TECH_TYPES.DEVELOPMENT_TOOL },
    { name: "Postman", yearsExperience: 6, techType: TECH_TYPES.DEVELOPMENT_TOOL },
  ],
  DevOps: [
    { name: "Ansible", yearsExperience: 7, techType: TECH_TYPES.INFRASTRUCTURE_AS_CODE },
    { name: "Nginx", yearsExperience: 8, techType: TECH_TYPES.NETWORKING_CACHING },
    { name: "Apache", yearsExperience: 8, techType: TECH_TYPES.NETWORKING_CACHING },
    { name: "HAProxy", yearsExperience: 5, techType: TECH_TYPES.NETWORKING_CACHING },
    { name: "Kubernetes", yearsExperience: 4, techType: TECH_TYPES.CONTAINER_ORCHESTRATION },
    { name: "AWS EC2", yearsExperience: 8, techType: TECH_TYPES.CLOUD_PLATFORM },
    { name: "AWS S3", yearsExperience: 8, techType: TECH_TYPES.CLOUD_PLATFORM },
    { name: "Linode", yearsExperience: 8, techType: TECH_TYPES.CLOUD_PLATFORM },
    { name: "Linux", yearsExperience: 10, techType: TECH_TYPES.DEVELOPMENT_TOOL },
    { name: "CI/CD", yearsExperience: 8, techType: TECH_TYPES.CI_CD_AUTOMATION },
    { name: "Jenkins", yearsExperience: 5, techType: TECH_TYPES.CI_CD_AUTOMATION },
  ],
  "Cloud Platforms": [
    { name: "Amazon Web Services (AWS)", yearsExperience: 8, techType: TECH_TYPES.CLOUD_PLATFORM },
    { name: "AWS EC2", yearsExperience: 8, techType: TECH_TYPES.CLOUD_PLATFORM },
    { name: "AWS S3", yearsExperience: 8, techType: TECH_TYPES.CLOUD_PLATFORM },
    { name: "AWS Lambda", yearsExperience: 5, techType: TECH_TYPES.CLOUD_PLATFORM },
    { name: "AWS EKS", yearsExperience: 3, techType: TECH_TYPES.CLOUD_PLATFORM },
    { name: "DigitalOcean", yearsExperience: 5, techType: TECH_TYPES.CLOUD_PLATFORM },
    { name: "Azure", yearsExperience: 3, techType: TECH_TYPES.CLOUD_PLATFORM },
    { name: "GCP", yearsExperience: 3, techType: TECH_TYPES.CLOUD_PLATFORM },
    { name: "Linode", yearsExperience: 8, techType: TECH_TYPES.CLOUD_PLATFORM },
  ],
  "Dev Methodologies": [
    { name: "Agile", yearsExperience: 10, techType: TECH_TYPES.DEVELOPMENT_METHODOLOGY },
    { name: "Scrum", yearsExperience: 10, techType: TECH_TYPES.DEVELOPMENT_METHODOLOGY },
    { name: "Test Driven Development", yearsExperience: 8, techType: TECH_TYPES.DEVELOPMENT_METHODOLOGY },
    { name: "Git Submodules", yearsExperience: 8, techType: TECH_TYPES.VERSION_CONTROL },
  ],
};

async function recoverTechSkills(): Promise<void> {
  try {
    console.log("Starting tech skills recovery...");

    // Verify profile exists
    const profile = await prisma.profiles.findUnique({
      where: { id: 2 },
      select: { id: true, name: true },
    });

    if (!profile) {
      console.error("Profile with ID 2 not found");
      return;
    }

    console.log(`Found profile: ${profile.name}`);

    // Get all skill categories
    const categories = await prisma.tech_skill_categories.findMany({
      where: { profile: 2 },
    });

    console.log(`Found ${categories.length} tech skill categories`);

    let totalSkillsCreated = 0;

    // For each category, create the skills
    for (const category of categories) {
      const skills = SKILLS_BY_CATEGORY[category.name];

      if (!skills) {
        console.log(
          `⚠️  No skills mapping found for category: ${category.name}`
        );
        continue;
      }

      let skillsInCategory = 0;

      for (let i = 0; i < skills.length; i++) {
        const skill = skills[i];

        const existingSkill = await prisma.tech_skills.findFirst({
          where: {
            name: skill.name,
            category: category.id,
          },
        });

        if (!existingSkill) {
          await prisma.tech_skills.create({
            data: {
              name: skill.name,
              category: category.id,
              status: "published",
              sort: i,
              years_experience: skill.yearsExperience,
              level: skill.level || "expert",
              tech_type: skill.techType,
            },
          });
          skillsInCategory++;
          totalSkillsCreated++;
        }
      }

      console.log(
        `✅ Created ${skillsInCategory} skills for category: ${category.name}`
      );
    }

    console.log(`\n✅ Successfully recovered ${totalSkillsCreated} tech skills`);
  } catch (error) {
    console.error("Error recovering tech skills:", error);
    process.exit(1);
  }
}

recoverTechSkills()
  .catch((error) => {
    console.error("Recovery failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
