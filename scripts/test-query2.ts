#!/usr/bin/env node

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function testQuery() {
  try {
    // Test with profile_versions
    console.log("Test: With profile_versions...");
    const profile = await prisma.profiles.findUnique({
      where: { id: 2 },
      include: {
        profile_versions: {
          select: {
            status: true,
            sort: true,
            name: true,
          },
        },
      },
    });
    console.log("✓ With profile_versions succeeded");
    console.log(JSON.stringify(profile, null, 2));
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await prisma.$disconnect();
  }
}

testQuery();
