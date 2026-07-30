/**
 * Budget behaviour for the application-documents prompt block.
 *
 * Like the interview-records block, the caps are the reason this exists rather
 * than interpolating the extracted text directly: a single attached PDF (a
 * 40-page contract, a scanned brief) can dwarf every other part of the prompt.
 * What matters is that the block stays bounded, that the most recent documents
 * survive the trimming, and that the model is told when it is seeing a partial
 * set — and that outward-facing prompts are warned off implying the document
 * itself.
 */
import { describe, expect, it } from "vitest";
import {
  type DocForContext,
  formatDocumentsContext,
} from "../application-documents";

function doc(over: Partial<DocForContext> = {}): DocForContext {
  return { title: "job-posting.pdf", text: "Some content.", ...over };
}

const filler = (n: number, char = "x") => char.repeat(n);

describe("formatDocumentsContext", () => {
  it("returns empty string when nothing is attached", () => {
    expect(formatDocumentsContext([])).toBe("");
  });

  it("returns empty string when every document is textless", () => {
    // An attached image yields no text; it must not emit a heading-only block
    // that reads to the model as "a document exists but is unreadable".
    const out = formatDocumentsContext([
      doc({ text: "" }),
      doc({ text: "   " }),
    ]);
    expect(out).toBe("");
  });

  it("renders a titled heading and the document's text", () => {
    const out = formatDocumentsContext([
      doc({ title: "offer-letter.pdf", text: "Base salary is 70k." }),
    ]);
    expect(out).toContain("### Document: offer-letter.pdf");
    expect(out).toContain("Base salary is 70k.");
  });

  it("preserves the order it was given", () => {
    const out = formatDocumentsContext([
      doc({ title: "first.pdf", text: "one" }),
      doc({ title: "second.pdf", text: "two" }),
      doc({ title: "third.pdf", text: "three" }),
    ]);
    expect(out.indexOf("first.pdf")).toBeLessThan(out.indexOf("second.pdf"));
    expect(out.indexOf("second.pdf")).toBeLessThan(out.indexOf("third.pdf"));
  });

  it("gives compact mode a tighter budget than full mode", () => {
    const docs = Array.from(
      { length: 4 },
      (_, i) => doc({ title: `doc-${i}.pdf`, text: filler(5000) }),
    );
    const full = formatDocumentsContext(docs, "full");
    const compact = formatDocumentsContext(docs, "compact");
    expect(compact.length).toBeLessThan(full.length);
  });

  it("keeps compact output within its total budget", () => {
    const docs = Array.from(
      { length: 30 },
      (_, i) => doc({ title: `doc-${i}.pdf`, text: filler(9000) }),
    );
    // 15k total + the guidance/omission preamble.
    expect(formatDocumentsContext(docs, "compact").length).toBeLessThan(17000);
  });

  it("keeps full output within its total budget", () => {
    const docs = Array.from(
      { length: 30 },
      (_, i) => doc({ title: `doc-${i}.pdf`, text: filler(9000) }),
    );
    // 40k total + the guidance/omission preamble.
    expect(formatDocumentsContext(docs, "full").length).toBeLessThan(42000);
  });

  it("truncates rather than drops while the total still fits", () => {
    // Per-document capping is the first line of defence: a few oversized docs
    // all fit once trimmed, so none should be sacrificed.
    const docs = [
      doc({ title: "a.pdf", text: filler(4000) }),
      doc({ title: "b.pdf", text: filler(4000) }),
      doc({ title: "c.pdf", text: filler(4000) }),
    ];
    const out = formatDocumentsContext(docs, "compact");
    expect(out).toContain("a.pdf");
    expect(out).toContain("b.pdf");
    expect(out).toContain("c.pdf");
    expect(out).not.toContain("omitted to");
  });

  it("drops the oldest first when over budget", () => {
    const docs = Array.from(
      { length: 20 },
      (_, i) => doc({ title: `doc-${i}.pdf`, text: filler(2000) }),
    );
    const out = formatDocumentsContext(docs, "compact");
    // The most recently attached survive; the oldest are sacrificed.
    expect(out).toContain("doc-19.pdf");
    expect(out).not.toContain("doc-0.pdf");
  });

  it("keeps one document rather than none when a single one blows the budget", () => {
    const out = formatDocumentsContext(
      [doc({ title: "huge-contract.pdf", text: filler(200000) })],
      "compact",
    );
    expect(out).toContain("huge-contract.pdf");
    expect(out.length).toBeLessThan(17000);
  });

  it("tells the model when the set it has is partial", () => {
    const docs = Array.from(
      { length: 30 },
      (_, i) => doc({ title: `doc-${i}.pdf`, text: filler(9000) }),
    );
    const out = formatDocumentsContext(docs, "compact");
    expect(out).toMatch(/document\(s\) are attached but were omitted/);
    expect(out).toContain("partial rather than complete");
  });

  it("says nothing about omissions when everything fits", () => {
    const out = formatDocumentsContext([doc({ text: "short" })], "compact");
    expect(out).not.toContain("omitted to");
  });

  it("warns outward-facing prompts not to imply the document exists", () => {
    const out = formatDocumentsContext([doc()], "compact");
    expect(out).toContain(
      "Use the information in them, not the fact that a document exists",
    );
    expect(out).toContain("authoritative about this specific role and employer");
  });

  it("tells interview-prep prompts to build on the documents' specifics", () => {
    const full = formatDocumentsContext([doc()], "full");
    expect(full).toContain("build the preparation around them");
    expect(full).toContain("surface it");
    // The fabrication guard is a writing-prompt concern only.
    expect(full).not.toContain("not the fact that a document exists");
  });

  it("tells both modes to translate rather than drop", () => {
    for (const mode of ["compact", "full"] as const) {
      const out = formatDocumentsContext([doc()], mode);
      expect(out, mode).toContain("different language");
      expect(out, mode).toContain("Translate what you use");
    }
  });

  it("survives a document with no title", () => {
    expect(formatDocumentsContext([doc({ title: null })])).toContain(
      "### Document: Untitled",
    );
  });
});
