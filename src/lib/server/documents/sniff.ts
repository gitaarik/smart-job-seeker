/**
 * Magic-byte sniffing for uploaded documents.
 *
 * Client-declared MIME / extension is untrusted — a renamed `.exe` must never
 * reach a parser. We verify the actual bytes: PDFs must start with `%PDF`,
 * ZIP/DOCX with the PK signature, and text/source files must look like text
 * (no NUL bytes). Extension is used only to disambiguate (docx vs zip are both
 * PK) and must agree with the header.
 */

import { DEFAULT_EXTRACT_EXTENSIONS } from "./safe-unzip";

export type UploadKind = "zip" | "pdf" | "docx" | "text" | "email" | "unknown";

const TEXT_EXTS = new Set(DEFAULT_EXTRACT_EXTENSIONS);

/** Lowercased extension without the dot; leading-dot files → the name itself. */
export function extOf(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? "";
  const dot = base.lastIndexOf(".");
  if (dot < 0) return "";
  if (dot === 0) return base.slice(1).toLowerCase();
  return base.slice(dot + 1).toLowerCase();
}

/** Heuristic: no NUL byte in the leading window → treat as text. */
function looksLikeText(bytes: Uint8Array): boolean {
  const n = Math.min(bytes.length, 8000);
  for (let i = 0; i < n; i++) {
    if (bytes[i] === 0) return false;
  }
  return true;
}

function hasPdfHeader(b: Uint8Array): boolean {
  return b.length >= 5 &&
    b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46; // %PDF
}

function hasZipHeader(b: Uint8Array): boolean {
  return b.length >= 4 &&
    b[0] === 0x50 && b[1] === 0x4b && // PK
    (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07) &&
    (b[3] === 0x04 || b[3] === 0x06 || b[3] === 0x08);
}

/**
 * Classify an uploaded file by its bytes (with the extension as a tiebreaker).
 * Returns "unknown" when the header contradicts the extension or the type is
 * not something we can extract text from.
 */
export function sniffUploadKind(bytes: Uint8Array, filename: string): UploadKind {
  const ext = extOf(filename);

  if (hasPdfHeader(bytes)) {
    // A real PDF; require the extension to agree (don't parse a `.jpg` as PDF).
    return ext === "pdf" || ext === "" ? "pdf" : "unknown";
  }
  if (hasZipHeader(bytes)) {
    // Both DOCX and ZIP are PK containers; disambiguate by extension.
    return ext === "docx" ? "docx" : "zip";
  }

  // No binary container signature: an ext claiming one is a mismatch.
  if (ext === "pdf" || ext === "docx" || ext === "zip") return "unknown";

  // An .eml is RFC822 text; the MIME parser turns it into readable text.
  if (ext === "eml" && looksLikeText(bytes)) return "email";
  if (TEXT_EXTS.has(ext) && looksLikeText(bytes)) return "text";
  return "unknown";
}
