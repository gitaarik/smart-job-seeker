import type { Action } from 'svelte/action';

/**
 * Arm an auto-save field on the first genuine user interaction within `node`.
 *
 * Pairs with `autoSaveField({ armOnInteraction: true })`: until the user
 * actually touches the form, a value the *browser* wrote into a bound input —
 * form restoration after a dev reload, autofill — must not be persisted. Only
 * `pointerdown`/`keydown` arm it; both bubble and neither fires from value
 * restoration or autofill (which some browsers surface as an `input` event,
 * hence its deliberate absence). Over-arming is harmless: a set() still saves
 * only a value that differs from the field's baseline.
 *
 *   <div use:armOn={field.arm}> … </div>
 *   <div use:armOn={() => { a.arm(); b.arm(); }}> … </div>
 */
export const armOn: Action<HTMLElement, () => void> = (node, arm) => {
	let current = arm;
	const handler = () => current();
	node.addEventListener('pointerdown', handler);
	node.addEventListener('keydown', handler);
	return {
		update(next: () => void) {
			current = next;
		},
		destroy() {
			node.removeEventListener('pointerdown', handler);
			node.removeEventListener('keydown', handler);
		}
	};
};
