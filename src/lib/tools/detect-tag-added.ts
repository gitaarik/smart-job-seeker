export function detectTagAdded(targetElement: HTMLElement, tagName: string, callback: CallableFunction) {

  const observer = new MutationObserver((mutations) => {
    // Check each mutation for added nodes
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        // Check if any added node or its descendants contain an <iframe>
        mutation.addedNodes.forEach((node) => {
          // Only process element nodes (skip text nodes, etc.)
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if node itself is an iframe or contains an iframe
            if (node.tagName.toLowerCase() === tagName.toLowerCase() || node.querySelector('iframe')) {
              callback();
            }
          }
        });
      }
    });
  });

  const config = {
    childList: true, // Watch for addition/removal of child nodes
    subtree: true,   // Watch the entire subtree of the target element
  };

  observer.observe(targetElement, config);
}
