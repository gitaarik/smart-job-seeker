import { PrismaClient } from '@prisma/client';
import { resume } from '../src/lib/data/resume.js';

const prisma = new PrismaClient();

async function migrateWorkData() {
  console.log('Starting work experience data migration...');

  try {
    // First, clear existing work experience data
    console.log('Clearing existing work experience data...');
    await prisma.workHighlightTag.deleteMany();
    await prisma.workHighlight.deleteMany();
    await prisma.workTechnology.deleteMany();
    await prisma.workProject.deleteMany();
    await prisma.workExperience.deleteMany();

    // Migrate work experiences
    for (let i = 0; i < resume.work.length; i++) {
      const work = resume.work[i];
      console.log(`Migrating work experience: ${work.name}`);

      const workExperience = await prisma.workExperience.create({
        data: {
          name: work.name,
          location: work.location,
          description: work.description,
          position: work.position,
          url: work.url,
          startDate: work.startDate,
          endDate: work.endDate,
          summary: work.summary,
          logo: work.logo,
          sortOrder: i,
          isActive: true,
        },
      });

      // Migrate highlights
      if (work.highlights) {
        for (let j = 0; j < work.highlights.length; j++) {
          const highlight = work.highlights[j];
          
          const createdHighlight = await prisma.workHighlight.create({
            data: {
              workExperienceId: workExperience.id,
              title: highlight.title,
              description: highlight.description,
              iconName: highlight.icon?.iconName || null, // Extract icon name from FontAwesome icon
              sortOrder: j,
            },
          });

          // Migrate highlight tags
          if (highlight.tags) {
            for (const tag of highlight.tags) {
              await prisma.workHighlightTag.create({
                data: {
                  highlightId: createdHighlight.id,
                  tagName: tag,
                },
              });
            }
          }
        }
      }

      // Migrate technologies
      if (work.technologies) {
        for (let k = 0; k < work.technologies.length; k++) {
          const technology = work.technologies[k];
          await prisma.workTechnology.create({
            data: {
              workExperienceId: workExperience.id,
              technologyName: technology,
              sortOrder: k,
            },
          });
        }
      }

      // Migrate projects
      if (work.projects) {
        for (let l = 0; l < work.projects.length; l++) {
          const project = work.projects[l];
          await prisma.workProject.create({
            data: {
              workExperienceId: workExperience.id,
              name: project.name,
              startDate: project.startDate,
              endDate: project.endDate,
              summary: project.summary,
              description: project.description,
              outcome: project.outcome,
              sortOrder: l,
            },
          });
        }
      }

      console.log(`Completed migration for ${work.name}`);
    }

    console.log('Work experience data migration completed successfully!');
    
    // Log summary
    const counts = await Promise.all([
      prisma.workExperience.count(),
      prisma.workHighlight.count(),
      prisma.workTechnology.count(),
      prisma.workProject.count(),
      prisma.workHighlightTag.count(),
    ]);

    console.log(`Migration summary:
    - Work experiences: ${counts[0]}
    - Highlights: ${counts[1]}
    - Technologies: ${counts[2]}
    - Projects: ${counts[3]}
    - Highlight tags: ${counts[4]}`);

  } catch (error) {
    console.error('Error during migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateWorkData().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});