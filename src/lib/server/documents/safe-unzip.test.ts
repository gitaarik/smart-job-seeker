import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import {
  DEFAULT_EXTRACT_EXTENSIONS,
  DEFAULT_IGNORE_GLOBS,
  safeUnzip,
  SafeUnzipError,
  type SafeUnzipLimits,
  sanitizeEntryPath,
} from "./safe-unzip";

const baseLimits = (overrides: Partial<SafeUnzipLimits> = {}): SafeUnzipLimits => ({
  maxEntries: 5000,
  maxTotalUncompressed: 500 * 1024 * 1024,
  maxFileUncompressed: 25 * 1024 * 1024,
  maxDepth: 32,
  extractExtensions: DEFAULT_EXTRACT_EXTENSIONS,
  ignoreGlobs: DEFAULT_IGNORE_GLOBS,
  ...overrides,
});

/** Build a zip buffer from a map of path → content (DOS platform). */
async function makeZip(files: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip();
  for (const [name, content] of Object.entries(files)) {
    zip.file(name, content);
  }
  return zip.generateAsync({ type: "nodebuffer" });
}

function crc32(buf: Uint8Array): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return (~c) >>> 0;
}

/**
 * Hand-craft a single-file (stored) ZIP with an ARBITRARY entry name — JSZip
 * refuses to emit traversal names, so we build the bytes ourselves to mimic an
 * archive produced by a malicious tool.
 */
function makeRawZip(name: string, content: string): Buffer {
  const enc = new TextEncoder();
  const nameBytes = enc.encode(name);
  const data = enc.encode(content);
  const crc = crc32(data);
  const nlen = nameBytes.length;
  const dlen = data.length;

  const local = new Uint8Array(30 + nlen + dlen);
  const lv = new DataView(local.buffer);
  lv.setUint32(0, 0x04034b50, true);
  lv.setUint16(4, 20, true);
  lv.setUint32(14, crc, true);
  lv.setUint32(18, dlen, true);
  lv.setUint32(22, dlen, true);
  lv.setUint16(26, nlen, true);
  local.set(nameBytes, 30);
  local.set(data, 30 + nlen);

  const central = new Uint8Array(46 + nlen);
  const cv = new DataView(central.buffer);
  cv.setUint32(0, 0x02014b50, true);
  cv.setUint16(4, 20, true);
  cv.setUint16(6, 20, true);
  cv.setUint32(16, crc, true);
  cv.setUint32(20, dlen, true);
  cv.setUint32(24, dlen, true);
  cv.setUint16(28, nlen, true);
  central.set(nameBytes, 46);

  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, 1, true);
  ev.setUint16(10, 1, true);
  ev.setUint32(12, central.length, true);
  ev.setUint32(16, local.length, true);

  return Buffer.concat([local, central, eocd]);
}

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes);

describe("sanitizeEntryPath", () => {
  it("keeps clean relative paths", () => {
    expect(sanitizeEntryPath("src/lib/foo.ts")).toBe("src/lib/foo.ts");
    expect(sanitizeEntryPath("./a/./b.ts")).toBe("a/b.ts");
    expect(sanitizeEntryPath("a\\b\\c.ts")).toBe("a/b/c.ts");
  });
  it("rejects traversal and absolute paths", () => {
    expect(sanitizeEntryPath("../evil.txt")).toBeNull();
    expect(sanitizeEntryPath("a/../../evil.txt")).toBeNull();
    expect(sanitizeEntryPath("/etc/passwd")).toBeNull();
    expect(sanitizeEntryPath("C:\\Windows\\x.txt")).toBeNull();
    expect(sanitizeEntryPath("//server/share")).toBeNull();
  });
  it("returns null for empty/dot-only", () => {
    expect(sanitizeEntryPath("")).toBeNull();
    expect(sanitizeEntryPath("./")).toBeNull();
  });
});

describe("safeUnzip", () => {
  it("extracts allowlisted source files and skips binaries", async () => {
    const buf = await makeZip({
      "src/index.ts": "export const x = 1;",
      "README.md": "# hi",
      "logo.png": "binarybytes",
      "notes.txt": "hello",
    });
    const res = await safeUnzip(buf, baseLimits());
    const paths = res.entries.map((e) => e.path).sort();
    expect(paths).toEqual(["README.md", "notes.txt", "src/index.ts"]);
    expect(text(res.entries.find((e) => e.path === "src/index.ts")!.bytes))
      .toBe("export const x = 1;");
    expect(res.skipped).toContainEqual({ path: "logo.png", reason: "binary" });
    expect(res.truncated).toBe(false);
  });

  it("ignores junk directories before reading them", async () => {
    const buf = await makeZip({
      "src/app.ts": "ok",
      "node_modules/left-pad/index.js": "junk",
      ".git/config": "junk",
      "dist/bundle.js": "junk",
      "yarn.lock": "junk",
      "app.min.js": "junk",
    });
    const res = await safeUnzip(buf, baseLimits());
    expect(res.entries.map((e) => e.path)).toEqual(["src/app.ts"]);
    const reasons = Object.fromEntries(res.skipped.map((s) => [s.path, s.reason]));
    expect(reasons["node_modules/left-pad/index.js"]).toBe("ignored");
    expect(reasons[".git/config"]).toBe("ignored");
    expect(reasons["dist/bundle.js"]).toBe("ignored");
    expect(reasons["yarn.lock"]).toBe("ignored");
    expect(reasons["app.min.js"]).toBe("ignored");
  });

  // Note: JSZip's loader collapses "../" sequences on read, so a `..` entry
  // can't reach safeUnzip through JSZip — that defense is covered by the
  // sanitizeEntryPath unit tests above. Absolute paths (below) are NOT
  // collapsed by JSZip, so this proves the traversal-skip wiring end-to-end.
  it("skips absolute-path entries (zip-slip)", async () => {
    const buf = makeRawZip("/etc/passwd", "root:x:0:0");
    const res = await safeUnzip(buf, baseLimits());
    expect(res.entries).toEqual([]);
    expect(res.skipped).toContainEqual({ path: "/etc/passwd", reason: "traversal" });
  });

  it("rejects symlink entries", async () => {
    const zip = new JSZip();
    zip.file("real.ts", "ok");
    zip.file("link.ts", "/etc/passwd", { unixPermissions: 0o120777 });
    // unixPermissions are only written on the UNIX platform.
    const buf = await zip.generateAsync({ type: "nodebuffer", platform: "UNIX" });
    const res = await safeUnzip(buf, baseLimits());
    expect(res.entries.map((e) => e.path)).toEqual(["real.ts"]);
    expect(res.skipped).toContainEqual({ path: "link.ts", reason: "symlink" });
  });

  it("skips a single oversize entry without failing the archive", async () => {
    const buf = await makeZip({
      "small.ts": "x".repeat(10),
      "big.ts": "x".repeat(200),
    });
    const res = await safeUnzip(buf, baseLimits({ maxFileUncompressed: 50 }));
    expect(res.entries.map((e) => e.path)).toEqual(["small.ts"]);
    expect(res.skipped).toContainEqual({ path: "big.ts", reason: "oversize" });
  });

  it("throws when cumulative uncompressed size exceeds the cap (zip bomb)", async () => {
    const buf = await makeZip({
      "a.ts": "x".repeat(80),
      "b.ts": "x".repeat(80),
    });
    await expect(safeUnzip(buf, baseLimits({ maxTotalUncompressed: 100 })))
      .rejects.toBeInstanceOf(SafeUnzipError);
  });

  it("marks truncated when the entry cap is hit", async () => {
    const buf = await makeZip({
      "a.ts": "1",
      "b.ts": "2",
      "c.ts": "3",
      "d.ts": "4",
    });
    const res = await safeUnzip(buf, baseLimits({ maxEntries: 2 }));
    expect(res.truncated).toBe(true);
    expect(res.entries.length).toBeLessThanOrEqual(2);
  });

  it("does not recurse into nested archives", async () => {
    const buf = await makeZip({
      "code.ts": "ok",
      "inner.zip": "PK\u0003\u0004fakezip",
    });
    const res = await safeUnzip(buf, baseLimits());
    expect(res.entries.map((e) => e.path)).toEqual(["code.ts"]);
    expect(res.skipped).toContainEqual({ path: "inner.zip", reason: "nested-archive" });
  });

  it("skips entries deeper than maxDepth", async () => {
    const buf = await makeZip({
      "a/b.ts": "shallow",
      "a/b/c/d.ts": "deep",
    });
    const res = await safeUnzip(buf, baseLimits({ maxDepth: 2 }));
    expect(res.entries.map((e) => e.path)).toEqual(["a/b.ts"]);
    expect(res.skipped).toContainEqual({ path: "a/b/c/d.ts", reason: "too-deep" });
  });

  it("extracts leading-dot config files by their extension", async () => {
    const buf = await makeZip({ ".env": "SECRET=1", ".gitignore": "node_modules" });
    const res = await safeUnzip(buf, baseLimits());
    const paths = res.entries.map((e) => e.path).sort();
    expect(paths).toContain(".env");
  });

  it("throws SafeUnzipError on non-zip input", async () => {
    await expect(safeUnzip(Buffer.from("not a zip"), baseLimits()))
      .rejects.toBeInstanceOf(SafeUnzipError);
  });
});
