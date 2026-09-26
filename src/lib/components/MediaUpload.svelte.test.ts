import { describe, expect, test } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/svelte';
import MediaUpload from './MediaUpload.svelte';

/**
 * The full-size preview: what closes it and what does not.
 *
 * The backdrop is a real button behind the image rather than a click handler on
 * the dialog wrapper, so it has a keyboard story (Escape, via portalToBody) and
 * the image needs no handler of its own to stay open when clicked.
 */

const openPreview = async () => {
	render(MediaUpload, {
		props: { entityType: 'profile', entityId: 1, field: 'photo', currentUrl: '/uploads/x.png' }
	});
	await fireEvent.click(screen.getByRole('button', { name: 'View full image' }));
};

const preview = () => screen.queryByRole('dialog', { name: 'Image preview' });

describe('MediaUpload preview', () => {
	test('a click on the image leaves it open', async () => {
		await openPreview();
		await fireEvent.click(screen.getByAltText('Full preview'));
		expect(preview()).not.toBeNull();
	});

	test('a click on the backdrop closes it', async () => {
		await openPreview();
		const [backdrop] = screen.getAllByRole('button', { name: 'Close preview' });
		await fireEvent.click(backdrop);
		expect(preview()).toBeNull();
	});

	test('Escape closes it', async () => {
		await openPreview();
		await fireEvent.keyDown(window, { key: 'Escape' });
		expect(preview()).toBeNull();
	});
});
