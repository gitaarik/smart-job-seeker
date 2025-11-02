#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testQuery() {
  try {
    // Test 1: Simple query
    console.log("Test 1: Simple query...");
    const profile1 = await prisma.profiles.findUnique({
      where: { id: 2 },
    });
    console.log("✓ Simple query succeeded");

    // Test 2: With relations
    console.log("Test 2: With one relation...");
    const profile2 = await prisma.profiles.findUnique({
      where: { id: 2 },
      include: {
        highlights: true,
      },
    });
    console.log("✓ With highlights succeeded");

    // Test 3: With nested relations
    console.log("Test 3: With nested relations...");
    const profile3 = await prisma.profiles.findUnique({
      where: { id: 2 },
      include: {
        tech_skill_categories: {
          include: {
            tech_skills: true,
          },
        },
      },
    });
    console.log("✓ With nested relations succeeded");

    console.log("All tests passed!");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testQuery();
