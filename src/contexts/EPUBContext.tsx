'use client';

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useMemo,
} from 'react';
import { indexedDBService } from '@/utils/indexedDB';
import { useTTS } from '@/contexts/TTSContext';

interface EPUBContextType {
  // Current document state
  currDocData: ArrayBuffer | undefined;  // Changed back to currDocData
  currDocName: string | undefined;
  currDocPages: number | undefined;
  currDocPage: number;
  currDocText: string | undefined;
  setCurrentDocument: (id: string) => Promise<void>;
  clearCurrDoc: () => void;

  // EPUB functionality
  onDocumentLoadSuccess: ({ numPages }: { numPages: number }) => void;
}

// Create the context
const EPUBContext = createContext<EPUBContextType | undefined>(undefined);

/**
 * EPUBProvider Component
 * 
 * Main provider component that manages EPUB state and functionality.
 * Handles document loading, text processing, and integration with TTS.
 */
export function EPUBProvider({ children }: { children: ReactNode }) {
  const { setText: setTTSText, currDocPage, currDocPages, setCurrDocPages } = useTTS();

  // Current document state
  const [currDocData, setCurrDocData] = useState<ArrayBuffer>();  // Changed back to currDocData
  const [currDocName, setCurrDocName] = useState<string>();
  const [currDocText, setCurrDocText] = useState<string>();

  /**
   * Handles successful document load
   */
  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    console.log('EPUB loaded:', numPages);
    setCurrDocPages(numPages);
  }, [setCurrDocPages]);

  /**
   * Clears the current document state
   */
  const clearCurrDoc = useCallback(() => {
    setCurrDocData(undefined);
    setCurrDocName(undefined);
    setCurrDocText(undefined);
    setCurrDocPages(undefined);
    setTTSText('');
  }, [setCurrDocPages, setTTSText]);

  /**
   * Sets the current document based on its ID
   */
  const setCurrentDocument = useCallback(async (id: string): Promise<void> => {
    try {
      const doc = await indexedDBService.getEPUBDocument(id);
      if (doc) {
        console.log('Retrieved document size:', doc.size);
        console.log('Retrieved ArrayBuffer size:', doc.data.byteLength);
        
        if (doc.data.byteLength === 0) {
          console.error('Retrieved ArrayBuffer is empty');
          throw new Error('Empty document data');
        }

        setCurrDocName(doc.name);
        setCurrDocData(doc.data);  // Store ArrayBuffer directly
      } else {
        console.error('Document not found in IndexedDB');
      }
    } catch (error) {
      console.error('Failed to get EPUB document:', error);
      clearCurrDoc(); // Clean up on error
    }
  }, [clearCurrDoc]);


  // Context value memoization
  const contextValue = useMemo(
    () => ({
      onDocumentLoadSuccess,
      setCurrentDocument,
      currDocData,  // Changed back to currDocData
      currDocName,
      currDocPages,
      currDocPage,
      currDocText,
      clearCurrDoc,
    }),
    [
      onDocumentLoadSuccess,
      setCurrentDocument,
      currDocData,  // Changed back to currDocData
      currDocName,
      currDocPages,
      currDocPage,
      currDocText,
      clearCurrDoc,
    ]
  );

  return (
    <EPUBContext.Provider value={contextValue}>
      {children}
    </EPUBContext.Provider>
  );
}

/**
 * Custom hook to consume the EPUB context
 * Ensures the context is used within a provider
 */
export function useEPUB() {
  const context = useContext(EPUBContext);
  if (context === undefined) {
    throw new Error('useEPUB must be used within an EPUBProvider');
  }
  return context;
}