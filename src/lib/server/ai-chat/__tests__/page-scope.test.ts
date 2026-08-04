/**
 * The block that says what page the user is on.
 *
 * The distinction it carries is the whole point: a page ABOUT one thing makes a
 * bare question mean that thing, and a page about a collection makes the same
 * question mean something else. Getting that backwards is not a worse answer,
 * it is an answer to a different question.
 */
import { describe, expect, it } from "vitest";
import { formatPageScope } from "../page-scope";

describe("formatPageScope", () => {
  it("renders nothing when the route declared no hint", () => {
    // Not every caller is a page. An empty block is right; an invented one
    // would tell the model it is somewhere it is not.
    expect(formatPageScope(undefined)).toBe("");
  });

  it("names the page", () => {
    const out = formatPageScope({
      page: "one application's own page",
      subject: "that application",
    });

    expect(out).toContain("## Where the user is");
    expect(out).toContain("They are on one application's own page.");
  });

  it("says what an unqualified question is about, when there is one", () => {
    const out = formatPageScope({
      page: "one application's own page",
      subject: "that application",
    });

    expect(out).toContain(
      "A question that names no subject is about that application.",
    );
  });

  it("tells the model NOT to pick one when the page is about no single thing", () => {
    // The failure this prevents: on the applications list, answering "how is it
    // going?" about whichever application happened to be rendered first.
    const out = formatPageScope({
      page: "the list of their applications",
      subject: null,
    });

    expect(out).toContain("not about any one application or job");
    expect(out).toContain("Do not pick one and answer as if they meant that");
  });

  it("stays out of behaviour, which belongs with the block it governs", () => {
    // Two places wording the same rule is how they drift. The pipeline block
    // already explains what comparing across applications means; this one
    // states a fact and stops.
    const out = formatPageScope({
      page: "the list of their applications",
      subject: null,
    });

    expect(out).not.toMatch(/compar/i);
    expect(out).not.toMatch(/prioriti/i);
  });
});
