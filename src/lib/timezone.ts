export const TIMEZONE_OPTIONS = [
	{
		group: 'Americas',
		zones: [
			'America/New_York',
			'America/Chicago',
			'America/Denver',
			'America/Los_Angeles',
			'America/Anchorage',
			'America/Toronto',
			'America/Vancouver',
			'America/Mexico_City',
			'America/Bogota',
			'America/Lima',
			'America/Sao_Paulo',
			'America/Argentina/Buenos_Aires'
		]
	},
	{
		group: 'Europe',
		zones: [
			'Europe/London',
			'Europe/Dublin',
			'Europe/Paris',
			'Europe/Berlin',
			'Europe/Amsterdam',
			'Europe/Brussels',
			'Europe/Madrid',
			'Europe/Rome',
			'Europe/Zurich',
			'Europe/Vienna',
			'Europe/Stockholm',
			'Europe/Oslo',
			'Europe/Copenhagen',
			'Europe/Helsinki',
			'Europe/Warsaw',
			'Europe/Prague',
			'Europe/Bucharest',
			'Europe/Athens',
			'Europe/Istanbul',
			'Europe/Moscow',
			'Europe/Lisbon'
		]
	},
	{
		group: 'Asia & Pacific',
		zones: [
			'Asia/Dubai',
			'Asia/Kolkata',
			'Asia/Bangkok',
			'Asia/Singapore',
			'Asia/Shanghai',
			'Asia/Hong_Kong',
			'Asia/Tokyo',
			'Asia/Seoul',
			'Asia/Jakarta',
			'Asia/Karachi',
			'Asia/Dhaka',
			'Asia/Taipei',
			'Australia/Sydney',
			'Australia/Melbourne',
			'Australia/Perth',
			'Pacific/Auckland'
		]
	},
	{
		group: 'Africa & Middle East',
		zones: [
			'Africa/Cairo',
			'Africa/Lagos',
			'Africa/Johannesburg',
			'Africa/Nairobi',
			'Africa/Casablanca',
			'Asia/Jerusalem',
			'Asia/Riyadh'
		]
	}
];

export function formatTzLabel(tz: string): string {
	try {
		const now = new Date();
		const formatter = new Intl.DateTimeFormat('en-US', {
			timeZone: tz,
			timeZoneName: 'shortOffset'
		});
		const parts = formatter.formatToParts(now);
		const offset = parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
		const city = tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
		return `${city} (${offset})`;
	} catch {
		return tz;
	}
}
