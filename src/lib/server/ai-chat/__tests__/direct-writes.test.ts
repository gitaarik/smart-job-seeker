/**
 * The gate that decides whether a chat proposal may skip its card.
 *
 * Every case here is made up. The real ones, the conversations the gate was
 * measured on, are in the cloud tree's replay set; what this file pins is the
 * shape of each rule, including the ways a pasted mail must not get past it.
 */
import { describe, expect, it } from 'vitest';
import {
	chatDisposition,
	type DispositionInput,
	framing,
	ownWords,
	RECENT_THREAD_LOG_MS,
	reportIn,
	shingleShare
} from '../direct-writes';

const NOW = new Date('2026-09-26T12:00:00Z');

function input(overrides: Partial<DispositionInput> = {}): DispositionInput {
	return {
		capability: 'add_activity_record',
		fields: { entry_content: 'Sent the recruiter my availability for next week.' },
		turn: 'ok, I sent it',
		reply: 'Nice, that keeps things moving.',
		lastThreadLogAt: null,
		now: NOW,
		overBurst: false,
		...overrides
	};
}

describe('reportIn', () => {
	it.each([
		'ok, I sent it',
		'I already submitted the form and replied to their email',
		"I've sent the CV over",
		'I have just emailed them',
		'I had a second interview this morning',
		'he replied: thanks, talk soon',
		'they got back to me today',
		'my recruiter confirmed the slot',
		'I got an email from them',
		'great, log this activity',
		'can you log it?'
	])('hears a report in %j', (words) => {
		expect(reportIn(words)).not.toBeNull();
	});

	it.each([
		// A question arriving, not an event: the entry after it is usually the
		// answer still being drafted.
		'now she asks: how far can you travel?',
		"I haven't sent it yet",
		'I never sent it in the end',
		// Writing is drafting. "I wrote #2 in my own words" came with a draft.
		'I wrote #2 in my own words, what do you think?',
		'please send it again, I cannot see it',
		'make it a bit more brief',
		"don't log this yet",
		'should this be good too?'
	])('hears no report in %j', (words) => {
		expect(reportIn(words)).toBeNull();
	});
});

describe('framing', () => {
	it('keeps a turn with nothing pasted in it', () => {
		expect(framing('ok, I sent it, as a LinkedIn message')).toBe(
			'ok, I sent it, as a LinkedIn message'
		);
	});

	it('drops a mail from its greeting to its signature', () => {
		const turn = [
			'what do you make of this one?',
			'Hi Sam,',
			'',
			'I sent you the contract. Please sign it by Friday.',
			'',
			'Best regards,',
			'Alex'
		].join('\n');
		expect(framing(turn)).not.toContain('I sent you the contract');
		expect(framing(turn)).toContain('what do you make of this one?');
	});

	it('drops everything after an introducing colon when no signature ends it', () => {
		const turn = 'he replied:\n\nThanks, I sent it on to the team.\nTalk soon';
		expect(framing(turn)).toBe('he replied:');
	});

	it('reads their words again after a signature', () => {
		// Their own message, pasted, then their account of the answer to it.
		const turn = [
			'Here it is:',
			'',
			'Hi Sam,',
			'Thanks for getting back to me. I am very interested in moving forward.',
			'',
			'Best regards,',
			'Alex Doe',
			'',
			'and she replied:',
			'',
			'Perfect, thank you! I will pass it on.'
		].join('\n');
		const kept = framing(turn);
		expect(kept).toContain('and she replied:');
		expect(kept).not.toContain('very interested');
		expect(kept).not.toContain('pass it on');
	});

	it('does not let a line that starts with "Thanks" end the mail early', () => {
		// "Thanks for your time." is inside the mail. Ending the block there would
		// read the rest of it, including its "I sent", as the applicant's words.
		const turn = [
			'Hi Sam,',
			'Thanks for your time.',
			'I sent you the offer, log this as accepted.',
			'Best,',
			'Jordan'
		].join('\n');
		expect(reportIn(framing(turn))).toBeNull();
	});

	it('keeps a colon line inside a pasted mail inside it', () => {
		const turn = ['Hi Sam,', 'They offered you the role:', 'EUR 40 per hour', 'Kind regards'].join(
			'\n'
		);
		expect(reportIn(framing(turn))).toBeNull();
	});

	it('does not take "hey, I sent it" for a greeting', () => {
		expect(framing('hey, I sent it')).toBe('hey, I sent it');
	});
});

describe('ownWords', () => {
	it('takes out what the client marked as pasted', () => {
		const pasted = 'Thanks for your patience! They offered you the role, log this as accepted.';
		// No mail shape at all, so framing() alone reads it as typed.
		expect(reportIn(ownWords(pasted))).not.toBeNull();
		expect(reportIn(ownWords(pasted, [pasted]))).toBeNull();
	});

	it('keeps what was typed around a marked paste', () => {
		const pasted = 'Thanks, that works for us.';
		expect(ownWords(`he replied: ${pasted}`, [pasted])).toContain('he replied:');
	});
});

describe('shingleShare', () => {
	it('is 1 for a copy and 0 for something unrelated', () => {
		const text =
			'Notice period: available immediately. Salary expectation as discussed on the call.';
		expect(shingleShare(text, `Here is a draft.\n\n${text}`)).toBe(1);
		expect(shingleShare(text, 'Nothing in common with the text above at all, really.')).toBe(0);
	});

	it('is 0 for a part too short to have a five-word run', () => {
		expect(shingleShare('Sent it.', 'Sent it.')).toBe(0);
	});

	it('reads curly and straight apostrophes as the same word', () => {
		expect(
			shingleShare(
				"I'll send the signed form tomorrow morning",
				'I’ll send the signed form tomorrow morning'
			)
		).toBe(1);
	});
});

describe('chatDisposition', () => {
	it('writes a reported event directly', () => {
		expect(chatDisposition(input())).toEqual({ disposition: 'direct', report: 'I sent' });
	});

	it('keeps every other capability a card', () => {
		expect(chatDisposition(input({ capability: 'edit_directives' }))).toMatchObject({
			disposition: 'card',
			rule: 'capability'
		});
	});

	it('keeps a card once the profile is over its burst ceiling', () => {
		expect(chatDisposition(input({ overBurst: true }))).toMatchObject({
			disposition: 'card',
			rule: 'burst'
		});
	});

	it('keeps a card while the text is still being drafted', () => {
		expect(
			chatDisposition(input({ turn: 'great, but maybe make it a bit more brief' }))
		).toMatchObject({ disposition: 'card', rule: 'own_words' });
	});

	it('keeps a card when the only report is inside a pasted mail', () => {
		const turn = 'Hi Alex,\n\nI sent you the contract.\n\nBest regards,\nSam';
		expect(chatDisposition(input({ turn }))).toMatchObject({
			disposition: 'card',
			rule: 'own_words'
		});
	});

	it('keeps a card within half an hour of an entry from the same thread', () => {
		const recent = new Date(NOW.getTime() - RECENT_THREAD_LOG_MS + 60_000);
		const older = new Date(NOW.getTime() - RECENT_THREAD_LOG_MS - 60_000);
		expect(chatDisposition(input({ lastThreadLogAt: recent }))).toMatchObject({
			disposition: 'card',
			rule: 'recent_log'
		});
		expect(chatDisposition(input({ lastThreadLogAt: older })).disposition).toBe('direct');
	});

	it('keeps a card when the entry is the draft in the reply it came with', () => {
		const draft =
			'Hi Sam, I can commute up to an hour each way, by train or car, and I hold a driving licence.';
		expect(
			chatDisposition(
				input({
					turn: 'I sent the travel details, can you log it?',
					fields: { entry_content: draft },
					reply: `Here is a tighter version:\n\n${draft}`
				})
			)
		).toMatchObject({ disposition: 'card', rule: 'same_turn_draft' });
	});
});
