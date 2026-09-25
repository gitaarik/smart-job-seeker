/**
 * The model fallback of parseVerificationEmail, which only runs when no
 * pattern matches, and is the part of it that costs tokens.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCharged } = vi.hoisted(() => ({ mockCharged: vi.fn() }));

vi.mock('$lib/server/llm/charged', () => ({ generateChatCompletionCharged: mockCharged }));

import { parseVerificationEmail } from '../verification-parser';

// Nothing here a pattern recognises, so the model is asked.
const subject = 'Almost there';
const body = 'Tap the big button in the app and read out the word shown: ORBIT';

describe('parseVerificationEmail: the model fallback', () => {
	beforeEach(() => {
		mockCharged.mockReset().mockResolvedValue('{"code": "ORBIT", "link": null}');
	});

	it('charges the tokens to the user it is given', async () => {
		const parsed = await parseVerificationEmail(subject, body, null, 'user-7');

		expect(parsed).toEqual({ code: 'ORBIT', link: undefined, confidence: 'medium' });
		expect(mockCharged).toHaveBeenCalledTimes(1);
		expect(mockCharged.mock.calls[0][0]).toBe('user-7');
		expect(mockCharged.mock.calls[0][2]).toMatchObject({ promptKey: 'verification_email' });
	});

	it('charges nobody when it is given nobody', async () => {
		await parseVerificationEmail(subject, body, null);
		expect(mockCharged.mock.calls[0][0]).toBeNull();
	});

	it('never reaches the model when a pattern matches', async () => {
		await parseVerificationEmail(null, 'Your verification code is: 123456', null, 'user-7');
		expect(mockCharged).not.toHaveBeenCalled();
	});
});
