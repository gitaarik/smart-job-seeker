/**
 * Modal wrapper action: moves the node to <body> so its `fixed inset-0`
 * resolves against the viewport (the `(app)` layout's `<main>` traps `fixed`
 * descendants), wires up an Escape-to-close handler on `window` (a wrapper-
 * level `onkeydown` would never fire because focus stays on whatever opened
 * the modal), and applies a class that pads the modal down below the fixed
 * header so it stays visually centered below the app chrome on desktop.
 */
import type { Action } from "svelte/action";

export interface PortalToBodyParams {
  onClose?: () => void;
}

export const portalToBody: Action<HTMLElement, PortalToBodyParams | undefined> = (
  node,
  initialParams,
) => {
  let params = initialParams;
  document.body.appendChild(node);
  node.classList.add("app-modal-portaled");

  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") params?.onClose?.();
  };
  window.addEventListener("keydown", onKey);

  return {
    update(newParams: PortalToBodyParams | undefined) {
      params = newParams;
    },
    destroy() {
      window.removeEventListener("keydown", onKey);
      node.remove();
    },
  };
};
