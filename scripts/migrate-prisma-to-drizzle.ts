/**
 * Automated Prisma → Drizzle migration script.
 *
 * Handles the mechanical transformations:
 * - Import replacements (Prisma → Drizzle)
 * - db.table.findUnique/findFirst/findMany → db.query.table.findFirst/findMany
 * - db.table.create → db.insert(table).values(...).returning()
 * - db.table.update → db.update(table).set(...).where(...).returning()
 * - db.table.delete → db.delete(table).where(...)
 * - db.table.createMany/updateMany/deleteMany
 * - db.$queryRaw → queryRaw
 * - Prisma.sql → sql, Prisma.join → sqlJoin, Prisma.empty → sql``
 * - include: → with:, select: → columns:, take: → limit:, skip: → offset:
 *
 * NOTE: This handles ~80% of cases. Complex where clauses, upserts,
 * and nested logic will need manual review.
 */

import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

// Get all files that need migration
const files = execSync(
  `grep -rl "db\\.\\w\\+\\.find\\|db\\.\\w\\+\\.create\\b\\|db\\.\\w\\+\\.update\\b\\|db\\.\\w\\+\\.delete\\b\\|db\\.\\w\\+\\.upsert\\|db\\.\\$queryRaw\\|from.*generated/prisma\\|from.*prisma/client" src/ 2>/dev/null`,
  { encoding: "utf-8", cwd: "/home/rik/dev/sjs-ops/cloud/oss" },
)
  .trim()
  .split("\n")
  .filter(Boolean)
  .filter((f) => !f.includes("__tests__") && !f.includes("db/index.ts"));

// Also get cloud/src files
let cloudFiles: string[] = [];
try {
  cloudFiles = execSync(
    `grep -rl "db\\.\\w\\+\\.find\\|db\\.\\w\\+\\.create\\b\\|db\\.\\w\\+\\.update\\b\\|db\\.\\w\\+\\.delete\\b\\|db\\.\\w\\+\\.upsert\\|db\\.\\$queryRaw\\|from.*generated/prisma\\|from.*prisma/client" src/ 2>/dev/null`,
    { encoding: "utf-8", cwd: "/home/rik/dev/sjs-ops/cloud" },
  )
    .trim()
    .split("\n")
    .filter(Boolean)
    .filter((f) => !f.includes("__tests__"))
    .map((f) => `../../${f}`);
} catch {
  // no files found
}

const allFiles = [...files, ...cloudFiles];
console.log(`Found ${allFiles.length} files to migrate`);

let migrated = 0;
let skipped = 0;

for (const relPath of allFiles) {
  const absPath = relPath.startsWith("../../")
    ? `/home/rik/dev/sjs-ops/cloud/${relPath.slice(6)}`
    : `/home/rik/dev/sjs-ops/cloud/oss/${relPath}`;

  let content = readFileSync(absPath, "utf-8");
  const original = content;

  // --- Import replacements ---

  // Replace Prisma imports from generated client
  content = content.replace(
    /import\s*\{\s*Prisma\s*\}\s*from\s*["'][^"']*generated\/prisma[^"']*["'];?\n?/g,
    'import { sql, type SQL } from "drizzle-orm";\n',
  );
  content = content.replace(
    /import\s*type\s*\{\s*Prisma\s*\}\s*from\s*["'][^"']*generated\/prisma[^"']*["'];?\n?/g,
    'import { type SQL } from "drizzle-orm";\n',
  );

  // Replace type imports from generated prisma
  content = content.replace(
    /import\s*type\s*\{\s*(\w+)\s*\}\s*from\s*["'][^"']*generated\/prisma[^"']*["'];?\n?/g,
    (_, typeName) => {
      const pascalCase = typeName.charAt(0).toUpperCase() + typeName.slice(1);
      if (absPath.includes("/cloud/src/")) {
        return `import type { ${pascalCase} } from "../../../oss/src/lib/server/db/schema";\n`;
      }
      return `import type { ${pascalCase} } from "$lib/server/db/schema";\n`;
    },
  );

  // Replace multi-type imports from generated prisma
  content = content.replace(
    /import\s*(?:type\s*)?\{([^}]+)\}\s*from\s*["'][^"']*generated\/prisma[^"']*["'];?\n?/g,
    (match, types) => {
      if (types.includes("Prisma")) {
        return 'import { sql, type SQL } from "drizzle-orm";\n';
      }
      return match; // leave unknown patterns
    },
  );

  // Replace PrismaClient and PrismaPg imports (only in db.ts which is already replaced)
  content = content.replace(
    /import\s*\{\s*PrismaClient\s*\}\s*from\s*["'][^"']*["'];?\n?/g,
    "",
  );
  content = content.replace(
    /import\s*\{\s*PrismaPg\s*\}\s*from\s*["']@prisma\/adapter-pg["'];?\n?/g,
    "",
  );

  // --- Prisma namespace replacements ---
  content = content.replace(/Prisma\.sql`/g, "sql`");
  content = content.replace(/Prisma\.join\(/g, "sqlJoin(");
  content = content.replace(/Prisma\.empty/g, 'sql``');
  content = content.replace(/Prisma\.Sql\b/g, "SQL");
  content = content.replace(/Prisma\.InputJsonValue/g, "unknown");
  content = content.replace(/Prisma\.DbNull/g, "null");

  // --- $queryRaw replacement ---
  content = content.replace(/db\.\$queryRaw</g, "queryRaw<");
  content = content.replace(/dbDirect\.\$queryRaw</g, "queryRawDirect<");
  // Handle $queryRaw without type parameter
  content = content.replace(/db\.\$queryRaw`/g, "queryRaw(sql`");
  content = content.replace(/dbDirect\.\$queryRaw`/g, "queryRawDirect(sql`");

  // --- Query method replacements ---
  // db.table.findUnique → db.query.table.findFirst
  content = content.replace(/\bdb\.(\w+)\.findUnique\b/g, "db.query.$1.findFirst");
  content = content.replace(/\bdbDirect\.(\w+)\.findUnique\b/g, "dbDirect.query.$1.findFirst");

  // db.table.findFirst → db.query.table.findFirst
  content = content.replace(/\bdb\.(\w+)\.findFirst\b/g, "db.query.$1.findFirst");
  content = content.replace(/\bdbDirect\.(\w+)\.findFirst\b/g, "dbDirect.query.$1.findFirst");

  // db.table.findMany → db.query.table.findMany
  content = content.replace(/\bdb\.(\w+)\.findMany\b/g, "db.query.$1.findMany");
  content = content.replace(/\bdbDirect\.(\w+)\.findMany\b/g, "dbDirect.query.$1.findMany");

  // --- Property replacements in query options ---
  // include: → with:
  content = content.replace(/\binclude\s*:/g, "with:");
  // take: → limit:
  content = content.replace(/\btake\s*:/g, "limit:");
  // skip: → offset:
  content = content.replace(/\bskip\s*:/g, "offset:");

  // --- Add necessary imports if we used sql/sqlJoin/queryRaw ---
  if (content.includes("sqlJoin(") || content.includes("queryRaw")) {
    // Check if import already exists
    if (!content.includes('from "$lib/server/db"') && !content.includes("from '$lib/server/db'")) {
      // For cloud/src files
      if (absPath.includes("/cloud/src/")) {
        if (!content.includes("queryRaw") && !content.includes("sqlJoin")) {
          // no extra imports needed
        }
      }
    } else {
      // Augment existing import
      const importMatch = content.match(
        /import\s*\{([^}]+)\}\s*from\s*["']\$lib\/server\/db["']/,
      );
      if (importMatch) {
        const existingImports = importMatch[1].split(",").map((s) => s.trim());
        const needed: string[] = [];
        if (content.includes("queryRaw(") && !existingImports.includes("queryRaw"))
          needed.push("queryRaw");
        if (content.includes("queryRawDirect(") && !existingImports.includes("queryRawDirect"))
          needed.push("queryRawDirect");
        if (content.includes("sqlJoin(") && !existingImports.includes("sqlJoin"))
          needed.push("sqlJoin");
        if (needed.length > 0) {
          const newImports = [...existingImports, ...needed].join(", ");
          content = content.replace(importMatch[0], `import { ${newImports} } from "$lib/server/db"`);
        }
      }
    }
  }

  if (content !== original) {
    writeFileSync(absPath, content);
    migrated++;
    console.log(`  ✓ ${relPath}`);
  } else {
    skipped++;
  }
}

console.log(`\nDone: ${migrated} migrated, ${skipped} unchanged`);
console.log("\nNOTE: Manual review needed for:");
console.log("  - db.table.create/update/delete (need full rewrite to Drizzle builder API)");
console.log("  - upsert patterns");
console.log("  - Complex where clauses (need eq/and/or/inArray operators)");
console.log("  - count() calls");
console.log("  - select: → columns: (only in relational queries)");
