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
  RefObject,
} from 'react';

import { indexedDBService } from '@/utils/indexedDB';
import { useTTS } from '@/contexts/TTSContext';
import { useConfig } from '@/contexts/ConfigContext';
import {
  extractTextFromPDF,
  convertPDFDataToURL,
  highlightPattern,
  clearHighlights,
  handleTextClick,
} from '@/utils/pdf';

import type { PDFDocumentProxy } from 'pdfjs-dist';

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
  pdfDocument: PDFDocumentProxy | undefined;
  setCurrentDocument: (id: string) => Promise<void>;
  clearCurrDoc: () => void;

  // PDF functionality
  onDocumentLoadSuccess: (pdf: PDFDocumentProxy) => void;
  highlightPattern: (text: string, pattern: string, containerRef: RefObject<HTMLDivElement>) => void;
  clearHighlights: () => void;
  handleTextClick: (
    event: MouseEvent,
    pdfText: string,
    containerRef: RefObject<HTMLDivElement>,
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
 * 
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components to be wrapped by the provider
 */
export function PDFProvider({ children }: { children: ReactNode }) {
  const { 
    setText: setTTSText, 
    stop, 
    currDocPageNumber: currDocPage, 
    currDocPages, 
    setCurrDocPages 
  } = useTTS();
  const { 
    headerMargin,
    footerMargin,
    leftMargin,
    rightMargin
  } = useConfig();

  // Current document state
  const [currDocURL, setCurrDocURL] = useState<string>();
  const [currDocName, setCurrDocName] = useState<string>();
  const [currDocText, setCurrDocText] = useState<string>();
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy>();

  /**
   * Handles successful PDF document load
   * 
   * @param {PDFDocumentProxy} pdf - The loaded PDF document proxy object
   */
  const onDocumentLoadSuccess = useCallback((pdf: PDFDocumentProxy) => {
    console.log('Document loaded:', pdf.numPages);
    setCurrDocPages(pdf.numPages);
    setPdfDocument(pdf);
  }, [setCurrDocPages]);

  /**
   * Loads and processes text from the current document page
   * Extracts text from the PDF and updates both document text and TTS text states
   * 
   * @returns {Promise<void>}
   */
  const loadCurrDocText = useCallback(async () => {
    try {
      if (!pdfDocument) return;
      const text = await extractTextFromPDF(pdfDocument, currDocPage, {
        header: headerMargin,
        footer: footerMargin,
        left: leftMargin,
        right: rightMargin
      });
      // Only update TTS text if the content has actually changed
      // This prevents unnecessary resets of the sentence index
      if (text !== currDocText || text === '') {
        setCurrDocText(text);
        setTTSText(text);
      }
    } catch (error) {
      console.error('Error loading PDF text:', error);
    }
  }, [pdfDocument, currDocPage, setTTSText, currDocText, headerMargin, footerMargin, leftMargin, rightMargin]);

  /**
   * Effect hook to update document text when the page changes
   * Triggers text extraction and processing when either the document URL or page changes
   */
  useEffect(() => {
    if (currDocURL) {
      loadCurrDocText();
    }
  }, [currDocPage, currDocURL, loadCurrDocText]);

  /**
   * Sets the current document based on its ID
   * Retrieves document from IndexedDB and converts it to a viewable URL
   * 
   * @param {string} id - The unique identifier of the document to set
   * @returns {Promise<void>}
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
   * Resets all document-related states and stops any ongoing TTS playback
   */
  const clearCurrDoc = useCallback(() => {
    setCurrDocName(undefined);
    setCurrDocURL(undefined);
    setCurrDocText(undefined);
    setCurrDocPages(undefined);
    setPdfDocument(undefined);
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
      pdfDocument,
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
      pdfDocument,
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
 * @returns {PDFContextType} The PDF context value containing all PDF-related functionality
 */
export function usePDF() {
  const context = useContext(PDFContext);
  if (context === undefined) {
    throw new Error('usePDF must be used within a PDFProvider');
  }
  return context;
}