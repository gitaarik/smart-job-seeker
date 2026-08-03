import type { PageServerLoad } from "./$types";

/**
 * The Activity stream reads entirely from the layout's application query —
 * records, the legacy `applications_files` rows, and the status log are all
 * already loaded there for the other tabs. Nothing to fetch here yet; the
 * composer's actions land in this file at the next step.
 */
export const load: PageServerLoad = async ({ parent }) => {
  await parent();
  // Label for the assistant's "I can see this page" chip. The entries
  // themselves are resolved server-side — see ai-chat/chat-context.ts.
  return { chatContext: { label: "Application activity" } };
};
