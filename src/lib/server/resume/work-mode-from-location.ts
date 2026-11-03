/**
 * Lift a working arrangement out of a role's location, for a CV being read in.
 *
 * A CV has nowhere else to say a role was remote, so it says it in the
 * location: "Remote", "Amsterdam (hybrid)", "Remote (Austin, USA)". Kept as the
 * location, that prints back as a place, which is what `work_mode` exists to
 * stop (see $lib/work-mode.ts). This keeps the place and returns the
 * arrangement apart, read with the job side's own words for it
 * (WORK_LOCATIONS), so "thuiswerk" and "on-site" mean what they mean on a
 * posting.
 *
 * Only a whole part counts: the whole text, one side of a bracket, or a piece
 * between commas, bars, slashes, middots or a spaced dash. "Remoteville" stays a
 * place, and so does anything the vocabulary does not know.
 */
import { WORK_LOCATIONS, buildNormalizeMap } from '$lib/data/job-taxonomy';
import { asWorkMode, type WorkMode } from '$lib/work-mode';

const ARRANGEMENTS = buildNormalizeMap(WORK_LOCATIONS);

/** A spaced dash, so "Noord-Holland" stays whole, and the other separators. */
const SEPARATOR = /(\s*(?:,|\||·|•|\/|\s[-–—]\s)\s*)/;

function arrangement(text: string): WorkMode | null {
	return asWorkMode(ARRANGEMENTS.get(text.trim().toLowerCase()));
}

export interface SplitLocation {
	/** What is left of the location: the place, or '' when it named none. */
	location: string;
	workMode?: WorkMode;
}

export function splitWorkMode(raw: string | null | undefined): SplitLocation {
	const text = (raw ?? '').trim();
	const whole = arrangement(text);
	if (!text || whole) return { location: whole ? '' : text, workMode: whole ?? undefined };

	// "Remote (Austin, USA)" and "Austin, USA (remote)": one side is the place.
	const bracketed = /^(.*?)\s*[([]([^)\]]*)[)\]]\s*$/.exec(text);
	if (bracketed) {
		const [, outside, inside] = bracketed;
		const before = arrangement(outside);
		if (before) return { location: inside.trim(), workMode: before };
		const after = arrangement(inside);
		if (after) return { location: outside.trim(), workMode: after };
		// A bracket that holds part of the place ("Leiden (Zuid-Holland)") is
		// left alone: the separators below would cut through it.
		return { location: text };
	}

	const pieces = text.split(SEPARATOR);
	let workMode: WorkMode | undefined;
	let location = '';
	// `pieces` alternates part, separator, part. A kept part is joined by the
	// separator in front of it, so dropping "Remote" from "Remote - Austin, USA"
	// leaves "Austin, USA" and not ", USA".
	for (let i = 0; i < pieces.length; i += 2) {
		const part = pieces[i].trim();
		const found = arrangement(part);
		if (found) {
			workMode ??= found;
			continue;
		}
		if (!part) continue;
		location += location ? `${pieces[i - 1]}${part}` : part;
	}
	return workMode ? { location, workMode } : { location: text };
}

/**
 * A parsed role with its arrangement lifted out of its location, or the role
 * as it was when its location names none (or it already has a mode).
 */
export function liftWorkMode<T extends { location?: string; workMode?: WorkMode }>(work: T): T {
	if (work.workMode || !work.location) return work;
	const split = splitWorkMode(work.location);
	return split.workMode ? { ...work, location: split.location, workMode: split.workMode } : work;
}
