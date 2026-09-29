/**
 * The label over an AI turn comes from its version row's source, which records
 * the path that wrote it rather than what it is. A message sent after advice
 * (typed, or the "Write a version from this advice" button) goes down the
 * revision path, so the first version it writes is stored as `ai_revision`,
 * and a connected app's writes are all `agent_revision`. Both were labelled
 * "revised" on a first version, with nothing before it to revise.
 */
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import ConversationTimeline from './ConversationTimeline.svelte';
import type { ConversationEntry, TurnLabels } from '$lib/server/ai-chat/entity-versions';

// Scrolling to the latest turn after a navigation; there is no router here.
vi.mock('$app/navigation', () => ({ afterNavigate: () => {} }));

const LABELS: TurnLabels = {
	manual_edit: 'Manual edit',
	ai_generation: 'AI drafted answer',
	ai_advice: 'AI recommendations',
	ai_review: 'AI review',
	ai_revision: 'AI revised answer',
	agent_revision: 'Connected app revised answer',
	agent_draft: 'Connected app drafted answer'
};

let nextId = 1;
function turn(t: Omit<ConversationEntry, 'versionId' | 'date'>): ConversationEntry {
	return { versionId: nextId++, date: null, ...t };
}

function renderTimeline(conversation: ConversationEntry[]) {
	const noop = async () => {};
	render(ConversationTimeline, {
		conversation,
		aiChatId: 1,
		placeholder: '',
		labels: LABELS,
		onGenerate: noop,
		onReview: noop,
		onSendFollowup: noop,
		onSaveVersion: noop,
		autoMode: true
	});
}

describe('ConversationTimeline turn labels', () => {
	it('labels a first version written after advice as a draft', () => {
		renderTimeline([
			turn({ type: 'ai_advice', aiFeedback: 'Lead with the migration.' }),
			turn({ type: 'ai_revision', aiFeedback: 'Led with it.', content: 'Draft one.' })
		]);

		expect(screen.getByText('AI drafted answer')).toBeTruthy();
		expect(screen.queryByText('AI revised answer')).toBeNull();
	});

	it('still labels a change to an earlier version as a revision', () => {
		renderTimeline([
			turn({ type: 'manual_edit', content: 'My own wording.' }),
			turn({
				type: 'ai_revision',
				aiFeedback: 'Tightened it.',
				content: 'Draft two.',
				userRequest: 'Make it shorter.'
			})
		]);

		expect(screen.getByText('AI revised answer')).toBeTruthy();
	});

	it('labels a first version a connected app wrote as its draft', () => {
		renderTimeline([
			turn({ type: 'agent_revision', aiFeedback: 'Wrote it from the job post.', content: 'One.' })
		]);

		expect(screen.getByText('Connected app drafted answer')).toBeTruthy();
		expect(screen.queryByText('Connected app revised answer')).toBeNull();
	});

	it("still labels a connected app's change to an earlier version as a revision", () => {
		renderTimeline([
			turn({ type: 'manual_edit', content: 'My own wording.' }),
			turn({ type: 'agent_revision', aiFeedback: 'Cut it down.', content: 'Two.' })
		]);

		expect(screen.getByText('Connected app revised answer')).toBeTruthy();
	});
});

describe('ConversationTimeline changes view', () => {
	// The diff renders as a <pre> of insertions and strikethroughs; the text
	// itself goes through the editor, which renders none.
	const diff = () => document.querySelector('pre');

	it('shows the newest version as its text until "Show changes" is clicked', async () => {
		// One word apart, under a fifth of the characters: below the 30% at which
		// a change used to open as a diff by itself.
		renderTimeline([
			turn({
				type: 'manual_edit',
				content: 'Moved our billing service from MySQL to Postgres last spring, with no downtime.'
			}),
			turn({
				type: 'manual_edit',
				content: 'Moved our billing service from MySQL to Postgres last summer, with no downtime.'
			})
		]);

		expect(diff()).toBeNull();
		expect(screen.queryAllByRole('button', { name: 'Hide changes' })).toHaveLength(0);

		await fireEvent.click(screen.getAllByRole('button', { name: 'Show changes' })[0]);
		expect(diff()?.textContent).toContain('summer');

		await fireEvent.click(screen.getAllByRole('button', { name: 'Hide changes' })[0]);
		expect(diff()).toBeNull();
	});
});
