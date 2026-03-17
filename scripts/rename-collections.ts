/**
 * Migration script: Rename Directus collections
 *
 * 1. job_searches → search_tasks (+ junction table)
 * 2. job_match_preferences → match_config (Directus metadata is stale — DB already renamed to job_match_config)
 *
 * For Directus-managed collections, we use the Directus API to create new collections
 * (so metadata is properly registered), copy data via SQL, then delete old collections.
 *
 * For non-Directus tables (job_search_runs, job_search_run_items), we use ALTER TABLE RENAME.
 *
 * Usage: docker compose exec app npx tsx scripts/rename-collections.ts
 */

import {
  directusRequest,
  clearDirectusCache,
} from "../src/lib/server/directus";
import { dbDirect } from "../src/lib/server/db";

// ─── Helpers ────────────────────────────────────────────────────────────────

function log(msg: string) {
  console.log(`  ${msg}`);
}

function header(msg: string) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${msg}`);
  console.log(`${"═".repeat(60)}`);
}

async function tableExists(name: string): Promise<boolean> {
  const result = await dbDirect.$queryRawUnsafe<{ exists: boolean }[]>(
    `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1)`,
    name,
  );
  return result[0]?.exists ?? false;
}

async function rowCount(table: string): Promise<number> {
  const result = await dbDirect.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*) FROM "${table}"`,
  );
  return Number(result[0]?.count ?? 0);
}

async function directusCollectionExists(name: string): Promise<boolean> {
  try {
    await directusRequest("GET", `/collections/${name}`);
    return true;
  } catch {
    return false;
  }
}

// ─── Part 1: Rename job_searches → search_tasks ─────────────────────────────

async function renameJobSearches() {
  header("Part 1: Rename job_searches → search_tasks");

  // Check if already done
  if (await directusCollectionExists("search_tasks")) {
    log("⏭️  search_tasks collection already exists in Directus — skipping creation");

    // Check if old one is already gone
    if (!(await directusCollectionExists("job_searches"))) {
      log("⏭️  job_searches already deleted from Directus — skipping Part 1");
      return;
    }
  } else {
    // Step 1: Read existing metadata
    log("📖 Reading job_searches collection metadata...");
    const collectionMeta = (await directusRequest(
      "GET",
      "/collections/job_searches",
    )) as { data: Record<string, unknown> };
    const fieldsMeta = (await directusRequest(
      "GET",
      "/fields/job_searches",
    )) as { data: Array<Record<string, unknown>> };

    log(`   Found ${fieldsMeta.data.length} fields`);

    // Step 2: Create search_tasks collection via Directus API
    log("🔨 Creating search_tasks collection...");

    // Build field definitions for the new collection.
    // We need to include the primary key field in the collection creation.
    const fields = fieldsMeta.data.map((f: Record<string, unknown>) => {
      const field: Record<string, unknown> = {
        field: f.field,
        type: f.type,
        meta: {
          ...(f.meta as Record<string, unknown> || {}),
          collection: "search_tasks",
          id: undefined, // Let Directus assign new IDs
        },
        schema: f.schema || null,
      };
      return field;
    });

    await directusRequest("POST", "/collections", {
      collection: "search_tasks",
      meta: {
        collection: "search_tasks",
        icon: "search",
        note: "User-configured search tasks",
        hidden: false,
        singleton: false,
        accountability: "all",
        collapse: "open",
        group: "job_discovery",
        sort: 1,
      },
      schema: {
        name: "search_tasks",
      },
      fields,
    });

    log("✅ search_tasks collection created");

    // Step 2b: Add columns that Directus doesn't know about
    // (added via Prisma migrations, not through Directus)
    const directusFields = new Set(fieldsMeta.data.map((f: Record<string, unknown>) => f.field));
    const missingColumns = [
      { name: "last_run_jobs_found", sql: "INTEGER" },
      { name: "live_url", sql: "VARCHAR(500)" },
      { name: "is_active", sql: "BOOLEAN DEFAULT true" },
      { name: "status_message", sql: "VARCHAR(255)" },
      { name: "platform_profile_id", sql: "INTEGER" },
      { name: "max_jobs", sql: "INTEGER" },
      { name: "browser_provider", sql: "VARCHAR(20)" },
      { name: "search_term", sql: "VARCHAR(500)" },
      { name: "skip_existing", sql: "BOOLEAN DEFAULT false" },
      { name: "skip_first", sql: "INTEGER" },
      { name: "stop_after_duplicates", sql: "INTEGER" },
      { name: "keep_minimized", sql: "BOOLEAN DEFAULT true" },
      { name: "ui_preferences", sql: "JSONB DEFAULT '{}'" },
    ];

    for (const col of missingColumns) {
      if (!directusFields.has(col.name)) {
        try {
          await dbDirect.$executeRawUnsafe(
            `ALTER TABLE search_tasks ADD COLUMN IF NOT EXISTS "${col.name}" ${col.sql}`,
          );
        } catch (e) {
          // Column might already exist if table was partially migrated
          log(`   ⚠️  Column ${col.name} may already exist: ${e}`);
        }
      }
    }
    log("✅ Added non-Directus columns to search_tasks");

    // Step 2c: Create relations
    log("🔗 Creating relations for search_tasks...");

    // profile → profiles
    await directusRequest("POST", "/relations", {
      collection: "search_tasks",
      field: "profile",
      related_collection: "profiles",
      meta: { one_deselect_action: "nullify" },
      schema: {
        on_delete: "CASCADE",
      },
    });

    // platform → job_platforms
    await directusRequest("POST", "/relations", {
      collection: "search_tasks",
      field: "platform",
      related_collection: "job_platforms",
      meta: { one_deselect_action: "nullify" },
      schema: {
        on_delete: "SET NULL",
      },
    });

    log("✅ Relations created");

    // Step 2d: Add FK for platform_profile_id (non-Directus)
    try {
      await dbDirect.$executeRawUnsafe(`
        ALTER TABLE search_tasks
        ADD CONSTRAINT search_tasks_platform_profile_id_fkey
        FOREIGN KEY (platform_profile_id) REFERENCES platform_profiles(id) ON UPDATE NO ACTION
      `);
    } catch {
      log("   ⚠️  platform_profile_id FK may already exist");
    }

    // Add index
    await dbDirect.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_search_tasks_platform_profile ON search_tasks(platform_profile_id)
    `);
    log("✅ Added platform_profile_id FK and index");
  }

  // Step 3: Create search_tasks_job_sites junction table
  if (await directusCollectionExists("search_tasks_job_sites")) {
    log("⏭️  search_tasks_job_sites already exists — skipping");
  } else {
    log("🔨 Creating search_tasks_job_sites junction collection...");
    await directusRequest("POST", "/collections", {
      collection: "search_tasks_job_sites",
      meta: {
        collection: "search_tasks_job_sites",
        icon: "import_export",
        note: "Junction table for search tasks and job sites",
        hidden: true,
        singleton: false,
        accountability: "all",
        collapse: "open",
        sort: 8,
      },
      schema: {
        name: "search_tasks_job_sites",
      },
      fields: [
        {
          field: "id",
          type: "integer",
          meta: { hidden: true, readonly: true },
          schema: { is_primary_key: true, has_auto_increment: true },
        },
        {
          field: "search_tasks_id",
          type: "integer",
          meta: { hidden: true },
          schema: { is_nullable: true },
        },
      ],
    });

    // Add junction relation
    await directusRequest("POST", "/relations", {
      collection: "search_tasks_job_sites",
      field: "search_tasks_id",
      related_collection: "search_tasks",
      meta: {
        junction_field: "job_sites_id",
        one_deselect_action: "nullify",
      },
      schema: {
        on_delete: "CASCADE",
      },
    });

    log("✅ search_tasks_job_sites junction created with relation");
  }

  // Step 4: Copy data
  log("📋 Copying data from job_searches → search_tasks...");

  const oldCount = await rowCount("job_searches");
  const existingNewCount = await rowCount("search_tasks");

  if (existingNewCount > 0 && existingNewCount === oldCount) {
    log(`⏭️  search_tasks already has ${existingNewCount} rows (matches old table) — skipping copy`);
  } else if (existingNewCount === 0) {
    await dbDirect.$executeRawUnsafe(`
      INSERT INTO search_tasks (
        id, status, date_created, date_updated, name, profile, last_run,
        search_url, platform, navigation_type, stripped_html, last_run_jobs_found,
        live_url, is_active, status_message, platform_profile_id, max_jobs,
        search_term, browser_provider, skip_existing, skip_first,
        stop_after_duplicates, keep_minimized, ui_preferences
      )
      SELECT
        id, status, date_created, date_updated, name, profile, last_run,
        search_url, platform, navigation_type, stripped_html, last_run_jobs_found,
        live_url, is_active, status_message, platform_profile_id, max_jobs,
        search_term, browser_provider, skip_existing, skip_first,
        stop_after_duplicates, keep_minimized, ui_preferences
      FROM job_searches
    `);

    // Reset sequence
    await dbDirect.$executeRawUnsafe(`
      SELECT setval(pg_get_serial_sequence('search_tasks', 'id'),
        (SELECT COALESCE(MAX(id), 1) FROM search_tasks))
    `);

    const newCount = await rowCount("search_tasks");
    log(`✅ Copied ${newCount} rows (expected ${oldCount})`);

    if (newCount !== oldCount) {
      throw new Error(`Row count mismatch! Expected ${oldCount}, got ${newCount}`);
    }
  } else {
    throw new Error(
      `search_tasks has ${existingNewCount} rows but job_searches has ${oldCount} — manual investigation needed`,
    );
  }

  // Copy junction table data
  log("📋 Copying junction table data...");

  const oldJunctionCount = await rowCount("job_searches_job_sites");
  const existingJunctionCount = await rowCount("search_tasks_job_sites");

  if (existingJunctionCount > 0 && existingJunctionCount === oldJunctionCount) {
    log(`⏭️  search_tasks_job_sites already has ${existingJunctionCount} rows — skipping`);
  } else if (existingJunctionCount === 0) {
    await dbDirect.$executeRawUnsafe(`
      INSERT INTO search_tasks_job_sites (id, search_tasks_id)
      SELECT id, job_searches_id FROM job_searches_job_sites
    `);
    await dbDirect.$executeRawUnsafe(`
      SELECT setval(pg_get_serial_sequence('search_tasks_job_sites', 'id'),
        COALESCE((SELECT MAX(id) FROM search_tasks_job_sites), 1))
    `);

    const newJCount = await rowCount("search_tasks_job_sites");
    log(`✅ Copied ${newJCount} junction rows (expected ${oldJunctionCount})`);
  } else {
    log(`⚠️  search_tasks_job_sites has ${existingJunctionCount} rows, old has ${oldJunctionCount}`);
  }

  // Step 5: Rename non-Directus tables (job_search_runs, job_search_run_items)
  log("🔄 Renaming non-Directus tables...");

  if (await tableExists("job_search_runs")) {
    // First update the FK to point to search_tasks instead of job_searches
    try {
      await dbDirect.$executeRawUnsafe(`
        ALTER TABLE job_search_runs
        DROP CONSTRAINT IF EXISTS job_search_runs_job_search_id_fkey
      `);
    } catch { /* may not exist */ }

    // Rename table
    await dbDirect.$executeRawUnsafe(`ALTER TABLE job_search_runs RENAME TO search_task_runs`);
    log("✅ job_search_runs → search_task_runs");

    // Rename column
    await dbDirect.$executeRawUnsafe(
      `ALTER TABLE search_task_runs RENAME COLUMN job_search_id TO search_task_id`,
    );
    log("✅ Renamed column job_search_id → search_task_id");

    // Create new FK pointing to search_tasks
    await dbDirect.$executeRawUnsafe(`
      ALTER TABLE search_task_runs
      ADD CONSTRAINT search_task_runs_search_task_id_fkey
      FOREIGN KEY (search_task_id) REFERENCES search_tasks(id) ON DELETE CASCADE
    `);
    log("✅ FK search_task_runs → search_tasks created");

    // Rename indexes
    try {
      // The composite index name is auto-generated by Prisma
      await dbDirect.$executeRawUnsafe(`
        ALTER INDEX IF EXISTS "job_search_runs_job_search_id_started_at_idx"
        RENAME TO "search_task_runs_search_task_id_started_at_idx"
      `);
    } catch {
      log("   ⚠️  Could not rename job_search_runs composite index (may have different name)");
    }
  } else if (await tableExists("search_task_runs")) {
    log("⏭️  search_task_runs already exists — skipping rename");
  } else {
    throw new Error("Neither job_search_runs nor search_task_runs exists!");
  }

  if (await tableExists("job_search_run_items")) {
    // Update FK to point to search_task_runs
    try {
      await dbDirect.$executeRawUnsafe(`
        ALTER TABLE job_search_run_items
        DROP CONSTRAINT IF EXISTS job_search_run_items_run_id_fkey
      `);
    } catch { /* may not exist */ }

    await dbDirect.$executeRawUnsafe(
      `ALTER TABLE job_search_run_items RENAME TO search_task_run_items`,
    );
    log("✅ job_search_run_items → search_task_run_items");

    // Re-create FK
    await dbDirect.$executeRawUnsafe(`
      ALTER TABLE search_task_run_items
      ADD CONSTRAINT search_task_run_items_run_id_fkey
      FOREIGN KEY (run_id) REFERENCES search_task_runs(id) ON DELETE CASCADE
    `);

    // Rename indexes
    try {
      await dbDirect.$executeRawUnsafe(`
        ALTER INDEX IF EXISTS "idx_job_search_run_items_run_id"
        RENAME TO "idx_search_task_run_items_run_id"
      `);
      await dbDirect.$executeRawUnsafe(`
        ALTER INDEX IF EXISTS "idx_job_search_run_items_run_status"
        RENAME TO "idx_search_task_run_items_run_status"
      `);
    } catch {
      log("   ⚠️  Could not rename some run_items indexes");
    }

    log("✅ Renamed indexes");
  } else if (await tableExists("search_task_run_items")) {
    log("⏭️  search_task_run_items already exists — skipping rename");
  }

  // Update scraper_logs FK (points to old table name)
  log("🔗 Updating scraper_logs FK...");
  try {
    await dbDirect.$executeRawUnsafe(`
      ALTER TABLE scraper_logs
      DROP CONSTRAINT IF EXISTS scraper_logs_run_id_fkey
    `);
    await dbDirect.$executeRawUnsafe(`
      ALTER TABLE scraper_logs
      ADD CONSTRAINT scraper_logs_run_id_fkey
      FOREIGN KEY (run_id) REFERENCES search_task_runs(id) ON DELETE CASCADE
    `);
    log("✅ scraper_logs FK updated to reference search_task_runs");
  } catch (e) {
    log(`   ⚠️  scraper_logs FK update: ${e}`);
  }

  // Step 6: Verify
  log("🔍 Verifying...");
  const finalCount = await rowCount("search_tasks");
  const origCount = await rowCount("job_searches");
  log(`   search_tasks: ${finalCount} rows, job_searches: ${origCount} rows`);

  if (finalCount !== origCount) {
    throw new Error("Row count mismatch — aborting, not deleting old tables");
  }

  // Check FK integrity on search_task_runs
  const orphanedRuns = await dbDirect.$queryRawUnsafe<{ count: bigint }[]>(`
    SELECT count(*) FROM search_task_runs r
    WHERE NOT EXISTS (SELECT 1 FROM search_tasks t WHERE t.id = r.search_task_id)
  `);
  if (Number(orphanedRuns[0]?.count) > 0) {
    throw new Error(`Found ${orphanedRuns[0]?.count} orphaned search_task_runs!`);
  }
  log("✅ FK integrity verified");

  // Step 7: Delete old Directus collections
  log("🗑️  Deleting old Directus collections...");

  // Junction first (has FK to job_searches)
  if (await directusCollectionExists("job_searches_job_sites")) {
    await directusRequest("DELETE", "/collections/job_searches_job_sites");
    log("✅ Deleted job_searches_job_sites from Directus");
  }

  if (await directusCollectionExists("job_searches")) {
    await directusRequest("DELETE", "/collections/job_searches");
    log("✅ Deleted job_searches from Directus");
  }

  log("✅ Part 1 complete: job_searches → search_tasks");
}

// ─── Part 2: Fix job_match_preferences → match_config ───────────────────────

async function renameMatchConfig() {
  header("Part 2: Rename job_match_preferences → match_config");

  // The DB table is already job_match_config (renamed via Prisma migration)
  // but Directus metadata still references job_match_preferences.
  // We need to: create match_config in Directus, copy data, delete old Directus collection,
  // then rename the actual DB table.

  if (await directusCollectionExists("match_config")) {
    log("⏭️  match_config already exists in Directus — skipping creation");

    if (!(await directusCollectionExists("job_match_preferences"))) {
      log("⏭️  job_match_preferences already removed — checking DB table rename");

      // Check if DB table also needs renaming
      if (await tableExists("job_match_config")) {
        log("🔄 Renaming DB table job_match_config → match_config...");
        await dbDirect.$executeRawUnsafe(`ALTER TABLE job_match_config RENAME TO match_config`);

        // Rename sequence
        try {
          await dbDirect.$executeRawUnsafe(`
            ALTER SEQUENCE job_match_config_id_seq RENAME TO match_config_id_seq
          `);
        } catch { /* sequence name may differ */ }

        // Rename constraint
        try {
          await dbDirect.$executeRawUnsafe(`
            ALTER TABLE match_config RENAME CONSTRAINT job_match_config_pkey TO match_config_pkey
          `);
        } catch { /* may already be renamed */ }

        log("✅ DB table renamed");
      } else if (await tableExists("match_config")) {
        log("⏭️  match_config table already exists in DB — done");
      }
      return;
    }
  } else {
    // The Directus API returns 403 when trying to read fields for job_match_preferences
    // because the underlying DB table was already renamed to job_match_config.
    // So we define the fields manually based on the actual DB columns.

    // Step 1: First rename the DB table so it matches what we'll create in Directus
    log("🔄 Renaming DB table job_match_config → match_config first...");

    if (await tableExists("job_match_config")) {
      // Drop old FK constraint before rename
      try {
        await dbDirect.$executeRawUnsafe(`
          ALTER TABLE job_match_config
          DROP CONSTRAINT IF EXISTS job_match_config_profile_fkey
        `);
      } catch { /* may not exist with this exact name */ }

      await dbDirect.$executeRawUnsafe(`ALTER TABLE job_match_config RENAME TO match_config`);
      log("✅ DB table renamed to match_config");

      // Rename sequence
      try {
        await dbDirect.$executeRawUnsafe(`
          ALTER SEQUENCE job_match_config_id_seq RENAME TO match_config_id_seq
        `);
      } catch {
        log("   ⚠️  Could not rename sequence (may have different name)");
      }

      // Rename primary key constraint
      try {
        await dbDirect.$executeRawUnsafe(`
          ALTER TABLE match_config RENAME CONSTRAINT job_match_config_pkey TO match_config_pkey
        `);
      } catch { /* may already be renamed */ }
    }

    // Step 2: Register match_config in Directus metadata via SQL
    // We can't use POST /collections because the DB table already exists
    // (we just renamed it), and Directus would try to CREATE TABLE again.
    // Instead we insert directly into Directus metadata tables.
    log("🔨 Registering match_config in Directus metadata...");

    // Insert collection
    await dbDirect.$executeRawUnsafe(`
      INSERT INTO directus_collections (collection, icon, note, hidden, singleton, accountability, collapse, "group", sort)
      VALUES ('match_config', 'settings_suggest', 'Job matching configuration per profile', false, false, 'all', 'open', 'job_matches', 2)
      ON CONFLICT (collection) DO NOTHING
    `);

    // Insert fields
    const fieldDefs = [
      { field: "id", special: null, iface: "numeric", options: null, display: null, display_options: null, readonly: true, hidden: true, sort: 1, width: "full", note: null, required: false },
      { field: "date_created", special: "date-created", iface: "datetime", options: null, display: "datetime", display_options: '{"relative":true}', readonly: true, hidden: true, sort: 2, width: "half", note: null, required: false },
      { field: "date_updated", special: "date-updated", iface: "datetime", options: null, display: "datetime", display_options: '{"relative":true}', readonly: true, hidden: true, sort: 3, width: "half", note: null, required: false },
      { field: "profile", special: "m2o", iface: "select-dropdown-m2o", options: '{"template":"{{name}}"}', display: "related-values", display_options: '{"template":"{{name}}"}', readonly: false, hidden: false, sort: 4, width: "half", note: "Profile this config belongs to", required: true },
      { field: "name", special: null, iface: "input", options: null, display: null, display_options: null, readonly: false, hidden: false, sort: 5, width: "full", note: null, required: false },
      { field: "job_types", special: null, iface: "select-multiple-checkbox", options: '{"choices":[{"text":"Full-time","value":"full-time"},{"text":"Part-time","value":"part-time"},{"text":"Contract","value":"contract"},{"text":"Freelance","value":"freelance"},{"text":"Internship","value":"internship"}]}', display: null, display_options: null, readonly: false, hidden: false, sort: 6, width: "half", note: "Types of employment you're interested in", required: false },
      { field: "experience_levels", special: null, iface: "select-multiple-checkbox", options: '{"choices":[{"text":"Intern","value":"intern"},{"text":"Junior","value":"junior"},{"text":"Mid-level","value":"mid-level"},{"text":"Senior","value":"senior"},{"text":"Lead","value":"lead"},{"text":"Principal","value":"principal"},{"text":"Staff","value":"staff"}]}', display: null, display_options: null, readonly: false, hidden: false, sort: 7, width: "half", note: "Experience levels you're qualified for", required: false },
      { field: "work_location", special: null, iface: "select-multiple-checkbox", options: '{"choices":[{"text":"On-site","value":"on-site"},{"text":"Hybrid","value":"hybrid"},{"text":"Remote","value":"remote"}]}', display: null, display_options: null, readonly: false, hidden: false, sort: 8, width: "half", note: "Work location preferences", required: false },
      { field: "locations", special: null, iface: "tags", options: null, display: null, display_options: null, readonly: false, hidden: false, sort: 9, width: "half", note: "Preferred job locations (e.g., Amsterdam, Berlin, Remote)", required: false },
    ];

    for (const f of fieldDefs) {
      await dbDirect.$executeRawUnsafe(
        `INSERT INTO directus_fields (collection, field, special, interface, options, display, display_options, readonly, hidden, sort, width, note, required)
         VALUES ($1, $2, $3, $4, $5::json, $6, $7::json, $8, $9, $10, $11, $12, $13)
         ON CONFLICT DO NOTHING`,
        "match_config", f.field, f.special, f.iface, f.options, f.display, f.display_options, f.readonly, f.hidden, f.sort, f.width, f.note, f.required,
      );
    }

    // Insert relation
    await dbDirect.$executeRawUnsafe(`
      INSERT INTO directus_relations (many_collection, many_field, one_collection, one_deselect_action)
      VALUES ('match_config', 'profile', 'profiles', 'nullify')
    `);

    // Re-create the FK constraint on the renamed table
    try {
      await dbDirect.$executeRawUnsafe(`
        ALTER TABLE match_config
        ADD CONSTRAINT match_config_profile_foreign
        FOREIGN KEY (profile) REFERENCES profiles(id) ON DELETE CASCADE
      `);
    } catch {
      log("   ⚠️  profile FK may already exist");
    }

    log("✅ match_config registered in Directus metadata");
  }

  // Data is already in the match_config table (it was renamed from job_match_config above
  // or in a previous run). No data copy needed — it's the same table, just renamed.
  log("📋 Data already in match_config (table was renamed, no copy needed)");

  // Verify
  log("🔍 Verifying...");
  const matchCount = await rowCount("match_config");
  log(`   match_config: ${matchCount} rows`);

  // Delete old Directus metadata
  // Note: We can't use DELETE /collections/job_match_preferences because the underlying
  // table was already renamed, so the API would fail. Clean up directly via SQL.
  log("🗑️  Cleaning up old Directus metadata...");

  await dbDirect.$executeRawUnsafe(`DELETE FROM directus_relations WHERE many_collection = 'job_match_preferences'`);
  await dbDirect.$executeRawUnsafe(`DELETE FROM directus_fields WHERE collection = 'job_match_preferences'`);
  await dbDirect.$executeRawUnsafe(`DELETE FROM directus_collections WHERE collection = 'job_match_preferences'`);
  // Clean up any presets
  await dbDirect.$executeRawUnsafe(`DELETE FROM directus_presets WHERE collection = 'job_match_preferences'`);

  log("✅ Removed job_match_preferences from Directus metadata");

  log("✅ Part 2 complete: job_match_preferences/job_match_config → match_config");
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 Collection rename migration");
  console.log("   job_searches → search_tasks");
  console.log("   job_match_preferences → match_config");
  console.log("");

  try {
    await renameJobSearches();
    await renameMatchConfig();

    header("Clearing Directus cache");
    await clearDirectusCache();

    header("Migration complete!");
    log("Next steps:");
    log("  1. Run: docker compose exec app npx prisma db pull");
    log("  2. Run: docker compose exec app npx prisma generate");
    log("  3. Update all code references (see plan)");
    log("  4. Regenerate DB dumps");
  } catch (error) {
    console.error("\n❌ Migration failed:", error);
    console.error("\nThe migration is idempotent — fix the issue and re-run.");
    process.exit(1);
  } finally {
    await dbDirect.$disconnect();
  }
}

main();
