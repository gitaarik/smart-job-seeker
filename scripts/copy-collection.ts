import { execSync } from "child_process";
import { getEnv } from "../src/lib/tools/get-env";

const sourceCollection = process.argv[2];
const targetCollection = process.argv[3];

// Validate arguments
if (!sourceCollection || !targetCollection) {
  console.error(
    "Usage: npx tsx scripts/copy-collection.ts <sourceCollection> <targetCollection>"
  );
  process.exit(1);
}

if (sourceCollection === targetCollection) {
  console.error(
    "Error: Source and target collection names cannot be the same"
  );
  process.exit(1);
}

async function main() {
  try {
    // Use localhost since we're running from the host machine, not inside Docker
    const dbHost = "localhost";
    const dbPort = getEnv("DB_PORT") || "5432";
    const dbDatabase = getEnv("DB_DATABASE") || "smartjobseeker";
    const dbUser = getEnv("DB_USER") || "postgres";
    const dbPassword = getEnv("DB_PASSWORD") || "postgres";

    console.log(
      `Copying collection "${sourceCollection}" to "${targetCollection}"...`
    );

    // Get the table structure and data from the source collection
    const getTableStructureSQL = `
      SELECT
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_name = '${sourceCollection}'
      AND table_schema = 'public'
      ORDER BY ordinal_position;
    `;

    console.log(`Fetching table structure for ${sourceCollection}...`);

    const structureOutput = execSync(
      `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbDatabase} -t -c "${getTableStructureSQL}"`,
      { encoding: "utf-8" }
    );

    if (!structureOutput.trim()) {
      throw new Error(
        `Collection "${sourceCollection}" not found in the database`
      );
    }

    // Parse the structure output
    const columns = structureOutput
      .trim()
      .split("\n")
      .filter((line) => line.trim())
      .map((line) => {
        const parts = line.split("|").map((p) => p.trim());
        return {
          name: parts[0],
          type: parts[1],
          nullable: parts[2] === "YES",
          default: parts[3],
        };
      });

    console.log(`Found ${columns.length} columns in ${sourceCollection}`);

    // Build CREATE TABLE statement
    const columnDefs = columns.map((col) => {
      let def = `${col.name} ${col.type}`;
      if (col.default) {
        def += ` DEFAULT ${col.default}`;
      }
      if (!col.nullable && col.name !== "id") {
        def += " NOT NULL";
      }
      return def;
    });

    // Get the primary key
    const pkSQL = `
      SELECT constraint_name, column_name
      FROM information_schema.key_column_usage
      WHERE table_name = '${sourceCollection}'
      AND constraint_name LIKE '%pkey%'
      AND table_schema = 'public';
    `;

    const pkOutput = execSync(
      `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbDatabase} -t -c "${pkSQL}"`,
      { encoding: "utf-8" }
    );

    const pkLine = pkOutput.trim().split("\n")[0];
    const pkColumn = pkLine ? pkLine.split("|")[1].trim() : null;

    if (pkColumn) {
      columnDefs.push(`PRIMARY KEY (${pkColumn})`);
    }

    // Get the foreign keys
    const fkSQL = `
      SELECT
        constraint_name,
        column_name,
        referenced_table_name,
        referenced_column_name
      FROM information_schema.referential_constraints rc
      JOIN information_schema.key_column_usage kcu
        ON rc.constraint_name = kcu.constraint_name
        AND rc.table_name = kcu.table_name
        AND rc.table_schema = kcu.table_schema
      WHERE rc.table_name = '${sourceCollection}'
      AND rc.table_schema = 'public';
    `;

    const fkOutput = execSync(
      `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbDatabase} -c "
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name as referenced_table,
          ccu.column_name as referenced_column,
          rc.delete_rule
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
        JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
        JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name = '${sourceCollection}' AND tc.table_schema = 'public'
      " -t`,
      { encoding: "utf-8" }
    );

    const foreignKeys: Array<{
      column: string;
      refTable: string;
      refColumn: string;
      deleteRule: string;
    }> = [];

    if (fkOutput.trim()) {
      fkOutput
        .trim()
        .split("\n")
        .forEach((line) => {
          const parts = line.split("|").map((p) => p.trim());
          if (parts.length >= 5) {
            foreignKeys.push({
              column: parts[1],
              refTable: parts[2],
              refColumn: parts[3],
              deleteRule: parts[4],
            });
          }
        });
    }

    // Add foreign key constraints
    foreignKeys.forEach((fk) => {
      const onDelete = fk.deleteRule === "CASCADE" ? "ON DELETE CASCADE" : "ON DELETE SET NULL";
      columnDefs.push(
        `FOREIGN KEY (${fk.column}) REFERENCES ${fk.refTable}(${fk.refColumn}) ${onDelete}`
      );
    });

    // Create the new table
    const createTableSQL = `CREATE TABLE IF NOT EXISTS ${targetCollection} (\n  ${columnDefs.join(",\n  ")}\n);`;

    console.log(`Creating table ${targetCollection}...`);

    execSync(
      `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbDatabase} -c "${createTableSQL.replace(/"/g, '\\"')}"`,
      { encoding: "utf-8" }
    );

    // Copy the data
    const columnNames = columns.map((c) => c.name).join(", ");
    const copyDataSQL = `INSERT INTO ${targetCollection} (${columnNames}) SELECT ${columnNames} FROM ${sourceCollection};`;

    console.log(`Copying data from ${sourceCollection} to ${targetCollection}...`);

    const copyResult = execSync(
      `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbDatabase} -c "${copyDataSQL}"`,
      { encoding: "utf-8" }
    );

    const rowCount = copyResult.match(/INSERT 0 (\d+)/)?.[1] || "0";
    console.log(`Copied ${rowCount} rows`);

    // Get collection metadata from source collection
    const metadataSQL = `
      SELECT
        icon, note, display_template, hidden, singleton, translations,
        archive_field, archive_app_filter, archive_value, unarchive_value,
        sort_field, accountability, color, item_duplication_fields, sort,
        "group", collapse, preview_url, versioning
      FROM directus_collections
      WHERE collection = '${sourceCollection}';
    `.replace(/"/g, '\\"');

    console.log(`Fetching metadata from ${sourceCollection}...`);

    const metadataOutput = execSync(
      `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbDatabase} -c "${metadataSQL}" -t`,
      { encoding: "utf-8" }
    );

    if (metadataOutput.trim()) {
      const parts = metadataOutput.trim().split("|");

      // Helper function to convert psql booleans
      const toBool = (val: string) => {
        const trimmed = val.trim();
        return trimmed === "t" ? "true" : trimmed === "f" ? "false" : trimmed;
      };

      const insertMetadataSQL = `
        INSERT INTO directus_collections (
          collection, icon, note, display_template, hidden, singleton, translations,
          archive_field, archive_app_filter, archive_value, unarchive_value,
          sort_field, accountability, color, item_duplication_fields, sort,
          "group", collapse, preview_url, versioning
        ) VALUES (
          '${targetCollection}',
          ${parts[0].trim() === "" ? "null" : `'${parts[0].trim()}'`},
          ${parts[1].trim() === "" ? "null" : `'${parts[1].trim().replace(/'/g, "''")}'`},
          ${parts[2].trim() === "" ? "null" : `'${parts[2].trim()}'`},
          ${toBool(parts[3])},
          ${toBool(parts[4])},
          ${parts[5].trim() === "" ? "null" : `'${parts[5].trim()}'`},
          ${parts[6].trim() === "" ? "null" : `'${parts[6].trim()}'`},
          ${toBool(parts[7])},
          ${parts[8].trim() === "" ? "null" : `'${parts[8].trim()}'`},
          ${parts[9].trim() === "" ? "null" : `'${parts[9].trim()}'`},
          ${parts[10].trim() === "" ? "null" : `'${parts[10].trim()}'`},
          ${parts[11].trim() === "" ? "null" : `'${parts[11].trim()}'`},
          ${parts[12].trim() === "" ? "null" : `'${parts[12].trim()}'`},
          ${parts[13].trim() === "" ? "null" : `'${parts[13].trim()}'`},
          ${parts[14].trim() === "" ? "null" : `'${parts[14].trim()}'`},
          ${parts[15].trim() === "" ? "null" : `'${parts[15].trim()}'`},
          ${parts[16].trim() === "" ? "null" : `'${parts[16].trim()}'`},
          ${parts[17].trim() === "" ? "null" : `'${parts[17].trim()}'`},
          ${toBool(parts[18])}
        ) ON CONFLICT (collection) DO NOTHING;
      `;

      execSync(
        `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbDatabase} -c "${insertMetadataSQL.replace(/"/g, '\\"')}"`,
        { encoding: "utf-8" }
      );

      console.log(`Added collection metadata for ${targetCollection}`);
    }

    // Copy field metadata
    console.log(`Copying field metadata...`);

    const copyFieldsSQL = `
      INSERT INTO directus_fields (
        collection, field, special, interface, options, display, display_options,
        readonly, hidden, sort, width, translations, note, conditions, required,
        "group", validation, validation_message, searchable
      )
      SELECT
        '${targetCollection}' as collection,
        field, special, interface, options, display, display_options,
        readonly, hidden, sort, width, translations, note, conditions, required,
        "group", validation, validation_message, searchable
      FROM directus_fields
      WHERE collection = '${sourceCollection}'
      ORDER BY sort;
    `;

    execSync(
      `PGPASSWORD="${dbPassword}" psql -h ${dbHost} -p ${dbPort} -U ${dbUser} -d ${dbDatabase} -c "${copyFieldsSQL.replace(/"/g, '\\"')}"`,
      { encoding: "utf-8" }
    );

    console.log(
      `\n✓ Successfully copied collection "${sourceCollection}" to "${targetCollection}"`
    );
  } catch (error) {
    console.error("Error copying collection:", error);
    process.exit(1);
  }
}

main();
