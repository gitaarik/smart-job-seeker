/**
 * Load the gazetteer the place picker searches (`places`,
 * planning/STRUCTURED-LOCATIONS.md) from GeoNames and our own regions.
 *
 * - `cities5000`: every place over 5,000 people (about 70,000), with its
 *   coordinates, population and names in other languages. 5,000 rather than
 *   15,000 so towns like Bloemendaal are there.
 * - `admin1CodesASCII`: first-level divisions (North Holland, Georgia), so a
 *   user can pick a province or a state.
 * - `countryInfo`: the countries, named in English and found under their
 *   names in the languages the boards write in.
 * - `REGIONS` (`src/lib/data/regions.ts`): Europe, EMEA, DACH, ...
 *
 * GeoNames is CC BY 4.0 (https://www.geonames.org): the picker credits it
 * (Phase 2). The files are downloaded, not committed: into --dir (default
 * <tmpdir>/geonames), fetched only when missing. A run takes about 20 s on
 * dev, most of it Europe's alternate names.
 *
 * Ids are GeoNames ids and the regions' fixed ones, so a reload updates rows
 * in place; a place GeoNames dropped is deleted (a user's pick keeps its own
 * copy). Safe to re-run. Dry run by default.
 *
 *   # from cloud/, on dev
 *   docker compose exec -T app npx tsx scripts/load-places.ts [--apply]
 *   # preview / production
 *   docker compose exec app node dist-scripts/load-places.mjs [--apply]
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import JSZip from 'jszip';
import { sql } from 'drizzle-orm';
import { dbDirect as db } from '$lib/server/db';
import { places } from '$lib/server/db/schema';
import { foldPlaceName, type PlaceKind } from '$lib/data/places';
import { REGIONS } from '$lib/data/regions';

const APPLY = process.argv.includes('--apply');
const dirArg = process.argv.indexOf('--dir');
const DIR = dirArg > 0 ? process.argv[dirArg + 1] : path.join(os.tmpdir(), 'geonames');
const SOURCE = 'https://download.geonames.org/export/dump';

/**
 * Feature codes left out: a section of a city (PPLX: "Amsterdam-Zuidoost",
 * and a Bloemendaal in the wrong province), and places that are no longer
 * there (historical, abandoned, destroyed).
 */
const SKIPPED_FEATURES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH']);

/** Codes countryInfo still lists for countries that are gone. */
const GONE_COUNTRIES = new Set(['AN', 'CS']);

/** Languages a country is also found under, besides its English name. */
const COUNTRY_LANGUAGES = ['en', 'nl', 'de', 'fr', 'es', 'pt', 'it'];

/** Short and older names people type for a country. */
const COUNTRY_ALIASES: Record<string, string[]> = {
	US: ['usa', 'us', 'america', 'united states of america'],
	GB: ['uk', 'britain', 'great britain'],
	AE: ['uae'],
	NL: ['holland']
};

/**
 * Where a first-level division also gets its names in other languages
 * ("Noord-Holland", "Bayern"): admin1CodesASCII names it in English only,
 * and in Europe users and boards write the local name. GeoNames has those
 * per country (`alternatenames/NL.zip`); all countries together are 200 MB,
 * Europe's a fraction of that.
 */
const LOCAL_ADMIN_NAMES = REGIONS.find((r) => r.name === 'Europe')!.countries;

/** Alternate-name "languages" that are codes or links, not names. */
const NOT_NAMES = new Set(['link', 'post', 'iata', 'icao', 'faac', 'abbr', 'wkdt', 'unlc']);

interface Row {
	id: number;
	kind: PlaceKind;
	name: string;
	label: string;
	country_code: string | null;
	admin1: string | null;
	countries: string[];
	lat: number | null;
	lon: number | null;
	population: number;
	names: string[];
}

async function file(name: string): Promise<string> {
	const txt = path.join(DIR, name.replace(/\.zip$/, '.txt'));
	if (!fs.existsSync(txt)) {
		fs.mkdirSync(path.dirname(txt), { recursive: true });
		console.log(`Downloading ${SOURCE}/${name}`);
		const res = await fetch(`${SOURCE}/${name}`);
		if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
		const body = Buffer.from(await res.arrayBuffer());
		if (name.endsWith('.zip')) {
			const zip = await JSZip.loadAsync(body);
			const entry = zip.file(path.basename(txt));
			if (!entry) throw new Error(`${name}: no ${path.basename(txt)} inside`);
			fs.writeFileSync(txt, await entry.async('nodebuffer'));
		} else {
			fs.writeFileSync(txt, body);
		}
	}
	return fs.readFileSync(txt, 'utf8');
}

/** The tab-separated lines of a GeoNames file, comments and blanks left out. */
const lines = (text: string) =>
	text
		.split('\n')
		.filter((l) => l && !l.startsWith('#'))
		.map((l) => l.split('\t'));

/** Folded and deduplicated, the own name first. */
function folded(own: string, others: string[]): string[] {
	return [...new Set([own, ...others].map(foldPlaceName).filter(Boolean))];
}

async function build(): Promise<Row[]> {
	const [countryText, adminText, cityText] = await Promise.all([
		file('countryInfo.txt'),
		file('admin1CodesASCII.txt'),
		file('cities5000.zip')
	]);

	const countryNames = new Map<string, string>();
	const rows: Row[] = [];
	const countryPopulation = new Map<string, number>();
	for (const c of lines(countryText)) {
		const [code, , , , listed] = c;
		// "The Netherlands" is the one listed with an article; "ne" should reach
		// it by its own name, and labels read "Haarlem, North Holland, Netherlands".
		const name = listed.replace(/^The /, '');
		const geonameId = Number(c[16]);
		if (GONE_COUNTRIES.has(code) || !geonameId) continue;
		countryNames.set(code, name);
		countryPopulation.set(code, Number(c[7]) || 0);
		const translated = COUNTRY_LANGUAGES.map(
			(lang) => new Intl.DisplayNames([lang], { type: 'region' }).of(code) ?? ''
		);
		rows.push({
			id: geonameId,
			kind: 'country',
			name,
			label: name,
			country_code: code,
			admin1: null,
			countries: [code],
			lat: null,
			lon: null,
			population: Number(c[7]) || 0,
			names: folded(name, [listed, ...translated, ...(COUNTRY_ALIASES[code] ?? [])])
		});
	}

	const admins = new Map<string, Row>();
	for (const [key, name, asciiName, id] of lines(adminText)) {
		const [code, admin1] = key.split('.');
		const country = countryNames.get(code);
		if (!country || !Number(id)) continue;
		const row: Row = {
			id: Number(id),
			kind: 'admin',
			name,
			label: `${name}, ${country}`,
			country_code: code,
			admin1,
			countries: [code],
			lat: null,
			lon: null,
			population: 0,
			names: folded(name, [asciiName])
		};
		admins.set(key, row);
		rows.push(row);
	}

	const adminById = new Map([...admins.values()].map((a) => [a.id, a]));
	for (const code of LOCAL_ADMIN_NAMES) {
		if (!countryNames.has(code)) continue;
		// 0 id, 1 geonameid, 2 language, 3 name, 4 preferred, 5 short, 6 colloquial, 7 historic
		for (const a of lines(await file(`alternatenames/${code}.zip`))) {
			const admin = adminById.get(Number(a[1]));
			if (!admin || NOT_NAMES.has(a[2]) || a[6] === '1' || a[7] === '1') continue;
			admin.names = folded(admin.name, [...admin.names, a[3]]);
		}
	}

	for (const c of lines(cityText)) {
		const [id, name, asciiName, alternates, lat, lon, , feature, code, , admin1] = c;
		const country = countryNames.get(code);
		if (!country || SKIPPED_FEATURES.has(feature)) continue;
		const population = Number(c[14]) || 0;
		const admin = admins.get(`${code}.${admin1}`);
		if (admin) admin.population += population;
		const parts = [name, admin && admin.name !== name ? admin.name : null, country];
		rows.push({
			id: Number(id),
			kind: 'city',
			name,
			label: parts.filter(Boolean).join(', '),
			country_code: code,
			admin1: admin1 || null,
			countries: [code],
			lat: Number(lat),
			lon: Number(lon),
			population,
			names: folded(name, [asciiName, ...(alternates ? alternates.split(',') : [])])
		});
	}

	for (const r of REGIONS) {
		rows.push({
			id: r.id,
			kind: 'region',
			name: r.name,
			label: r.name,
			country_code: null,
			admin1: null,
			countries: r.countries,
			lat: null,
			lon: null,
			population: r.countries.reduce((sum, c) => sum + (countryPopulation.get(c) ?? 0), 0),
			names: folded(r.name, r.aliases)
		});
	}
	return rows;
}

async function main() {
	const rows = await build();
	const byKind = new Map<string, number>();
	for (const r of rows) byKind.set(r.kind, (byKind.get(r.kind) ?? 0) + 1);
	console.log(`${rows.length} places: ${[...byKind].map(([k, n]) => `${n} ${k}`).join(', ')}`);
	for (const id of [2755003, 2758804, 4197000, 614540, -1]) {
		const r = rows.find((x) => x.id === id);
		if (r) console.log(`  ${r.id} ${r.kind} ${r.label} (${r.population}) ${r.names.slice(0, 6)}`);
	}
	// Europe's alternate names are most of the download (250 MB unzipped) and
	// only read once; the three small files stay for a re-run.
	fs.rmSync(path.join(DIR, 'alternatenames'), { recursive: true, force: true });
	if (!APPLY) {
		console.log('\nDry run. Re-run with --apply to write.');
		return;
	}

	await db.transaction(async (tx) => {
		for (let i = 0; i < rows.length; i += 1000) {
			const batch = rows.slice(i, i + 1000).map((r) => ({
				...r,
				tsv: sql`to_tsvector('simple', ${r.names.join(' ')})`
			}));
			await tx
				.insert(places)
				.values(batch)
				.onConflictDoUpdate({
					target: places.id,
					set: {
						kind: sql`excluded.kind`,
						name: sql`excluded.name`,
						label: sql`excluded.label`,
						country_code: sql`excluded.country_code`,
						admin1: sql`excluded.admin1`,
						countries: sql`excluded.countries`,
						lat: sql`excluded.lat`,
						lon: sql`excluded.lon`,
						population: sql`excluded.population`,
						names: sql`excluded.names`,
						tsv: sql`excluded.tsv`
					}
				});
		}
		const gone = await tx
			.delete(places)
			// One array parameter: a list of 70,000 would pass Postgres's 65,535.
			.where(sql`NOT (${places.id} = ANY(${`{${rows.map((r) => r.id).join(',')}}`}::int[]))`)
			.returning({ id: places.id });
		console.log(`\nWrote ${rows.length} places, deleted ${gone.length} GeoNames no longer has.`);
	});
}

main()
	.then(() => process.exit(0))
	.catch((err) => {
		console.error(err);
		process.exit(1);
	});
