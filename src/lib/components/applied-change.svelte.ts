import { onDestroy } from 'svelte';

/**
 * Mounting an editor again after the assistant's change to it is applied.
 *
 * `ProposalCard` applies an edit the assistant proposed and then reloads `data`
 * with `invalidateAll()`, because the page behind the chat panel is very often
 * the record that just changed. That is enough for a page which derives what it
 * shows from `data`. It is not enough for an auto-saving editor: those seed
 * their fields, the fields' auto-save baselines and their row stores from
 * `data` once, at mount, and own them from then on. After an applied proposal
 * such a page went on showing the old value, and an edit to it was then
 * refused by the `expected` check, or, where a save sends no `expected`,
 * quietly wrote the old value back.
 *
 * Re-seeding every field, baseline and store in step with a new `data` is a lot
 * of machinery to get right for a rare moment, and the page already has one
 * correct way to start from `data`: being mounted. So an editor calls
 * `remountOnAppliedChange()` while it initialises, and after an applied
 * proposal the dashboard layout mounts it again. A page that follows `data`
 * by itself, or holds unsaved text in an explicit form (a story, a letter),
 * does not opt in, and a proposal applied from the panel leaves it alone.
 */

let editors = 0;
let epoch = $state(0);

/** Opt the page being initialised into a fresh mount after an applied proposal. */
export function remountOnAppliedChange(): void {
	editors++;
	onDestroy(() => {
		editors--;
	});
}

/** Call once `data` holds the applied change, i.e. after `invalidateAll()`. */
export function afterAppliedChange(): void {
	if (editors > 0) epoch++;
}

/** What the dashboard layout keys its page on. */
export function appliedChangeEpoch(): number {
	return epoch;
}
