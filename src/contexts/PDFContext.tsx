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

import { indexedDBService } from '@/utils/indexedDB';
import { useTTS } from '@/contexts/TTSContext';
import {
  extractTextFromPDF,
  convertPDFDataToURL,
  highlightPattern,
  clearHighlights,
  handleTextClick,
} from '@/utils/pdf';

/**
 * Interface defining all available methods and properties in the PDF context
 */
interface PDFContextType {
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
  const { setText: setTTSText, stop, currDocPageNumber: currDocPage, currDocPages, setCurrDocPages } = useTTS();

  // Current document state
  const [currDocURL, setCurrDocURL] = useState<string>();
  const [currDocName, setCurrDocName] = useState<string>();
  const [currDocText, setCurrDocText] = useState<string>();

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
  }, [currDocURL, currDocPage, setTTSText]);

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
      }
    } catch (error) {
      console.error('Failed to get document URL:', error);
    }
  }, []);

  /**
   * Clears the current document state
   */
  const clearCurrDoc = useCallback(() => {
    setCurrDocName(undefined);
    setCurrDocURL(undefined);
    setCurrDocText(undefined);
    setCurrDocPages(undefined);
    stop();
  }, [setCurrDocPages, stop]);

  // Context value memoization
  const contextValue = useMemo(
    () => ({
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
      onDocumentLoadSuccess,
      setCurrentDocument,
      currDocURL,
      currDocName,
      currDocPages,
      currDocPage,
      currDocText,
      clearCurrDoc,
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