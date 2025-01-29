import { useCallback } from 'react';
import nlp from 'compromise';
import stringSimilarity from 'string-similarity';
import { usePDFHighlighting } from './usePDFHighlighting';

export function usePDFTextClick() {
  const { highlightPattern, findBestTextMatch } = usePDFHighlighting();

  /**
   * Handles text click events in the PDF viewer
   * Integrates with TTS for synchronized playback
   * 
   * @param {MouseEvent} event - The click event
   * @param {string} pdfText - The text content of the page
   * @param {RefObject} containerRef - Reference to the container element
   * @param {Function} stopAndPlayFromIndex - Function to control TTS playback
   * @param {boolean} isProcessing - Whether TTS is currently processing
   */
  const handleTextClick = useCallback((
    event: MouseEvent,
    pdfText: string,
    containerRef: React.RefObject<HTMLDivElement>,
    stopAndPlayFromIndex: (index: number) => void,
    isProcessing: boolean
  ) => {
    if (isProcessing) return;

    const target = event.target as HTMLElement;
    if (!target.matches('.react-pdf__Page__textContent span')) return;

    const parentElement = target.closest('.react-pdf__Page__textContent');
    if (!parentElement) return;

    const spans = Array.from(parentElement.querySelectorAll('span'));
    const clickedIndex = spans.indexOf(target);
    const contextWindow = 3;
    const startIndex = Math.max(0, clickedIndex - contextWindow);
    const endIndex = Math.min(spans.length - 1, clickedIndex + contextWindow);
    const contextText = spans
      .slice(startIndex, endIndex + 1)
      .map((span) => span.textContent)
      .join(' ')
      .trim();

    if (!contextText?.trim()) return;

    const cleanContext = contextText.trim().replace(/\s+/g, ' ');
    const allText = Array.from(parentElement.querySelectorAll('span')).map((node) => ({
      element: node as HTMLElement,
      text: (node.textContent || '').trim(),
    })).filter((node) => node.text.length > 0);

    const bestMatch = findBestTextMatch(allText, cleanContext, cleanContext.length * 2);
    const similarityThreshold = bestMatch.lengthDiff < cleanContext.length * 0.3 ? 0.3 : 0.5;

    if (bestMatch.rating >= similarityThreshold) {
      const matchText = bestMatch.text;
      const sentences = nlp(pdfText).sentences().out('array') as string[];
      let bestSentenceMatch = { sentence: '', rating: 0 };

      for (const sentence of sentences) {
        const rating = stringSimilarity.compareTwoStrings(matchText, sentence);
        if (rating > bestSentenceMatch.rating) {
          bestSentenceMatch = { sentence, rating };
        }
      }

      if (bestSentenceMatch.rating >= 0.5) {
        const sentenceIndex = sentences.findIndex((sentence) => sentence === bestSentenceMatch.sentence);
        if (sentenceIndex !== -1) {
          stopAndPlayFromIndex(sentenceIndex);
          highlightPattern(pdfText, bestSentenceMatch.sentence, containerRef);
        }
      }
    }
  }, [highlightPattern, findBestTextMatch]);

  return {
    handleTextClick,
  };
}
