#!/usr/bin/env npx tsx
import { db } from "$lib/server/db";

async function main() {
  const requiredTemplates = [
    "extract_job_links",
    "extract_jobs_from_search_page",
    "extract_job_data",
    "detect_login_page",
    "score_job_match",
  ];

  const templates = await db.ai_chat_prompts.findMany({
    where: { request: { in: requiredTemplates } },
    select: { request: true, format: true },
  });

  console.log(`✅ Found ${templates.length} templates:`);
  templates.forEach((t) => {
    const hasFormat = t.format !== null && t.format !== undefined;
    console.log(
      `   - ${t.request}: ${hasFormat ? "has format ✓" : "NO FORMAT ✗"}`,
    );
  });

  const missing = requiredTemplates.filter(
    (req) => !templates.find((t) => t.request === req),
  );

  if (missing.length > 0) {
    console.log(`\n⚠️  Missing templates: ${missing.join(", ")}`);
    process.exit(1);
  }

  const noFormat = templates.filter((t) => !t.format);
  if (noFormat.length > 0) {
    console.log(
      `\n⚠️  Templates without format: ${
        noFormat.map((t) => t.request).join(", ")
      }`,
    );
  }

  console.log("\n✨ All required templates found!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
