#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testQuery() {
  try {
    console.log("Test: Full export query...");
    const profile = await prisma.profiles.findUnique({
      where: { id: 2 },
      include: {
        profile_versions: {
          select: {
            status: true,
            sort: true,
            name: true,
            description: true,
            toggles: true,
            other_profile_versions: {
              select: {
                name: true,
              },
            },
          },
          orderBy: { sort: "asc" },
        },
        highlights: {
          select: {
            status: true,
            sort: true,
            text: true,
            fa_icon: true,
          },
          orderBy: { sort: "asc" },
        },
        tech_skill_categories: {
          select: {
            status: true,
            sort: true,
            name: true,
            fa_icon: true,
            tech_skills: {
              select: {
                status: true,
                sort: true,
                name: true,
                years_experience: true,
                level: true,
                tech_skill_types: {
                  select: {
                    slug: true,
                  },
                },
              },
              orderBy: { sort: "asc" },
            },
          },
          orderBy: { sort: "asc" },
        },
        work_experiences: {
          select: {
            name: true,
            location: true,
            description: true,
            position: true,
            summary: true,
            status: true,
            sort: true,
            start_date: true,
            end_date: true,
            website: true,
            tags: true,
            work_experience_achievements: {
              select: {
                status: true,
                sort: true,
                title: true,
                description: true,
                fa_icon: true,
                tags: true,
              },
              orderBy: { sort: "asc" },
            },
            work_experience_technologies: {
              select: {
                status: true,
                sort: true,
                name: true,
              },
              orderBy: { sort: "asc" },
            },
          },
          orderBy: { sort: "asc" },
        },
      },
    });
    console.log("✓ Query succeeded");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testQuery();
