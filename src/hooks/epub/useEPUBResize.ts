import { useEffect, RefObject } from 'react';

export function useEPUBResize(
  containerRef: RefObject<HTMLDivElement | null>,
  isResizing: RefObject<boolean>
) {
  useEffect(() => {
    let resizeTimeout: NodeJS.Timeout;
    
    const resizeObserver = new ResizeObserver((entries) => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        console.log('Resizing detected (debounced)', entries[0].contentRect);
        isResizing.current = true;
      }, 250);
    });

    const mutationObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.addedNodes.length) {
          const container = containerRef.current?.querySelector('.epub-container');
          if (container) {
            console.log('Observer attached to epub-container');
            resizeObserver.observe(container);
            mutationObserver.disconnect();
            break;
          }
        }
      }
    });

    if (containerRef.current) {
      mutationObserver.observe(containerRef.current, {
        childList: true,
        subtree: true
      });

      const container = containerRef.current.querySelector('.epub-container');
      if (container) {
        console.log('Container already exists, attaching observer');
        resizeObserver.observe(container);
        mutationObserver.disconnect();
      }
    }

    return () => {
      clearTimeout(resizeTimeout);
      mutationObserver.disconnect();
      resizeObserver.disconnect();
    };
  }, [containerRef, isResizing]);
}