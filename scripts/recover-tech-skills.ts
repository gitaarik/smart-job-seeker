#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Map skills to categories based on context from work experiences
const SKILLS_BY_CATEGORY: Record<string, { name: string; yearsExperience?: number; level?: string }[]> = {
  Backend: [
    { name: "Python", yearsExperience: 10 },
    { name: "Django", yearsExperience: 10 },
    { name: "Django REST Framework", yearsExperience: 10 },
    { name: "Django Channels", yearsExperience: 8 },
    { name: "Django Silk", yearsExperience: 7 },
    { name: "Jinja2", yearsExperience: 10 },
    { name: "Weasyprint", yearsExperience: 5 },
    { name: "Node.js", yearsExperience: 8 },
    { name: "Express", yearsExperience: 7 },
    { name: "Flask", yearsExperience: 5 },
    { name: "PHP", yearsExperience: 10 },
    { name: "Laravel", yearsExperience: 3 },
  ],
  Frontend: [
    { name: "React", yearsExperience: 8 },
    { name: "MobX", yearsExperience: 7 },
    { name: "Lit", yearsExperience: 4 },
    { name: "Web Components", yearsExperience: 4 },
    { name: "Vue.js", yearsExperience: 6 },
    { name: "JavaScript", yearsExperience: 12 },
    { name: "TypeScript", yearsExperience: 5 },
    { name: "Svelte", yearsExperience: 2 },
    { name: "jQuery", yearsExperience: 8 },
    { name: "Bootstrap", yearsExperience: 8 },
    { name: "Tailwind CSS", yearsExperience: 3 },
    { name: "HTML5", yearsExperience: 12 },
    { name: "CSS3", yearsExperience: 12 },
    { name: "AJAX", yearsExperience: 10 },
    { name: "Responsive design", yearsExperience: 10 },
    { name: "Webpack", yearsExperience: 6 },
    { name: "Sveltekit", yearsExperience: 1 },
  ],
  Databases: [
    { name: "MySQL", yearsExperience: 10 },
    { name: "PostgreSQL", yearsExperience: 8 },
    { name: "MongoDB", yearsExperience: 6 },
    { name: "Redis", yearsExperience: 8 },
    { name: "Elasticsearch", yearsExperience: 5 },
  ],
  "Development Tools": [
    { name: "Git", yearsExperience: 12 },
    { name: "GitHub", yearsExperience: 10 },
    { name: "GitLab", yearsExperience: 5 },
    { name: "Bitbucket", yearsExperience: 5 },
    { name: "Docker", yearsExperience: 7 },
    { name: "Docker Compose", yearsExperience: 7 },
    { name: "Selenium", yearsExperience: 7 },
    { name: "Postman", yearsExperience: 6 },
  ],
  DevOps: [
    { name: "Ansible", yearsExperience: 7 },
    { name: "Nginx", yearsExperience: 8 },
    { name: "Apache", yearsExperience: 8 },
    { name: "HAProxy", yearsExperience: 5 },
    { name: "Kubernetes", yearsExperience: 4 },
    { name: "AWS EC2", yearsExperience: 8 },
    { name: "AWS S3", yearsExperience: 8 },
    { name: "Linode", yearsExperience: 8 },
    { name: "Linux", yearsExperience: 10 },
    { name: "CI/CD", yearsExperience: 8 },
    { name: "Jenkins", yearsExperience: 5 },
  ],
  "Cloud Platforms": [
    { name: "Amazon Web Services (AWS)", yearsExperience: 8 },
    { name: "AWS EC2", yearsExperience: 8 },
    { name: "AWS S3", yearsExperience: 8 },
    { name: "AWS Lambda", yearsExperience: 5 },
    { name: "AWS EKS", yearsExperience: 3 },
    { name: "DigitalOcean", yearsExperience: 5 },
    { name: "Azure", yearsExperience: 3 },
    { name: "GCP", yearsExperience: 3 },
    { name: "Linode", yearsExperience: 8 },
  ],
  "Dev Methodologies": [
    { name: "Agile", yearsExperience: 10 },
    { name: "Scrum", yearsExperience: 10 },
    { name: "Test Driven Development", yearsExperience: 8 },
    { name: "Git Submodules", yearsExperience: 8 },
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
              status: "draft",
              sort: i,
              years_experience: skill.yearsExperience,
              level: skill.level,
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
