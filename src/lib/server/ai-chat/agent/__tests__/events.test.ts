/** What the panel is told a tool call is about: ids and titles, never values or results. */
import { describe, expect, it } from 'vitest';
import { describeRead, describeToolCall } from '../events';

describe('describeToolCall', () => {
	it('names a read by what it reads and the ids it names', () => {
		expect(
			describeToolCall({ name: 'read_activity_entry', args: { application_id: 83, entry_id: 164 } })
		).toBe('Reading entry 164 of application 83');
		expect(describeToolCall({ name: 'read_job', args: { job_id: 7 } })).toBe('Reading job 7');
		expect(describeToolCall({ name: 'list_applications', args: {} })).toBe(
			'Listing their applications'
		);
		expect(
			describeToolCall({ name: 'read_profile_section', args: { section: 'work_experience' } })
		).toBe('Reading their work experience');
	});

	it('names a write by the title of the change it proposes', () => {
		expect(
			describeToolCall({ name: 'edit_job_details', args: { job_id: 1, salary_min: 120000 } })
		).toMatch(/^Proposing a change: /);
		expect(describeToolCall({ name: 'edit_job_details', args: { job_id: 1 } })).not.toContain(
			'120000'
		);
	});

	it('falls back to the name for a tool it does not know', () => {
		expect(describeToolCall({ name: 'something_else', args: {} })).toBe('something_else');
	});
});

describe('describeRead', () => {
	it('is the subject alone, for the line under the reply', () => {
		expect(describeRead({ name: 'read_application', args: { application_id: 93 } })).toBe(
			'application 93'
		);
		expect(describeRead({ name: 'list_jobs', args: {} })).toBe('their jobs');
	});
});
