/**
 * PDF Context Provider
 * 
 * This module provides a React context for managing PDF document functionality.
 * It handles document loading, text extraction, highlighting, and integration with TTS.
 * 
 * Key features:
 * - PDF document management (add/remove/load)
 * - Text extraction and processing
 * - Text highlighting and navigation
 * - Document state management
 */

'use client';

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useCallback,
  useMemo,
} from 'react';
import { indexedDBService, type PDFDocument } from '@/services/indexedDB';
import { v4 as uuidv4 } from 'uuid';
import { pdfjs } from 'react-pdf';
import stringSimilarity from 'string-similarity';
import nlp from 'compromise';

// Add the correct type import
import type { TextItem } from 'pdfjs-dist/types/src/display/api';
import { useConfig } from '@/contexts/ConfigContext';
import { useTTS } from '@/contexts/TTSContext';

// Set worker from public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

/**
 * Converts PDF binary data to a data URL for display
 * 
 * @param {Blob} pdfData - The PDF binary data
 * @returns {Promise<string>} A data URL representing the PDF
 */
const convertPDFDataToURL = (pdfData: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(pdfData);
  });
};

/**
 * Interface defining all available methods and properties in the PDF context
 */
interface PDFContextType {
  // Documents management
  documents: PDFDocument[];
  addDocument: (file: File) => Promise<string>;
  removeDocument: (id: string) => Promise<void>;
  isLoading: boolean;

  // Current document state
  currDocURL: string | undefined;
  currDocName: string | undefined;
  currDocPages: number | undefined;
  currDocPage: number;
  currDocText: string | undefined;
  setCurrentDocument: (id: string) => Promise<void>;
  clearCurrDoc: () => void;

  // PDF functionality
  onDocumentLoadSuccess: ({ numPages }: { numPages: number }) => void;
  highlightPattern: (text: string, pattern: string, containerRef: React.RefObject<HTMLDivElement>) => void;
  clearHighlights: () => void;
  handleTextClick: (
    event: MouseEvent,
    pdfText: string,
    containerRef: React.RefObject<HTMLDivElement>,
    stopAndPlayFromIndex: (index: number) => void,
    isProcessing: boolean
  ) => void;
}

// Create the context
const PDFContext = createContext<PDFContextType | undefined>(undefined);

/**
 * PDFProvider Component
 * 
 * Main provider component that manages PDF state and functionality.
 * Handles document loading, text processing, and integration with TTS.
 */
export function PDFProvider({ children }: { children: ReactNode }) {
  /**
   * State Management
   * - Document management
   * - Current document state
   * - Loading states
   */
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { isDBReady } = useConfig();
  const {
    setText: setTTSText,
    currDocPage,
    currDocPages,
    setCurrDocPages,
  } = useTTS();

  // Current document state
  const [currDocURL, setCurrDocURL] = useState<string>();
  const [currDocName, setCurrDocName] = useState<string>();
  const [currDocText, setCurrDocText] = useState<string>();

  /**
   * Load documents from IndexedDB when the database is ready
   */
  useEffect(() => {
    const loadDocuments = async () => {
      if (!isDBReady) return;

      try {
        const docs = await indexedDBService.getAllDocuments();
        setDocuments(docs);
      } catch (error) {
        console.error('Failed to load documents:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadDocuments();
  }, [isDBReady]);

  /**
   * Adds a new document to IndexedDB
   * 
   * @param {File} file - The PDF file to add
   * @returns {Promise<string>} The ID of the added document
   */
  const addDocument = useCallback(async (file: File): Promise<string> => {
    const id = uuidv4();
    const newDoc: PDFDocument = {
      id,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      data: new Blob([file], { type: file.type }),
    };

    try {
      await indexedDBService.addDocument(newDoc);
      setDocuments((prev) => [...prev, newDoc]);
      return id;
    } catch (error) {
      console.error('Failed to add document:', error);
      throw error;
    }
  }, []);

  /**
   * Removes a document from IndexedDB
   * 
   * @param {string} id - The ID of the document to remove
   */
  const removeDocument = useCallback(async (id: string): Promise<void> => {
    try {
      await indexedDBService.removeDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch (error) {
      console.error('Failed to remove document:', error);
      throw error;
    }
  }, []);

  /**
   * Handles successful document load
   * 
   * @param {Object} param0 - Object containing numPages
   */
  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    console.log('Document loaded:', numPages);
    setCurrDocPages(numPages);
  }, [setCurrDocPages]);

  /**
   * Extracts text content from a specific page of the PDF
   * 
   * @param {string} pdfURL - The URL of the PDF
   * @param {number} currDocPage - The page number to extract
   * @returns {Promise<string>} The extracted text
   */
  const extractTextFromPDF = useCallback(async (pdfURL: string, currDocPage: number): Promise<string> => {
    try {
      const base64Data = pdfURL.split(',')[1];
      const binaryData = atob(base64Data);
      const bytes = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }

      const loadingTask = pdfjs.getDocument({ data: bytes });
      const pdf = await loadingTask.promise;

      // Get only the specified page
      const page = await pdf.getPage(currDocPage);
      const textContent = await page.getTextContent();

      // Filter out non-text items and assert proper type
      const textItems = textContent.items.filter((item): item is TextItem =>
        'str' in item && 'transform' in item
      );

      // Group text items into lines based on their vertical position
      const tolerance = 2;
      const lines: TextItem[][] = [];
      let currentLine: TextItem[] = [];
      let currentY: number | null = null;

      textItems.forEach((item) => {
        const y = item.transform[5];
        if (currentY === null) {
          currentY = y;
          currentLine.push(item);
        } else if (Math.abs(y - currentY) < tolerance) {
          currentLine.push(item);
        } else {
          lines.push(currentLine);
          currentLine = [item];
          currentY = y;
        }
      });
      lines.push(currentLine);

      // Process each line to build text
      let pageText = '';
      for (const line of lines) {
        // Sort items horizontally within the line
        line.sort((a, b) => a.transform[4] - b.transform[4]);

        let lineText = '';
        let prevItem: TextItem | null = null;

        for (const item of line) {
          if (!prevItem) {
            lineText = item.str;
          } else {
            const prevEndX = prevItem.transform[4] + (prevItem.width ?? 0);
            const currentStartX = item.transform[4];
            const space = currentStartX - prevEndX;

            // Add space if gap is significant, otherwise concatenate directly
            if (space > ((item.width ?? 0) * 0.3)) {
              lineText += ' ' + item.str;
            } else {
              lineText += item.str;
            }
          }
          prevItem = item;
        }
        pageText += lineText + ' ';
      }

      return pageText.replace(/\s+/g, ' ').trim();
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }, []);

  /**
   * Loads and processes text from the current document page
   */
  const loadCurrDocText = useCallback(async () => {
    try {
      if (!currDocURL) return;
      const text = await extractTextFromPDF(currDocURL, currDocPage);
      setCurrDocText(text);
      setTTSText(text);
    } catch (error) {
      console.error('Error loading PDF text:', error);
    }
  }, [currDocURL, currDocPage, extractTextFromPDF, setTTSText]);

  /**
   * Updates the current document text when the page changes
   */
  useEffect(() => {
    if (currDocURL) {
      loadCurrDocText();
    }
  }, [currDocPage, currDocURL, loadCurrDocText]);

  /**
   * Sets the current document based on its ID
   * 
   * @param {string} id - The ID of the document to set
   */
  const setCurrentDocument = useCallback(async (id: string): Promise<void> => {
    try {
      const doc = await indexedDBService.getDocument(id);
      if (doc) {
        const url = await convertPDFDataToURL(doc.data);
        setCurrDocName(doc.name);
        setCurrDocURL(url);
        //await loadCurrDocText();
      }
    } catch (error) {
      console.error('Failed to get document URL:', error);
    }
  }, [indexedDBService]);

  /**
   * Clears the current document state
   */
  const clearCurrDoc = useCallback(() => {
    setCurrDocName(undefined);
    setCurrDocURL(undefined);
    setCurrDocText(undefined);

    // Clear TTS text
    setCurrDocPages(undefined); // Goes to TTS context
    setTTSText('');

  }, [setCurrDocPages, setTTSText]);

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
  ) => {
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
  const highlightPattern = useCallback((text: string, pattern: string, containerRef: React.RefObject<HTMLDivElement>) => {
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
    pdfText: string, // Renamed from pdfText to pageText for clarity
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
      // Use pageText instead of full PDF text for sentence splitting
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

  // Context value memoization
  const contextValue = useMemo(
    () => ({
      documents,
      addDocument,
      removeDocument,
      isLoading,
      onDocumentLoadSuccess,
      setCurrentDocument,
      currDocURL,
      currDocName,
      currDocPages,
      currDocPage,
      currDocText,
      clearCurrDoc,
      highlightPattern,
      clearHighlights,
      handleTextClick,
    }),
    [
      documents,
      addDocument,
      removeDocument,
      isLoading,
      onDocumentLoadSuccess,
      setCurrentDocument,
      currDocURL,
      currDocName,
      currDocPages,
      currDocPage,
      currDocText,
      clearCurrDoc,
      highlightPattern,
      clearHighlights,
      handleTextClick,
    ]
  );

  return (
    <PDFContext.Provider value={contextValue}>
      {children}
    </PDFContext.Provider>
  );
}

/**
 * Custom hook to consume the PDF context
 * Ensures the context is used within a provider
 * 
 * @throws {Error} If used outside of PDFProvider
 * @returns {PDFContextType} The PDF context value
 */
export function usePDF() {
  const context = useContext(PDFContext);
  if (context === undefined) {
    throw new Error('usePDF must be used within a PDFProvider');
  }
  return context;
}