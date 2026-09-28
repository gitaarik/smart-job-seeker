/**
 * The label over an AI turn comes from its version row's source, which records
 * the path that wrote it rather than what it is. A message sent after advice
 * (typed, or the "Write a version from this advice" button) goes down the
 * revision path, so the first version it writes is stored as `ai_revision`,
 * and was labelled "AI revised answer" with nothing before it to revise.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/svelte';
import ConversationTimeline from './ConversationTimeline.svelte';
import type { ConversationEntry, VersionSource } from '$lib/server/ai-chat/entity-versions';

// Scrolling to the latest turn after a navigation; there is no router here.
vi.mock('$app/navigation', () => ({ afterNavigate: () => {} }));

const LABELS: Record<VersionSource, string> = {
	manual_edit: 'Manual edit',
	ai_generation: 'AI drafted answer',
	ai_advice: 'AI recommendations',
	ai_review: 'AI review',
	ai_revision: 'AI revised answer',
	agent_revision: 'Connected app revised answer'
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
});
