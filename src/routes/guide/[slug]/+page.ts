import { error } from "@sveltejs/kit";
import { marked } from "marked";
import { getGuideSection } from "$lib/guide";
import type { PageLoad } from "./$types";

export const load: PageLoad = ({ params }) => {
  const section = getGuideSection(params.slug);
  if (!section) {
    error(404, "Guide section not found");
  }
  // Content is authored by us (trusted), so rendering its HTML is safe.
  const html = marked.parse(section.markdown, { async: false });
  return { slug: section.slug, title: section.title, html };
};
