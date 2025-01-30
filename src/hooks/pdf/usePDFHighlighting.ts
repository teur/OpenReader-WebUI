import { useCallback } from 'react';
import stringSimilarity from 'string-similarity';

interface TextMatch {
  elements: HTMLElement[];
  rating: number;
  text: string;
  lengthDiff: number;
}

export function usePDFHighlighting() {
  /**
   * Removes all text highlights from the PDF viewer
   */
  const clearHighlights = useCallback(() => {
    const textNodes = document.querySelectorAll('.react-pdf__Page__textContent span');
    textNodes.forEach((node) => {
      const element = node as HTMLElement;
      element.style.backgroundColor = '';
      element.style.opacity = '1';
    });
  }, []);

  /**
   * Finds the best matching text segment using string similarity
   * 
   * @param {Array} elements - Array of elements and their text content
   * @param {string} targetText - The text to match against
   * @param {number} maxCombinedLength - Maximum length of combined text to consider
   */
  const findBestTextMatch = useCallback((
    elements: Array<{ element: HTMLElement; text: string }>,
    targetText: string,
    maxCombinedLength: number
  ): TextMatch => {
    let bestMatch = {
      elements: [] as HTMLElement[],
      rating: 0,
      text: '',
      lengthDiff: Infinity,
    };

    for (let i = 0; i < elements.length; i++) {
      let combinedText = '';
      const currentElements = [];
      for (let j = i; j < Math.min(i + 10, elements.length); j++) {
        const node = elements[j];
        const newText = combinedText ? `${combinedText} ${node.text}` : node.text;
        if (newText.length > maxCombinedLength) break;

        combinedText = newText;
        currentElements.push(node.element);

        const similarity = stringSimilarity.compareTwoStrings(targetText, combinedText);
        const lengthDiff = Math.abs(combinedText.length - targetText.length);
        const lengthPenalty = lengthDiff / targetText.length;
        const adjustedRating = similarity * (1 - lengthPenalty * 0.5);

        if (adjustedRating > bestMatch.rating) {
          bestMatch = {
            elements: [...currentElements],
            rating: adjustedRating,
            text: combinedText,
            lengthDiff,
          };
        }
      }
    }

    return bestMatch;
  }, []);

  /**
   * Highlights matching text in the PDF viewer
   * Uses a sliding context window for improved accuracy
   * 
   * @param {string} text - The document text
   * @param {string} pattern - The pattern to highlight
   * @param {RefObject} containerRef - Reference to the container element
   */
  const highlightPattern = useCallback((
    text: string,
    pattern: string,
    containerRef: React.RefObject<HTMLDivElement>
  ) => {
    clearHighlights();

    if (!pattern?.trim()) return;

    const cleanPattern = pattern.trim().replace(/\s+/g, ' ');
    const container = containerRef.current;
    if (!container) return;

    const textNodes = container.querySelectorAll('.react-pdf__Page__textContent span');
    const allText = Array.from(textNodes).map((node) => ({
      element: node as HTMLElement,
      text: (node.textContent || '').trim(),
    })).filter((node) => node.text.length > 0);

    // Calculate the visible area of the container
    const containerRect = container.getBoundingClientRect();
    const visibleTop = container.scrollTop;
    const visibleBottom = visibleTop + containerRect.height;

    // Find nodes within the visible area and a buffer zone
    const bufferSize = containerRect.height; // One screen height buffer
    const visibleNodes = allText.filter(({ element }) => {
      const rect = element.getBoundingClientRect();
      const elementTop = rect.top - containerRect.top + container.scrollTop;
      return elementTop >= (visibleTop - bufferSize) && elementTop <= (visibleBottom + bufferSize);
    });

    // Search for the best match within the visible area first
    let bestMatch = findBestTextMatch(visibleNodes, cleanPattern, cleanPattern.length * 2);

    // If no good match found in visible area, search the entire document
    if (bestMatch.rating < 0.3) {
      bestMatch = findBestTextMatch(allText, cleanPattern, cleanPattern.length * 2);
    }

    const similarityThreshold = bestMatch.lengthDiff < cleanPattern.length * 0.3 ? 0.3 : 0.5;

    if (bestMatch.rating >= similarityThreshold) {
      bestMatch.elements.forEach((element) => {
        element.style.backgroundColor = 'grey';
        element.style.opacity = '0.4';
      });

      if (bestMatch.elements.length > 0) {
        const element = bestMatch.elements[0];
        const elementRect = element.getBoundingClientRect();
        const elementTop = elementRect.top - containerRect.top + container.scrollTop;

        // Only scroll if the element is outside the visible area
        if (elementTop < visibleTop || elementTop > visibleBottom) {
          container.scrollTo({
            top: elementTop - containerRect.height / 3, // Position the highlight in the top third
            behavior: 'smooth',
          });
        }
      }
    }
  }, [clearHighlights, findBestTextMatch]);

  return {
    highlightPattern,
    clearHighlights,
    findBestTextMatch,
  };
}
