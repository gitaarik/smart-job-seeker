#!/usr/bin/env npx tsx
/**
 * Backfill the job-skill vocabulary and report threshold-tuning data.
 *
 * SJS_EMBEDDING_SKILL_THRESHOLD has never been validated against real data
 * (see planning/SEMANTIC-MATCHING-AND-RAG.md). This script answers:
 *   1. How big is the real vocabulary? (memory + cosine-scan cost)
 *   2. At a given threshold, how much does a profile's skill set expand?
 *      Explosive expansion makes the eligibility gate match everything, which
 *      is worse than no semantic matching at all.
 *   3. Do the nearest neighbours actually make sense?
 *
 * Run WITHOUT enabling embeddings globally:
 *   npx dotenvx run -f ../.env -- env SJS_EMBEDDING_ENABLED=true \
 *     npx tsx scripts/tune-skill-embeddings.ts [--backfill] [--limit N]
 *
 * Default is read-only reporting over whatever vocabulary already exists.
 * Pass --backfill to embed + persist distinct job skills first.
 */
import { sql } from "drizzle-orm";
import { dbDirect as db } from "$lib/server/db";
import { skill_embeddings } from "$lib/server/db/schema";
import { config } from "$lib/server/config";
import {
  cosineSimilarity,
  isEmbeddingConfigured,
  truncateVector,
} from "$lib/server/llm/embeddings";
import { backfillSkillVocabulary } from "$lib/server/job/skill-embeddings";

const args = process.argv.slice(2);
const doBackfill = args.includes("--backfill");
const doExportFixture = args.includes("--export-fixture");
const limitArg = args.indexOf("--limit");
const limit = limitArg >= 0 ? parseInt(args[limitArg + 1], 10) : undefined;

/**
 * Skills the fixture must contain, to pin the cases the threshold turns on.
 * Everything else in the fixture is a random sample, for the noise baseline.
 */
const FIXTURE_ANCHORS = [
  // Abbreviation / spelling variants that SHOULD match.
  "React",
  "Reactjs",
  "React Native",
  "JS",
  "javascript",
  "Vanilla JS",
  "k8s",
  "Kubernetes",
  "KUBERNETES",
  "Kubernetes (K8s)",
  "EKS",
  "Python",
  "PostgreSQL",
  "Postgres",
  "TypeScript",
  "Typescript/React",
  // Concepts that SHOULD NOT match each other.
  "communication",
  "Renewable energy generation facility design (solar, wind, battery storage)",
  "CRM knowledge",
  "Blockchain Tokenization",
  "consultant",
  "Service Catalog",
];
const FIXTURE_RANDOM_SAMPLE = 180;

/** Probe skills: expected-related and expected-unrelated pairs from the plan doc. */
const PROBES = [
  "React",
  "k8s",
  "JS",
  "Python",
  "PostgreSQL",
  "communication",
];

/** Thresholds to sweep. 0.55 is the current untuned default. */
const THRESHOLDS = [0.4, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9];

async function distinctJobSkills(): Promise<string[]> {
  const result = await db.execute(sql`
    WITH all_skills AS (
      SELECT jsonb_array_elements_text(skills_required::jsonb) AS s
        FROM jobs WHERE jsonb_typeof(skills_required::jsonb) = 'array'
      UNION ALL
      SELECT jsonb_array_elements_text(skills_preferred::jsonb)
        FROM jobs WHERE jsonb_typeof(skills_preferred::jsonb) = 'array'
    )
    SELECT DISTINCT trim(s) AS skill
    FROM all_skills
    WHERE length(trim(s)) > 0
    ${limit ? sql`LIMIT ${limit}` : sql``}
  `);
  // node-postgres returns a Result object, not an array (cf. queryRaw in db/index.ts).
  const rows = (result as unknown as { rows: { skill: string }[] }).rows;
  return rows.map((r) => r.skill);
}

async function main() {
  console.log(`embeddings configured: ${isEmbeddingConfigured()}`);
  console.log(
    `provider=${config.embeddingProvider} model=${config.embeddingModel} dims=${config.embeddingDimensions}`,
  );
  console.log(
    `current SJS_EMBEDDING_SKILL_THRESHOLD default: ${config.embeddingSkillThreshold}\n`,
  );

  if (!isEmbeddingConfigured()) {
    console.error(
      "Embeddings not configured. Re-run with SJS_EMBEDDING_ENABLED=true and a provider key.",
    );
    process.exit(1);
  }

  if (doBackfill) {
    const skills = await distinctJobSkills();
    console.log(`backfilling ${skills.length} distinct job skills...`);
    const t0 = Date.now();
    // Small chunks + a pause: the gemini free tier rate-limits, and a throttled
    // batch used to come back as empty vectors rather than an error. Already-
    // embedded skills are skipped, so re-running resumes where this left off.
    const CHUNK = 100;
    const PAUSE_MS = 1200;
    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    let added = 0;
    let failedChunks = 0;
    let failedSkills = 0;
    for (let i = 0; i < skills.length; i += CHUNK) {
      const batch = skills.slice(i, i + CHUNK);
      try {
        added += await backfillSkillVocabulary(batch);
      } catch (err) {
        failedChunks++;
        failedSkills += batch.length;
        const msg = err instanceof Error
          ? err.message.split("\n")[0]
          : String(err);
        console.log(`  !! chunk at ${i} failed: ${msg.slice(0, 100)}`);
        await sleep(5000); // back off before continuing
        continue;
      }
      if ((i / CHUNK) % 10 === 0) {
        console.log(
          `  ${
            Math.min(i + CHUNK, skills.length)
          }/${skills.length} (embedded: ${added})`,
        );
      }
      await sleep(PAUSE_MS);
    }
    console.log(`backfill done in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    console.log(`  newly embedded: ${added}`);
    if (failedChunks > 0) {
      console.log(
        `  !! ${failedChunks} chunks failed (${failedSkills} skills) — re-run to retry them`,
      );
    }
    console.log();
  }

  // Load the persisted vocabulary directly (not via the module cache).
  // Truncate to the working dim so the sweep + exported fixture reflect what
  // the runtime actually compares (the runtime truncates on load too).
  const rows = await db.select().from(skill_embeddings);
  const workingDims = config.embeddingWorkingDimensions;
  const vocab = rows
    .filter((r) => r.model === config.embeddingModel)
    .map((r) => ({
      label: r.label,
      vector: truncateVector(r.embedding as number[], workingDims),
    }));

  console.log(`=== vocabulary ===`);
  console.log(`rows for model ${config.embeddingModel}: ${vocab.length}`);
  if (vocab.length === 0) {
    console.log("Empty vocabulary — run with --backfill first.");
    process.exit(0);
  }
  const dims = vocab[0].vector.length;
  const memMB = (vocab.length * dims * 8) / 1024 / 1024;
  console.log(`dims: ${dims}`);
  console.log(`in-memory vector size: ~${memMB.toFixed(1)} MB per process`);
  console.log(
    `cosine ops per expansion (30-skill profile): ${
      (30 * vocab.length * dims / 1e6).toFixed(0)
    }M multiply-adds\n`,
  );

  // --- Expansion factor: THE decisive number. ---
  // For each threshold, how many vocab terms does a single skill pull in?
  // If a skill pulls in hundreds, the eligibility gate degenerates to "match all".
  console.log(
    `=== expansion factor per probe skill (how many vocab terms it pulls in) ===`,
  );
  const header = [
    "skill".padEnd(16),
    ...THRESHOLDS.map((t) => t.toFixed(2).padStart(6)),
  ].join("");
  console.log(header);
  console.log("-".repeat(header.length));

  for (const probe of PROBES) {
    const match = vocab.find((v) =>
      v.label.toLowerCase() === probe.toLowerCase()
    );
    if (!match) {
      console.log(`${probe.padEnd(16)}(not in vocabulary)`);
      continue;
    }
    const sims = vocab.map((v) => cosineSimilarity(match.vector, v.vector));
    const counts = THRESHOLDS.map((t) => sims.filter((s) => s >= t).length);
    console.log(
      [probe.padEnd(16), ...counts.map((c) => String(c).padStart(6))].join(""),
    );
  }

  // --- Nearest neighbours: does it make semantic sense? ---
  console.log(`\n=== top-10 nearest neighbours per probe ===`);
  for (const probe of PROBES) {
    const match = vocab.find((v) =>
      v.label.toLowerCase() === probe.toLowerCase()
    );
    if (!match) continue;
    const ranked = vocab
      .map((v) => ({
        label: v.label,
        sim: cosineSimilarity(match.vector, v.vector),
      }))
      .filter((r) => r.label.toLowerCase() !== probe.toLowerCase())
      .sort((a, b) => b.sim - a.sim)
      .slice(0, 10);
    console.log(`\n${probe}:`);
    for (const r of ranked) console.log(`  ${r.sim.toFixed(3)}  ${r.label}`);
  }

  // --- Baseline: what does cosine look like between RANDOM pairs? ---
  // If unrelated skills already sit at ~0.5, a 0.55 threshold is noise.
  console.log(`\n=== random-pair similarity baseline (unrelated skills) ===`);
  const sample: number[] = [];
  for (let i = 0; i < 2000; i++) {
    const a = vocab[Math.floor(Math.random() * vocab.length)];
    const b = vocab[Math.floor(Math.random() * vocab.length)];
    if (a !== b) sample.push(cosineSimilarity(a.vector, b.vector));
  }
  sample.sort((x, y) => x - y);
  const pct = (p: number) => sample[Math.floor(sample.length * p)].toFixed(3);
  console.log(
    `n=${sample.length}  p50=${pct(0.5)}  p90=${pct(0.9)}  p99=${
      pct(0.99)
    }  max=${sample[sample.length - 1].toFixed(3)}`,
  );
  console.log(
    `\nIf p99 of UNRELATED pairs >= the threshold, the threshold is noise.`,
  );

  if (doExportFixture) {
    // Real vectors, small sample. The mocked unit-test fixture used 3-dim
    // hand-picked vectors where unrelated skills sat at ~0.11 cosine; real
    // ones sit at ~0.54. That gap is why the mocked suite stayed green while
    // the shipped threshold was inside the noise floor.
    const byLabel = new Map(vocab.map((v) => [v.label.toLowerCase(), v]));
    const picked = new Map<string, { label: string; vector: number[] }>();

    const missingAnchors: string[] = [];
    for (const a of FIXTURE_ANCHORS) {
      const hit = byLabel.get(a.toLowerCase());
      if (hit) picked.set(hit.label, hit);
      else missingAnchors.push(a);
    }
    // Deterministic random sample: stride the vocabulary rather than RNG, so
    // regenerating the fixture doesn't churn the diff.
    const stride = Math.max(
      1,
      Math.floor(vocab.length / FIXTURE_RANDOM_SAMPLE),
    );
    for (
      let i = 0;
      i < vocab.length &&
      picked.size < FIXTURE_ANCHORS.length + FIXTURE_RANDOM_SAMPLE;
      i += stride
    ) {
      picked.set(vocab[i].label, vocab[i]);
    }

    // Store the pairwise SIMILARITY MATRIX, not the vectors. The mocked unit
    // tests already cover the plumbing (expandProfileSkills -> cosine ->
    // threshold) and that plumbing is correct. What they cannot see is whether
    // the threshold is a sane number for real data, and that only needs the
    // similarities. Matrix is ~300KB; the raw vectors were 5.6MB and would be
    // regenerated on every model change — this repo's history was rewritten
    // once already to purge large blobs.
    const entries = [...picked.values()];
    const labels = entries.map((e) => e.label);
    const sims = entries.map((a) =>
      entries.map((b) =>
        Number(cosineSimilarity(a.vector, b.vector).toFixed(4))
      )
    );

    const fixture = {
      _comment:
        "Generated by scripts/tune-skill-embeddings.ts --export-fixture. Real pairwise cosine similarities from a live provider, so tests measure reality rather than hand-picked vectors. Regenerate when the embedding model changes.",
      model: config.embeddingModel,
      dimensions: dims,
      generated_from_vocab_size: vocab.length,
      anchors: FIXTURE_ANCHORS.filter((a) =>
        labels.some((l) => l.toLowerCase() === a.toLowerCase())
      ),
      labels,
      sims,
    };

    const { mkdirSync, writeFileSync } = await import("node:fs");
    const { dirname } = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const filePath = fileURLToPath(
      new URL(
        "../src/lib/server/job/__tests__/fixtures/skill-similarities.json",
        import.meta.url,
      ),
    );
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(fixture));

    const sizeKB = (JSON.stringify(fixture).length / 1024).toFixed(0);
    console.log(`\n=== fixture exported ===`);
    console.log(`${filePath}`);
    console.log(`skills: ${labels.length}  dims: ${dims}  size: ~${sizeKB} KB`);
    if (missingAnchors.length > 0) {
      console.log(
        `!! anchors missing from vocabulary (not in job data): ${
          missingAnchors.join(", ")
        }`,
      );
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
