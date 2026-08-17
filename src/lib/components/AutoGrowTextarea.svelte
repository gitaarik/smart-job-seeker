<script lang="ts">
	import type { HTMLTextareaAttributes } from 'svelte/elements';

	interface Props extends HTMLTextareaAttributes {
		/** Bindable text value. */
		value?: string;
		/** Minimum visible rows before the field starts growing. */
		minRows?: number;
		/** Cap the growth at this many rows, then scroll (unbounded if omitted). */
		maxRows?: number;
	}

	let { value = $bindable(''), minRows = 1, maxRows, ...rest }: Props = $props();

	let el = $state<HTMLTextAreaElement>();

	// Reset to auto so scrollHeight reflects the content (not the previous height),
	// then grow the element to fit — capped at maxRows with scroll beyond that.
	function resize() {
		const node = el;
		if (!node) return;
		node.style.height = 'auto';
		let next = node.scrollHeight;
		if (maxRows != null) {
			const cs = getComputedStyle(node);
			const lineHeight = parseFloat(cs.lineHeight) || 20;
			const extra =
				parseFloat(cs.paddingTop) +
				parseFloat(cs.paddingBottom) +
				parseFloat(cs.borderTopWidth) +
				parseFloat(cs.borderBottomWidth);
			const max = lineHeight * maxRows + extra;
			node.style.overflowY = next > max ? 'auto' : 'hidden';
			next = Math.min(next, max);
		} else {
			node.style.overflowY = 'hidden';
		}
		node.style.height = `${next}px`;
	}

	// Re-measure on every value change — covers typing, paste, and programmatic
	// updates (e.g. a form reset or the parent setting a new value).
	$effect(() => {
		void value;
		resize();
	});

	// A width change re-wraps the text, so a value-only effect would leave a
	// stale height until the next keystroke — with overflowY hidden that clips
	// content outright. Covers window resizes, layout shifts and being moved
	// into another container (e.g. a modal portalled to <body>).
	$effect(() => {
		const node = el;
		if (!node) return;
		// jsdom has no ResizeObserver; there the value effect above is all we get.
		if (typeof ResizeObserver === 'undefined') return;
		// Guard on width: resize() writes height, which would otherwise re-enter.
		let lastWidth = -1;
		const ro = new ResizeObserver((entries) => {
			const width = entries[0]?.contentRect.width ?? 0;
			if (width === lastWidth) return;
			lastWidth = width;
			resize();
		});
		ro.observe(node);
		return () => ro.disconnect();
	});
</script>

<textarea bind:this={el} bind:value rows={minRows} style="resize: none;" {...rest}></textarea>
