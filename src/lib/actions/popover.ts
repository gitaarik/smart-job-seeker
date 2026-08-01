/**
 * Anchored-popover helpers, shared by the inline editors (the profile skills
 * editor and the job page's add-skill popover).
 *
 * Both render the popover as an `absolute` child of a `relative` trigger
 * wrapper rather than portalling it — these popovers are small and live inside
 * normally-flowing cards, so they don't hit the `(app)` layout's fixed-position
 * containing-block trap that modals do.
 */

/**
 * Keep an anchored popover inside the viewport: shift it back in when it
 * overflows an edge, and on mobile pin it to the bottom of the screen instead.
 */
export function keepInView(node: HTMLElement) {
  const isMobile = window.innerWidth < 640;

  function reposition() {
    const margin = 8;
    const vw = window.innerWidth;

    if (isMobile) {
      // On mobile: use fixed positioning, full-width at bottom of viewport
      node.style.position = "fixed";
      node.style.left = `${margin}px`;
      node.style.right = `${margin}px`;
      node.style.bottom = `${margin}px`;
      node.style.top = "auto";
      node.style.width = `${vw - margin * 2}px`;
      node.style.maxHeight = "70vh";
      node.style.overflowY = "auto";
      return;
    }

    // Reset to default positioning
    node.style.left = "0";
    node.style.right = "auto";
    node.style.width = "";

    const rect = node.getBoundingClientRect();

    if (rect.width >= vw - margin * 2) {
      // Popup wider than viewport — constrain to viewport width
      const parentRect = node.offsetParent!.getBoundingClientRect();
      node.style.left = `${-parentRect.left + margin}px`;
      node.style.width = `${vw - margin * 2}px`;
    } else if (rect.right > vw - margin) {
      // Overflows right — shift left
      const overflow = rect.right - (vw - margin);
      node.style.left = `${-overflow}px`;
    } else if (rect.left < margin) {
      // Overflows left — shift right
      const shift = margin - rect.left;
      node.style.left = `${shift}px`;
    }
  }
  reposition();

  // Re-check when popup content changes size (e.g. tags added/removed)
  const ro = new ResizeObserver(() => reposition());
  ro.observe(node);

  return {
    destroy() {
      ro.disconnect();
    },
  };
}

/**
 * Call `onOutside` when a click lands outside the node. The listener is armed
 * on the next tick so the click that opened the popover doesn't close it again.
 */
export function clickOutside(node: HTMLElement, onOutside: () => void) {
  let handler = onOutside;

  function onClick(event: MouseEvent) {
    if (!node.contains(event.target as Node)) handler();
  }

  const timer = setTimeout(() => {
    document.addEventListener("click", onClick, true);
  }, 0);

  return {
    update(next: () => void) {
      handler = next;
    },
    destroy() {
      clearTimeout(timer);
      document.removeEventListener("click", onClick, true);
    },
  };
}
