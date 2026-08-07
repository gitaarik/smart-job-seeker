/**
 * Site-specific utilities for job scraping
 */

/**
 * Get human-readable site name from URL
 */
export function getSiteName(url: string): string {
	try {
		const hostname = new URL(url).hostname;

		if (hostname.includes('linkedin.com')) return 'LinkedIn';
		if (hostname.includes('indeed.com')) return 'Indeed';
		if (hostname.includes('glassdoor.com')) return 'Glassdoor';

		return hostname;
	} catch {
		return 'Unknown';
	}
}
