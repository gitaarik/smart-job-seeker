/**
 * The prose rendering of a proposal.
 *
 * The card's from/to pairs are for a chat panel; this is for everything that
 * isn't one — a tool result, an audit line, an agent saying what it is about to
 * do. The case it exists for is the long text, where "5,204 → 4,830 characters"
 * is honest and useless and pasting both versions is unreadable.
 */
import { describe, expect, it } from 'vitest';
import { summarizeProposal } from '../proposal-summary';

const base = {
	title: "Edit the job's details",
	target: { id: 3818, label: 'Data Engineer at Acme' }
};

const change = (label: string, from: string, to: string) => ({
	field: label.toLowerCase().replace(/ /g, '_'),
	label,
	from,
	to
});

describe('summarizeProposal', () => {
	it('names the capability and the row it acts on', () => {
		const out = summarizeProposal({
			...base,
			changes: [change('Salary min', '55,000', '75,000')]
		});
		expect(out).toContain("Proposed: Edit the job's details");
		expect(out).toContain('Data Engineer at Acme');
	});

	it('says applied when it already happened', () => {
		const out = summarizeProposal({
			...base,
			changes: [change('Salary min', '55,000', '75,000')],
			applied: true
		});
		expect(out).toMatch(/^Applied:/);
	});

	it('renders a short change as a plain arrow', () => {
		const out = summarizeProposal({
			...base,
			changes: [change('Salary min', '55,000', '75,000')]
		});
		expect(out).toContain('Salary min: 55,000 → 75,000');
	});

	it('distinguishes setting a field from changing one', () => {
		const out = summarizeProposal({
			...base,
			changes: [change('Posted by', '—', 'Jane Doe')]
		});
		expect(out).toContain('Posted by: set to Jane Doe');
		expect(out).not.toContain('→');
	});

	it('distinguishes clearing a field, and says what was lost', () => {
		// "Location: cleared" alone would be a change you cannot review.
		const out = summarizeProposal({
			...base,
			changes: [change('Location', 'Berlin', '—')]
		});
		expect(out).toContain('Location: cleared (was Berlin)');
	});

	it('returns nothing at all when there is nothing to say', () => {
		// So a caller drops the block rather than printing a heading over air.
		expect(summarizeProposal({ ...base, changes: [] })).toBe('');
	});

	it('includes the rationale when there is one', () => {
		const out = summarizeProposal({
			...base,
			changes: [change('Salary min', '1', '2')],
			rationale: 'You said the range was wrong.'
		});
		expect(out).toContain('You said the range was wrong.');
	});

	describe('a long text', () => {
		const OLD = `We are looking for a backend engineer with 10+ years of
      experience building distributed systems. You will own the settlement
      pipeline end to end. Salary DOE. We offer a competitive package and a
      collaborative environment where everyone's voice is heard.`;
		const NEW = `We are looking for a backend engineer with 3+ years of
      experience building distributed systems. You will own the settlement
      pipeline end to end. Salary 75,000 to 90,000 euros. We offer a competitive
      package and a collaborative environment where everyone's voice is heard.`;

		it('reports the shape rather than quoting both versions', () => {
			const out = summarizeProposal({
				...base,
				changes: [change('Description', OLD, NEW)]
			});
			expect(out).toContain('Description: rewritten');
			expect(out).toMatch(/\d+ → \d+ characters/);
			// The unchanged bulk must not be dumped into the summary.
			expect(out).not.toContain('collaborative environment');
		});

		it('quotes what actually differs, marked added or removed', () => {
			const out = summarizeProposal({
				...base,
				changes: [change('Description', OLD, NEW)]
			});
			expect(out).toMatch(/[+−]/);
			// The substantive edit — the salary going from unstated to a range.
			expect(out).toContain('75,000');
		});

		it('caps how much it quotes', () => {
			const bulk = (word: string) => Array(400).fill(word).join(' ');
			const out = summarizeProposal({
				...base,
				changes: [change('Description', bulk('alpha'), bulk('beta'))]
			});
			// A wholesale rewrite must summarise, not reproduce itself.
			expect(out.length).toBeLessThan(1200);
			expect(out).toContain('rewritten');
		});

		it('presents excerpts in document order, not by size', () => {
			// Runs are CHOSEN by length (the substantive edit is rarely first) but
			// must be SHOWN in the order they appear — selection order interleaves
			// fragments from different parts of the text and reads as a shuffled bag.
			//
			// Purpose-built fixture: one short changed run early and one long one
			// late, so selection order and document order genuinely disagree.
			const filler = Array.from({ length: 40 }, (_, i) => `body${i}`).join(' ');
			const from = `alpha bravo charlie delta echo ${filler} closing remarks here`;
			const to =
				`alpha ZULU YANKEE XRAY delta echo ${filler} ` +
				`a substantially longer replacement for the closing remarks that ends it`;

			const out = summarizeProposal({
				...base,
				changes: [change('Description', from, to)]
			});
			const quoted = out.split('\n').filter((l) => /^\s+[+−]/.test(l));
			expect(quoted.length).toBeGreaterThan(1);

			// The early edit must be quoted before the late one, even though the
			// late one is longer and was therefore selected first.
			const zuluAt = quoted.findIndex((l) => l.includes('ZULU'));
			const closingAt = quoted.findIndex((l) => l.includes('substantially'));
			expect(zuluAt).toBeGreaterThanOrEqual(0);
			expect(closingAt).toBeGreaterThanOrEqual(0);
			expect(zuluAt).toBeLessThan(closingAt);
		});

		it('quotes short runs rather than nothing when there is nothing longer', () => {
			// Scattered one-word edits clear no length threshold, and this is exactly
			// the case a reader needs help with: a long text where little moved. The
			// threshold is there to prefer substantial runs over trivial ones, not to
			// answer "what changed?" with silence when every run is trivial.
			const old = Array.from({ length: 60 }, (_, i) => `word${i}`).join(' ');
			const next = old.replace('word7', 'seven').replace('word31', 'x');
			const out = summarizeProposal({
				...base,
				changes: [change('Description', old, next)]
			});

			expect(out).toContain('Description: rewritten');
			expect(out).toContain('seven');
			expect(out).toContain('word7');
			// And still not the sixty words that did not move.
			expect(out).not.toContain('word12');
		});
	});

	it('covers every change, not just the first', () => {
		// The under-fill failure the proposal schema was reshaped to avoid would
		// be worth nothing if the summary then dropped half of what came back.
		const out = summarizeProposal({
			...base,
			changes: [
				change('Salary min', '1', '2'),
				change('Salary max', '3', '4'),
				change('Work arrangement', 'remote', 'remote, hybrid')
			]
		});
		expect(out).toContain('Salary min');
		expect(out).toContain('Salary max');
		expect(out).toContain('Work arrangement');
	});
});
