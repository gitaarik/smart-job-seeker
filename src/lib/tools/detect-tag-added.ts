export function detectTagAdded(targetElement: HTMLElement, tagName: string, callback: CallableFunction) {

  const observer = new MutationObserver((mutations) => {
    // Check each mutation for added nodes
    mutations.forEach((mutation) => {
      if (mutation.addedNodes.length) {
        // Check if any added node or its descendants contain `tagName`
        mutation.addedNodes.forEach((node: Node) => {
          // Only process element nodes (skip text nodes, etc.)
          if (node.nodeType === Node.ELEMENT_NODE) {
            const element = node as HTMLElement; // Type assertion to HTMLElement
            // Check if node itself is `tagName` or contains `tagName`
            if (element.tagName.toLowerCase() === tagName.toLowerCase() || element.querySelector(tagName)) {
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
