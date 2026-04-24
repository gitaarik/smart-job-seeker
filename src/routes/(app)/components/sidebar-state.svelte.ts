export const sidebarState = $state({ mobileOpen: false });

/** Shared overlay state — set `onclose` to show the overlay, clear it to hide. */
export const overlayState = $state<{ onclose: (() => void) | null }>({ onclose: null });
