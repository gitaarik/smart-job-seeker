/**
 * Hardened ZIP extraction for user-uploaded document archives.
 *
 * User archives are hostile input. This module defends against the classic
 * archive attacks and keeps repo junk out of the corpus, quota, and parser:
 *
 *  - zip-slip / path traversal  → entries escaping the root are skipped
 *  - zip bombs                  → cumulative + per-file uncompressed caps,
 *                                 checked BEFORE decompressing where possible;
 *                                 blowing the cumulative cap aborts the archive
 *  - symlink entries            → rejected (can point outside the sandbox)
 *  - junk (node_modules, .git,  → ignore-globs applied FIRST, before counting
 *    build output, lockfiles)     or reading, so we never even decompress them
 *  - binaries / non-source      → extension allowlist
 *  - nested archives            → not recursed in v1
 *
 * See planning/DOCUMENT-INGESTION.md § "Hardened ZIP module".
 */

import JSZip from "jszip";

export interface SafeUnzipLimits {
  /** Max archive entries to consider (files + dirs). */
  maxEntries: number;
  /** Cumulative uncompressed bytes across kept entries; exceeding aborts. */
  maxTotalUncompressed: number;
  /** Per-entry uncompressed byte cap; a larger entry is skipped, not fatal. */
  maxFileUncompressed: number;
  /** Max path-segment depth; deeper entries are skipped. */
  maxDepth: number;
  /** Allowlist of lowercased extensions (no dot) we extract text from. */
  extractExtensions: string[];
  /** Glob-ish patterns skipped before counting/reading (see DEFAULT_*). */
  ignoreGlobs: string[];
}

export type SkipReason =
  | "traversal"
  | "symlink"
  | "oversize"
  | "binary"
  | "ignored"
  | "nested-archive"
  | "too-deep";

export interface SafeUnzipEntry {
  /** Sanitized, archive-relative path; never escapes the root. */
  path: string;
  /** Lowercased extension without the dot (e.g. "ts"). */
  ext: string;
  bytes: Uint8Array;
}

export interface SafeUnzipResult {
  entries: SafeUnzipEntry[];
  skipped: { path: string; reason: SkipReason }[];
  /** True if a hard cap (entry count) stopped iteration early. */
  truncated: boolean;
}

export class SafeUnzipError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SafeUnzipError";
  }
}

/** Directories/files that dominate a repo folder and must never be ingested. */
export const DEFAULT_IGNORE_GLOBS: string[] = [
  "node_modules/",
  ".git/",
  ".svn/",
  ".hg/",
  "dist/",
  "build/",
  "out/",
  ".next/",
  ".nuxt/",
  ".svelte-kit/",
  ".venv/",
  "venv/",
  "__pycache__/",
  "target/",
  "vendor/",
  ".cache/",
  ".turbo/",
  "coverage/",
  ".idea/",
  ".vscode/",
  "*.min.js",
  "*.min.css",
  "*.map",
  "*.lock",
  "*-lock.json",
  "*.log",
];

/** Text-extractable source/doc extensions (v1). */
export const DEFAULT_EXTRACT_EXTENSIONS: string[] = [
  // source
  "ts", "tsx", "js", "jsx", "mjs", "cjs", "svelte", "vue", "py", "rb", "go",
  "rs", "java", "kt", "kts", "c", "h", "cpp", "hpp", "cc", "cs", "php", "swift",
  "scala", "clj", "ex", "exs", "erl", "hs", "lua", "pl", "r", "dart", "sh",
  "bash", "zsh", "sql", "graphql", "gql", "proto",
  // markup / config / docs
  "md", "mdx", "txt", "rst", "adoc", "json", "jsonc", "yaml", "yml", "toml",
  "ini", "cfg", "conf", "env", "xml", "html", "htm", "css", "scss", "sass",
  "less", "csv", "tsv",
];

const NESTED_ARCHIVE_EXTS = new Set([
  "zip", "tar", "gz", "tgz", "bz2", "rar", "7z", "xz", "zst",
]);

/**
 * Sanitize an archive entry name to a safe relative path, or null if it tries
 * to escape (absolute path, drive/UNC prefix, or `..` segment).
 */
export function sanitizeEntryPath(name: string): string | null {
  const norm = name.replace(/\\/g, "/");
  if (norm.startsWith("/") || /^[a-zA-Z]:/.test(norm) || norm.startsWith("//")) {
    return null;
  }
  const parts: string[] = [];
  for (const seg of norm.split("/")) {
    if (seg === "" || seg === ".") continue;
    if (seg === "..") return null;
    parts.push(seg);
  }
  return parts.length > 0 ? parts.join("/") : null;
}

/** Match a path against one glob-ish ignore pattern. */
function matchesGlob(path: string, pattern: string): boolean {
  const segments = path.split("/");
  const base = segments[segments.length - 1];
  if (pattern.endsWith("/")) {
    // Directory name anywhere in the path.
    const dir = pattern.slice(0, -1);
    return segments.slice(0, -1).includes(dir);
  }
  if (pattern.includes("*")) {
    const re = new RegExp(
      "^" +
        pattern.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") +
        "$",
    );
    return re.test(base);
  }
  return base === pattern || segments.includes(pattern);
}

function matchesAnyGlob(path: string, globs: string[]): boolean {
  return globs.some((g) => matchesGlob(path, g));
}

function extOf(path: string): string {
  const base = path.split("/").pop() ?? "";
  const dot = base.lastIndexOf(".");
  // Leading-dot files (".env") are treated as name === ext ("env").
  if (dot <= 0) return dot === 0 ? base.slice(1).toLowerCase() : "";
  return base.slice(dot + 1).toLowerCase();
}

/** JSZip stores the declared uncompressed size on the internal data object. */
function declaredUncompressedSize(file: JSZip.JSZipObject): number | null {
  const data = (file as unknown as { _data?: { uncompressedSize?: number } })
    ._data;
  return typeof data?.uncompressedSize === "number"
    ? data.uncompressedSize
    : null;
}

/** JSZip exposes unix mode bits; symlinks have file-type bits 0o120000. */
function isSymlink(file: JSZip.JSZipObject): boolean {
  const perms = (file as unknown as { unixPermissions?: number | null })
    .unixPermissions;
  return typeof perms === "number" && (perms & 0o170000) === 0o120000;
}

/**
 * Extract text-bearing source files from a ZIP under strict safety limits.
 * Throws SafeUnzipError on a malformed archive or a zip-bomb (cumulative cap).
 * Individual bad/oversize/ignored entries are skipped, not fatal.
 */
export async function safeUnzip(
  buffer: Buffer | Uint8Array,
  limits: SafeUnzipLimits,
): Promise<SafeUnzipResult> {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch (err) {
    throw new SafeUnzipError(
      `Not a readable ZIP archive: ${(err as Error).message}`,
    );
  }

  const entries: SafeUnzipEntry[] = [];
  const skipped: { path: string; reason: SkipReason }[] = [];
  let truncated = false;
  let considered = 0;
  let cumulative = 0;

  const skip = (path: string, reason: SkipReason) =>
    skipped.push({ path, reason });

  // JSZip.files preserves central-directory order; iterate deterministically.
  for (const rawName of Object.keys(zip.files)) {
    const file = zip.files[rawName];
    if (file.dir) continue;

    if (considered >= limits.maxEntries) {
      truncated = true;
      break;
    }
    considered++;

    // Symlink check uses the raw entry (perms), before path work.
    if (isSymlink(file)) {
      skip(rawName, "symlink");
      continue;
    }

    const path = sanitizeEntryPath(rawName);
    if (path === null) {
      skip(rawName, "traversal");
      continue;
    }

    // Ignore-globs FIRST: never read node_modules etc.
    if (matchesAnyGlob(path, limits.ignoreGlobs)) {
      skip(path, "ignored");
      continue;
    }

    if (path.split("/").length > limits.maxDepth) {
      skip(path, "too-deep");
      continue;
    }

    const ext = extOf(path);
    if (NESTED_ARCHIVE_EXTS.has(ext)) {
      skip(path, "nested-archive");
      continue;
    }
    if (!limits.extractExtensions.includes(ext)) {
      skip(path, "binary");
      continue;
    }

    // Pre-check the declared size to avoid decompressing an obvious bomb.
    const declared = declaredUncompressedSize(file);
    if (declared !== null && declared > limits.maxFileUncompressed) {
      skip(path, "oversize");
      continue;
    }
    if (declared !== null && cumulative + declared > limits.maxTotalUncompressed) {
      throw new SafeUnzipError(
        "Archive exceeds the maximum total uncompressed size (possible zip bomb).",
      );
    }

    const bytes = await file.async("uint8array");

    // Re-verify against the actual size in case the header lied.
    if (bytes.length > limits.maxFileUncompressed) {
      skip(path, "oversize");
      continue;
    }
    cumulative += bytes.length;
    if (cumulative > limits.maxTotalUncompressed) {
      throw new SafeUnzipError(
        "Archive exceeds the maximum total uncompressed size (possible zip bomb).",
      );
    }

    entries.push({ path, ext, bytes });
  }

  return { entries, skipped, truncated };
}
