/**
 * The invalidation key for one project's detail layout.
 *
 * A project's Details tab has no load of its own: the heading, the tab bar and
 * the editor all read the row that the layout loaded. SvelteKit keeps a
 * layout's data across a move between its own children — nothing that load
 * depends on changed — so that row is a snapshot taken when the page was first
 * opened, while the Details tab is destroyed and rebuilt from it on every
 * return.
 *
 * That is the bug this key closes. A description typed on Details, auto-saved,
 * and looked at again after a trip to Files & code came back as the value it
 * had before the edit, and only a reload showed the truth. The layout load
 * declares this dependency and every save on the tab invalidates it, so the
 * snapshot is refreshed as soon as the write lands — which also keeps the
 * heading and the document title in step with a rename.
 *
 * Invalidated after the save resolves rather than when it is scheduled: a tab
 * switch flushes pending saves on the way out, and a refresh racing its own
 * PATCH would re-read the value the user just replaced.
 *
 * Targeted rather than `invalidateAll()` because this fires on a debounce tick
 * while the user is typing, and `invalidateAll()` would re-run the dashboard
 * layout's auth, profile list, credit balance and notification count with it.
 */

export type ProjectDetailKind = 'work_experience_project' | 'side_project';

export function projectDetailDep(kind: ProjectDetailKind, id: number): string {
	return `project-detail:${kind}:${id}`;
}
