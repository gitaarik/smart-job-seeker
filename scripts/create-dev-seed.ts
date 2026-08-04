#!/usr/bin/env node
/**
 * Creates a dev seed SQL file with essential tables and dev users.
 *
 * 1. Seeds dev users via Better Auth (creates accounts, links to profiles)
 * 2. Copies an allow-list of tables into a scratch database and scopes the rows
 *    to the dev profiles, letting foreign keys cascade the rest away
 * 3. Dumps that, data only
 *
 * Run inside the app container: npx vite-node scripts/create-dev-seed.ts
 */

import { auth } from "$lib/server/auth/better-auth";
import { dbDirect as db } from "$lib/server/db";
import { eq } from "drizzle-orm";
import { profiles, users } from "$lib/server/db/schema";
import { execFileSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath, URL } from "url";
import { writeFileSync, statSync, mkdirSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "..", "db-dumps");
const OUTPUT_FILE = join(OUTPUT_DIR, "dev-seed.sql");

// Parse DATABASE_URL for pg_dump connection
const dbUrl = new URL(
  process.env.SJS_DATABASE_URL ||
    process.env.DATABASE_URL ||
    "postgres://postgres:postgres@database:5432/smartjobseeker",
);
const DB_HOST = dbUrl.hostname;
const DB_PORT = dbUrl.port || "5432";
const DB_USER = dbUrl.username || "postgres";
const DB_PASSWORD = dbUrl.password || "postgres";
const DB_NAME = dbUrl.pathname.slice(1) || "smartjobseeker";

const pgEnv = { ...process.env, PGPASSWORD: DB_PASSWORD };

// ============================================================================
// Dev Users
// ============================================================================

const DEV_USERS = [
  {
    email: "rik@rikwanders.tech",
    password: "waterpijp",
    name: "Rik Wanders",
    profileId: 1,
  },
  {
    email: "alex.morgan@example.com",
    password: "testpassword123",
    name: "Alex Morgan",
    profileId: 12,
  },
];

async function seedDevUsers() {
  console.log("[1/3] Seeding dev users...");

  for (const user of DEV_USERS) {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.id, user.profileId),
    });

    if (!profile) {
      console.error(
        `  Profile ${user.profileId} not found, skipping ${user.email}`,
      );
      continue;
    }

    const existing = await db.query.users.findFirst({
      where: eq(users.email, user.email),
    });

    let userId: string;

    if (existing) {
      console.log(`  User already exists: ${user.email}`);
      userId = existing.id;
    } else {
      const ctx = await auth.api.signUpEmail({
        body: {
          email: user.email,
          password: user.password,
          name: user.name,
        },
      });

      if (!ctx.user) {
        console.error(`  Failed to create user: ${user.email}`);
        continue;
      }

      userId = ctx.user.id;
      console.log(`  Created user: ${user.email} (${userId})`);
    }

    await db.update(profiles).set({ user_id: userId })
      .where(eq(profiles.id, user.profileId));
    console.log(`  Linked to profile ${user.profileId} (${profile.name})`);
  }
}

// ============================================================================
// Database Dump
// ============================================================================

/**
 * What a dev seed contains, stated rather than inferred.
 *
 * This used to be an exclusion list, and it never excluded anything — the
 * committed seed carries `CREATE TABLE public.jobs`, `sessions` and `api_keys`
 * despite all three being named in it. It looked curated because in February
 * 2026 the database was small: two profiles, two users, 2,115 rows. It was
 * early, not scoped. By August the same list would have dumped 93,135 rows,
 * including 1,401 live session tokens and ten users' password hashes — six of
 * them real people.
 *
 * So the shape is inverted. A table appears here because a developer needs its
 * contents to work on the app, and rows are scoped to the dev profiles below.
 * Anything not listed is absent by default, which is the only arrangement where
 * a table added next month cannot quietly end up in a committed file.
 */
const SEED_TABLES = {
  /** Reference data: the same for every install, not anyone's. */
  reference: ["job_platforms", "ai_chat_templates", "tech_skill_types"],
  /** The dev logins. Scoped to DEV_USERS — their passwords are in this file. */
  auth: ["users", "accounts"],
  /** Profile data, scoped to the dev profiles. */
  profile: [
    "profiles",
    "profile_versions",
    "profile_version_extensions",
    "collected_data",
    "work_experiences",
    "work_experience_achievements",
    "work_experience_technologies",
    "work_experience_projects",
    "work_experience_project_technologies",
    "tech_skill_categories",
    "tech_skills",
    "side_projects",
    "side_project_achievements",
    "side_project_technologies",
    "education",
    "languages",
    "highlights",
    "os_contributions",
    "project_stories",
    "cheat_sheets",
    "salary_expectations",
    "platform_profiles",
  ],
} as const;

/**
 * Deliberately absent, and why — so the next person does not "fix" it.
 *
 * `sessions`, `verifications`, `api_keys` — live credentials.
 * `jobs`, `job_matches`, `job_match_history`, `job_resources`, `job_importers`,
 *   `search_task*`, `scraper_logs` — scraped volume, 70k+ rows, and nothing a
 *   fresh install needs.
 * `applications`, `application_*` — a dev's own work, not a starting point.
 * `ai_chats`, `ai_prompts`, `ai_generations` — LLM logs.
 * `skill_embeddings`, `content_embeddings` — regenerated on demand, huge.
 * `config`, `profile_exports`, `profile_tokens`, `credit_transactions`,
 *   `files` — per-environment.
 */
const ALL_SEED_TABLES = [
  ...SEED_TABLES.reference,
  ...SEED_TABLES.auth,
  ...SEED_TABLES.profile,
];

/** A scratch database, so scoping happens on a copy and never on dev. */
const BUILD_DB = "sjs_seed_build";

function psqlOn(database: string, args: string[], input?: string): string {
  return execFileSync(
    "psql",
    ["-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", database, ...args],
    { env: pgEnv, input, maxBuffer: 200 * 1024 * 1024 },
  ).toString();
}

/**
 * Copy the listed tables into a scratch database, then delete everything that
 * is not a dev profile or a dev user and let the foreign keys take the rest.
 *
 * Scoping by cascade rather than by a WHERE clause per table: the child tables
 * hang off profiles through several levels (work_experience_project_technologies
 * is three deep) and hand-written filters would drift the first time someone
 * added a table. The database already knows what belongs to a profile.
 */
function buildScopedCopy() {
  console.log("\n[2/3] Building a scoped copy...");

  psqlOn("postgres", ["-q", "-c", `DROP DATABASE IF EXISTS ${BUILD_DB}`]);
  psqlOn("postgres", ["-q", "-c", `CREATE DATABASE ${BUILD_DB}`]);

  // Same schema the migrations produce, so the dump below fits a fresh install.
  execFileSync("npx", ["tsx", "scripts/migrate-deploy.ts"], {
    env: {
      ...pgEnv,
      SJS_DATABASE_URL:
        `postgres://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${BUILD_DB}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  for (const table of ALL_SEED_TABLES) {
    // Columns named explicitly on both sides. A bare COPY is POSITIONAL, and
    // the two databases do not agree on position: dev's columns sit in the
    // order `push` added them over eight months, a migrations-built table's in
    // schema.ts declaration order. Copying positionally puts `failure_count`
    // where `name` should be and fails on the first NOT NULL — or worse,
    // succeeds with the values shifted.
    const columns = psqlOn(BUILD_DB, ["-t", "-A", "-c",
      `SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = '${table}'`]).trim();

    const rows = psqlOn(DB_NAME, [
      "-q",
      "-c",
      `\\copy ${table} (${columns}) TO STDOUT`,
    ]);
    // Triggers off for the load: the tables arrive in list order, not in
    // dependency order, so a child can land before its parent.
    // Two -c flags, not one statement: psql refuses to parse SQL and a
    // backslash meta-command in the same -c. They share the session, so the
    // SET still applies to the copy.
    psqlOn(BUILD_DB, [
      "-q",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      "SET session_replication_role = 'replica'",
      "-c",
      `\\copy ${table} (${columns}) FROM STDIN`,
    ], rows);
  }

  const emails = DEV_USERS.map((u) => `'${u.email}'`).join(",");
  const profileIds = DEV_USERS.map((u) => u.profileId).join(",");

  // Triggers back ON first — cascades are triggers, and with them disabled the
  // deletes below would remove the parents and orphan every child.
  psqlOn(BUILD_DB, ["-q", "-v", "ON_ERROR_STOP=1", "-c",
    `SET session_replication_role = 'origin';
     DELETE FROM profiles WHERE id NOT IN (${profileIds});
     DELETE FROM users WHERE email NOT IN (${emails});`]);

  const kept = psqlOn(BUILD_DB, ["-t", "-A", "-c",
    `SELECT (SELECT count(*) FROM profiles) || ' profile(s), ' ||
            (SELECT count(*) FROM users) || ' user(s)'`]).trim();
  console.log(`  ${kept}`);
}

function createDump() {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Header
  let sql = `--
-- Dev Seed Data
-- Generated by create-dev-seed.ts
--
-- DATA ONLY. The schema is built by the migrations before this is loaded —
-- see scripts/start-app.sh. A seed that carried its own schema would freeze
-- whatever shape the database had on the day it was taken, and the migrations
-- could never run over it, which is how dev ended up unable to migrate at all.
--
-- Contents are an allow-list, not what happened to be in someone's database.
-- See SEED_TABLES in scripts/create-dev-seed.ts.
--

-- Disable FK constraint triggers during restore
SET session_replication_role = 'replica';

`;

  console.log("\n[3/3] Exporting...");
  // --data-only keeps the schema the migrations' job; the sequence setvals it
  // carries are why the first insert after a reset does not collide.
  sql += execFileSync("pg_dump", [
    "-h", DB_HOST, "-p", DB_PORT, "-U", DB_USER, "-d", BUILD_DB,
    "--data-only", "--no-owner", "--no-acl", "--disable-triggers",
    ...ALL_SEED_TABLES.map((t) => `--table=${t}`),
  ], { env: pgEnv, maxBuffer: 200 * 1024 * 1024 }).toString();

  // Footer
  sql += `
-- Re-enable FK constraint triggers
SET session_replication_role = 'origin';
`;

  writeFileSync(OUTPUT_FILE, sql);
  const size = (statSync(OUTPUT_FILE).size / 1024).toFixed(0);
  console.log(`\n  Dev seed created: db-dumps/dev-seed.sql (${size}K)`);
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  await seedDevUsers();
  buildScopedCopy();
  createDump();
  psqlOn("postgres", ["-q", "-c", `DROP DATABASE IF EXISTS ${BUILD_DB}`]);

  console.log("\nDev users:");
  for (const user of DEV_USERS) {
    console.log(`  ${user.email} / ${user.password}`);
  }
}

main()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Failed:", error);
    process.exit(1);
  });
