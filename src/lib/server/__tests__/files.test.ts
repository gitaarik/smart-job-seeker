import { describe, expect, it } from 'vitest';
import { isSupportedUpload } from '../files';

// MCP's request_file_upload refuses any name isSupportedUpload does not know,
// while the Activity tab's form takes any file. A type the app reads has to
// pass here too, or an agent is refused a file the applicant could have
// dropped in by hand: .eml was, until 2026-11-08.
describe('isSupportedUpload', () => {
	it('takes an email, in any case', () => {
		expect(isSupportedUpload('Invitation.eml')).toBe(true);
		expect(isSupportedUpload('INVITE.EML')).toBe(true);
	});

	it('refuses a name the store cannot type', () => {
		expect(isSupportedUpload('setup.exe')).toBe(false);
		expect(isSupportedUpload('no-extension')).toBe(false);
	});
});
