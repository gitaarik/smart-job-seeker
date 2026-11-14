/**
 * The career-site boards behind the feed platforms (`ats_boards`), as the app
 * needs to show them. The fetchers themselves live in cloud
 * (`src/server/ats/providers/`); this is only the public page per provider,
 * for a link, and the vocabulary of a board's status.
 */

export const ATS_BOARD_STATUSES = ['live', 'throttled', 'gone', 'closed'] as const;
export type AtsBoardStatus = (typeof ATS_BOARD_STATUSES)[number];

export const ATS_BOARD_STATUS_LABEL: Record<AtsBoardStatus, string> = {
	live: 'Live',
	throttled: 'Throttled',
	gone: 'Gone',
	closed: 'Closed'
};

/** The company's public careers page on the provider, for people; null for a provider we do not know. */
export function atsCareersUrl(provider: string, slug: string): string | null {
	const s = encodeURIComponent(slug);
	switch (provider) {
		case 'greenhouse':
			return `https://boards.greenhouse.io/${s}`;
		case 'lever':
			return `https://jobs.lever.co/${s}`;
		case 'ashby':
			return `https://jobs.ashbyhq.com/${s}`;
		case 'recruitee':
			return `https://${s}.recruitee.com/`;
		case 'remoteok':
			// A whole job board with a feed, not a company's careers page.
			return 'https://remoteok.com/';
		default:
			return null;
	}
}
