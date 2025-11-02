#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testQuery() {
  try {
    // Test with profile_versions with toggles and nested
    console.log("Test: With profile_versions including toggles...");
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
      },
    });
    console.log("✓ With toggles and nested succeeded");
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testQuery();
