'use client';

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { PDFSkeleton } from './PDFSkeleton';
import { useTTS } from '@/context/TTSContext';
import stringSimilarity from 'string-similarity';

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
  const { setText, currentSentence } = useTTS();
  const [pdfText, setPdfText] = useState('');
  const [highlights, setHighlights] = useState<TextHighlight[]>([]);
  const [pdfDataUrl, setPdfDataUrl] = useState<string>();
  const [loadingError, setLoadingError] = useState<string>();

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
      // Split content into chunks roughly the size of the search text
      const chunkSize = searchText.length + 20; // Add some padding
      const chunks: string[] = [];
      
      // Ensure we have valid content to split
      const cleanContent = content.trim();
      if (cleanContent.length < chunkSize) {
        chunks.push(cleanContent);
      } else {
        for (let i = 0; i < cleanContent.length - chunkSize; i += chunkSize / 2) {
          const chunk = cleanContent.slice(i, i + chunkSize).trim();
          if (chunk) {
            chunks.push(chunk);
          }
        }
      }

      // Ensure we have valid chunks before matching
      if (chunks.length === 0) {
        return null;
      }

      // Find the best matching chunk
      const matches = stringSimilarity.findBestMatch(searchText.trim(), chunks);
      return matches.bestMatch.rating >= 0.5 ? matches.bestMatch : null;
    } catch (error) {
      console.error('Error in findBestMatch:', error);
      return null;
    }
  }, []);

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

    // Get all text nodes
    const textNodes = document.querySelectorAll('.react-pdf__Page__textContent span');
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
    const similarityThreshold = bestMatch.lengthDiff < patternLength * 0.3 ? 0.4 : 0.6;
    
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
    } else {
      console.log('No good match found:', {
        bestRating: bestMatch.rating,
        bestText: bestMatch.text,
        threshold: similarityThreshold
      });
    }
  }, [clearHighlights]);

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

  return (
    <div className="flex flex-col items-center">
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
