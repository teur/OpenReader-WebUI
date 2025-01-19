'use client';

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { PDFSkeleton } from './PDFSkeleton';
import { useTTS } from '@/context/TTSContext';
import stringSimilarity from 'string-similarity';
import nlp from 'compromise';

// Set worker from public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

interface PDFViewerProps {
  pdfData: Blob | undefined;
}

interface TextHighlight {
  pageIndex: number;
  content: string;
  position: {
    boundingRect: DOMRect;
  };
}

export function PDFViewer({ pdfData }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>();
  const { setText, currentSentence, stopAndPlayFromIndex, sentences } = useTTS();
  const [pdfText, setPdfText] = useState('');
  const [highlights, setHighlights] = useState<TextHighlight[]>([]);
  const [pdfDataUrl, setPdfDataUrl] = useState<string>();
  const [loadingError, setLoadingError] = useState<string>();
  const containerRef = useRef<HTMLDivElement>(null);

  // Convert Blob to data URL when pdfData changes
  useEffect(() => {
    if (!pdfData) return;

    const reader = new FileReader();
    reader.onload = () => {
      setPdfDataUrl(reader.result as string);
    };
    reader.onerror = () => {
      console.error('Error reading file:', reader.error);
      setLoadingError('Failed to load PDF');
    };
    reader.readAsDataURL(pdfData);

    return () => {
      setPdfDataUrl(undefined);
    };
  }, [pdfData]);

  // Load PDF text content
  useEffect(() => {
    if (!pdfDataUrl) return;

    let isCurrentPdf = true;
    let currentLoadingTask: any = null;
    setLoadingError(undefined);

    const loadPdfText = async () => {
      try {
        // Create a typed array from the base64 data
        const base64Data = pdfDataUrl.split(',')[1];
        const binaryData = atob(base64Data);
        const length = binaryData.length;
        const bytes = new Uint8Array(length);
        
        for (let i = 0; i < length; i++) {
          bytes[i] = binaryData.charCodeAt(i);
        }

        const loadingTask = pdfjs.getDocument({
          data: bytes,
          disableAutoFetch: true,
          disableStream: false,
        });
        
        currentLoadingTask = loadingTask;
        const pdf = await loadingTask.promise;
        
        if (!isCurrentPdf) return;

        let fullText = '';
        for (let i = 1; i <= pdf.numPages; i++) {
          if (!isCurrentPdf) break;
          
          const page = await pdf.getPage(i);
          const textContent = await page.getTextContent();
          const pageText = textContent.items
            .map((item: any) => item.str)
            .join(' ');
          fullText += pageText + ' ';
        }
        
        if (!isCurrentPdf) return;

        console.log('Loaded PDF text sample:', fullText.substring(0, 100));
        setPdfText(fullText);
        setText(fullText);
      } catch (error) {
        if (!isCurrentPdf) return;
        console.error('Error loading PDF text:', error);
        setLoadingError('Failed to extract PDF text');
      }
    };

    loadPdfText();

    return () => {
      isCurrentPdf = false;
      if (currentLoadingTask) {
        currentLoadingTask.destroy();
      }
      setPdfText('');
    };
  }, [pdfDataUrl, setText]);

  // Function to clear all highlights
  const clearHighlights = useCallback(() => {
    const textNodes = document.querySelectorAll('.react-pdf__Page__textContent span');
    textNodes.forEach((node) => {
      const element = node as HTMLElement;
      element.style.backgroundColor = '';
      element.style.opacity = '1';
    });
  }, []);

  function onDocumentLoadSuccess({ numPages }: { numPages: number }): void {
    setNumPages(numPages);
  }

  const findBestMatch = useCallback((searchText: string, content: string) => {
    if (!searchText?.trim() || !content?.trim()) {
      return null;
    }

    try {
      // Ensure we have valid sentences before matching
      if (sentences.length === 0) {
        return null;
      }

      // Find the best matching sentence
      const matches = stringSimilarity.findBestMatch(searchText.trim(), sentences);
      return matches.bestMatch.rating >= 0.5 ? matches.bestMatch : null;
    } catch (error) {
      console.error('Error in findBestMatch:', error);
      return null;
    }
  }, [sentences]);

  const highlightPattern = useCallback((text: string, pattern: string) => {
    console.log('Highlighting pattern:', pattern);
    
    // Always clear existing highlights first
    clearHighlights();

    if (!pattern?.trim()) {
      console.log('No pattern to highlight');
      return;
    }

    // Clean up the pattern
    const cleanPattern = pattern.trim().replace(/\s+/g, ' ');
    const patternLength = cleanPattern.length;
    console.log('Clean pattern:', cleanPattern, 'Length:', patternLength);

    // Get all text nodes within the container
    const container = containerRef.current;
    if (!container) return;

    const textNodes = container.querySelectorAll('.react-pdf__Page__textContent span');
    const allText = Array.from(textNodes).map(node => ({
      element: node as HTMLElement,
      text: (node.textContent || '').trim()
    })).filter(node => node.text.length > 0); // Remove empty nodes

    // Find the best matching position
    let bestMatch = {
      elements: [] as HTMLElement[],
      rating: 0,
      text: '',
      lengthDiff: Infinity
    };

    // Try different combinations of consecutive spans
    for (let i = 0; i < allText.length; i++) {
      let combinedText = '';
      let currentElements = [];
      
      // Look ahead up to 10 spans, but stop if we exceed 2x pattern length
      for (let j = i; j < Math.min(i + 10, allText.length); j++) {
        const node = allText[j];
        const newText = combinedText + (combinedText ? ' ' : '') + node.text;
        
        // Stop if we're getting too far from target length
        if (newText.length > patternLength * 2) {
          break;
        }

        combinedText = newText;
        currentElements.push(node.element);

        // Calculate similarity and length difference
        const similarity = stringSimilarity.compareTwoStrings(cleanPattern, combinedText);
        const lengthDiff = Math.abs(combinedText.length - patternLength);

        // Score based on both similarity and length difference
        const lengthPenalty = lengthDiff / patternLength; // Normalized length difference
        const adjustedRating = similarity * (1 - lengthPenalty * 0.5); // Reduce score based on length difference

        // console.log('Comparing:', {
        //   text: combinedText,
        //   similarity,
        //   lengthDiff,
        //   adjustedRating
        // });

        // Update best match if we have better adjusted rating
        if (adjustedRating > bestMatch.rating) {
          bestMatch = {
            elements: [...currentElements],
            rating: adjustedRating,
            text: combinedText,
            lengthDiff
          };
        }
      }
    }

    // Only highlight if we found a good match
    // Adjust threshold based on match quality
    const similarityThreshold = bestMatch.lengthDiff < patternLength * 0.3 ? 0.3 : 0.5;
    
    if (bestMatch.rating >= similarityThreshold) {
      console.log('Found match:', {
        rating: bestMatch.rating,
        text: bestMatch.text,
        lengthDiff: bestMatch.lengthDiff,
        threshold: similarityThreshold
      });
      
      bestMatch.elements.forEach(element => {
        element.style.backgroundColor = 'yellow';
        element.style.opacity = '0.4';
      });

      // Scroll the first highlighted element into view with a slight delay
      if (bestMatch.elements.length > 0) {
        setTimeout(() => {
          const element = bestMatch.elements[0];
          const container = containerRef.current;
          if (!container || !element) return;

          // Calculate the element's position relative to the container
          const containerRect = container.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          
          // Scroll the container
          container.scrollTo({
            top: container.scrollTop + (elementRect.top - containerRect.top) - containerRect.height / 2,
            behavior: 'smooth'
          });
        }, 100);
      }
    } else {
      console.log('No good match found:', {
        bestRating: bestMatch.rating,
        bestText: bestMatch.text,
        threshold: similarityThreshold
      });
    }
  }, [clearHighlights]);

  // Function to handle text span clicks
  const handleTextClick = useCallback((event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (!target.matches('.react-pdf__Page__textContent span')) return;

    // Get surrounding text for context (combine nearby spans)
    const parentElement = target.closest('.react-pdf__Page__textContent');
    if (!parentElement) return;

    const spans = Array.from(parentElement.querySelectorAll('span'));
    const clickedIndex = spans.indexOf(target);
    
    // Get text from clicked span and several spans before/after for context
    const contextWindow = 3;
    const startIndex = Math.max(0, clickedIndex - contextWindow);
    const endIndex = Math.min(spans.length - 1, clickedIndex + contextWindow);
    
    const contextText = spans
      .slice(startIndex, endIndex + 1)
      .map(span => span.textContent)
      .join(' ')
      .trim();

    if (!contextText?.trim()) return;

    // Clean up the context text
    const cleanContext = contextText.trim().replace(/\s+/g, ' ');
    const contextLength = cleanContext.length;

    // Get all text nodes within the container
    const allText = Array.from(parentElement.querySelectorAll('span')).map(node => ({
      element: node as HTMLElement,
      text: (node.textContent || '').trim()
    })).filter(node => node.text.length > 0);

    // Find the best matching position using the same logic as highlightPattern
    let bestMatch = {
      elements: [] as HTMLElement[],
      rating: 0,
      text: '',
      lengthDiff: Infinity
    };

    // Try different combinations of consecutive spans
    for (let i = 0; i < allText.length; i++) {
      let combinedText = '';
      let currentElements = [];
      
      // Look ahead up to 10 spans, but stop if we exceed 2x context length
      for (let j = i; j < Math.min(i + 10, allText.length); j++) {
        const node = allText[j];
        const newText = combinedText + (combinedText ? ' ' : '') + node.text;
        
        // Stop if we're getting too far from target length
        if (newText.length > contextLength * 2) {
          break;
        }

        combinedText = newText;
        currentElements.push(node.element);

        // Calculate similarity and length difference
        const similarity = stringSimilarity.compareTwoStrings(cleanContext, combinedText);
        const lengthDiff = Math.abs(combinedText.length - contextLength);

        // Score based on both similarity and length difference
        const lengthPenalty = lengthDiff / contextLength;
        const adjustedRating = similarity * (1 - lengthPenalty * 0.5);

        if (adjustedRating > bestMatch.rating) {
          bestMatch = {
            elements: [...currentElements],
            rating: adjustedRating,
            text: combinedText,
            lengthDiff
          };
        }
      }
    }

    // Only proceed if we found a good match
    const similarityThreshold = bestMatch.lengthDiff < contextLength * 0.3 ? 0.3 : 0.5;
    
    if (bestMatch.rating >= similarityThreshold) {
      // Find the corresponding sentence in the full text
      const matchText = bestMatch.text;
      const sentences = nlp(pdfText).sentences().out('array') as string[];
      
      // Find the sentence that best matches our chunk
      let bestSentenceMatch = {
        sentence: '',
        rating: 0
      };

      for (const sentence of sentences) {
        const rating = stringSimilarity.compareTwoStrings(matchText, sentence);
        if (rating > bestSentenceMatch.rating) {
          bestSentenceMatch = { sentence, rating };
        }
      }

      console.log('Best matched sentence:', bestSentenceMatch.sentence);
      console.log('Match rating:', bestSentenceMatch.rating);

      if (bestSentenceMatch.rating >= 0.5) {
        // Update TTS context to this sentence and start playing
        const sentenceIndex = sentences.findIndex(sentence => sentence === bestSentenceMatch.sentence);
        console.log('Calculated sentence index:', sentenceIndex);
        if (sentenceIndex !== -1) {
          stopAndPlayFromIndex(sentenceIndex);
          highlightPattern(pdfText, bestSentenceMatch.sentence);
        }
      }
    }
  }, [pdfText, stopAndPlayFromIndex, highlightPattern]);

  // Add click event listener to the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('click', handleTextClick);
    return () => {
      container.removeEventListener('click', handleTextClick);
    };
  }, [handleTextClick]);

  // Update highlights when current sentence changes
  useEffect(() => {
    console.log('Current sentence changed:', currentSentence);
    
    const highlightTimeout = setTimeout(() => {
      highlightPattern(pdfText, currentSentence || '');
    }, 100); // Quick response for TTS

    // Clear highlights when effect is cleaned up
    return () => {
      clearTimeout(highlightTimeout);
      clearHighlights();
    };
  }, [pdfText, currentSentence, highlightPattern, clearHighlights]);

  // Add useEffect for initializing click styles
  useEffect(() => {
    const addClickStyles = () => {
      const style = document.createElement('style');
      style.textContent = `
        .react-pdf__Page__textContent span {
          cursor: pointer;
          transition: background-color 0.2s ease;
        }
        .react-pdf__Page__textContent span:hover {
          background-color: rgba(255, 255, 0, 0.2) !important;
        }
      `;
      document.head.appendChild(style);
    };

    addClickStyles();

    return () => {
      // Remove any styles with the same selectors on cleanup
      const styles = document.querySelectorAll('style');
      styles.forEach(style => {
        if (style.textContent?.includes('react-pdf__Page__textContent')) {
          style.remove();
        }
      });
    };
  }, []);

  return (
    <div 
      ref={containerRef} 
      className="flex flex-col items-center overflow-auto max-h-[calc(100vh-100px)]"
      style={{ WebkitTapHighlightColor: 'transparent' }} // Remove tap highlight on mobile
    >
      {loadingError ? (
        <div className="text-red-500 mb-4">{loadingError}</div>
      ) : null}
      <Document 
        loading={<PDFSkeleton />}
        noData={<PDFSkeleton />}
        file={pdfDataUrl}
        onLoadSuccess={onDocumentLoadSuccess}
        className="flex flex-col items-center"
      >
        {Array.from(
          new Array(numPages),
          (el, index) => (
            <div key={`page_${index + 1}`}>
              <div className="bg-offbase my-4 px-2 py-0.5 rounded-full w-fit">
                <p className="text-xs">
                  {index + 1} / {numPages}
                </p>
              </div>
              <div className="flex justify-center">
                <Page
                  pageNumber={index + 1}
                  renderAnnotationLayer={true}
                  renderTextLayer={true}
                  className="shadow-lg"
                  scale={1.2}
                />
              </div>
            </div>
          ),
        )}
      </Document>
    </div>
  );
}
