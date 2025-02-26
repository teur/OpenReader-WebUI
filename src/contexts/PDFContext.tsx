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
  createFullAudioBook: (onProgress: (progress: number) => void, signal?: AbortSignal, format?: 'mp3' | 'm4b') => Promise<ArrayBuffer>;
  isAudioCombining: boolean;
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
    rightMargin,
    apiKey,
    baseUrl,
    voiceSpeed,
    voice,
  } = useConfig();

  // Current document state
  const [currDocURL, setCurrDocURL] = useState<string>();
  const [currDocName, setCurrDocName] = useState<string>();
  const [currDocText, setCurrDocText] = useState<string>();
  const [pdfDocument, setPdfDocument] = useState<PDFDocumentProxy>();
  const [isAudioCombining, setIsAudioCombining] = useState(false);

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

  /**
   * Creates a complete audiobook by processing all PDF pages through NLP and TTS
   * @param {Function} onProgress - Callback for progress updates
   * @param {AbortSignal} signal - Optional signal for cancellation
   * @param {string} format - Optional format for the audiobook ('mp3' or 'm4b')
   * @returns {Promise<ArrayBuffer>} The complete audiobook as an ArrayBuffer
   */
  const createFullAudioBook = useCallback(async (
    onProgress: (progress: number) => void,
    signal?: AbortSignal,
    format: 'mp3' | 'm4b' = 'mp3'
  ): Promise<ArrayBuffer> => {
    try {
      if (!pdfDocument) {
        throw new Error('No PDF document loaded');
      }

      // First pass: extract and measure all text
      const textPerPage: string[] = [];
      let totalLength = 0;
      
      for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
        const text = await extractTextFromPDF(pdfDocument, pageNum, {
          header: headerMargin,
          footer: footerMargin,
          left: leftMargin,
          right: rightMargin
        });
        const trimmedText = text.trim();
        if (trimmedText) {
          textPerPage.push(trimmedText);
          totalLength += trimmedText.length;
        }
      }

      if (totalLength === 0) {
        throw new Error('No text content found in PDF');
      }

      const audioChunks: { buffer: ArrayBuffer; title?: string; startTime: number }[] = [];
      let processedLength = 0;
      let currentTime = 0;

      // Second pass: process text into audio
      for (let i = 0; i < textPerPage.length; i++) {
        if (signal?.aborted) {
          const partialBuffer = await combineAudioChunks(audioChunks, format);
          return partialBuffer;
        }

        const text = textPerPage[i];
        try {
          const ttsResponse = await fetch('/api/tts', {
            method: 'POST',
            headers: {
              'x-openai-key': apiKey,
              'x-openai-base-url': baseUrl,
            },
            body: JSON.stringify({
              text,
              voice: voice,
              speed: voiceSpeed,
              format: format === 'm4b' ? 'aac' : 'mp3'
            }),
            signal
          });

          if (!ttsResponse.ok) {
            throw new Error(`TTS processing failed with status ${ttsResponse.status}`);
          }

          const audioBuffer = await ttsResponse.arrayBuffer();
          if (audioBuffer.byteLength === 0) {
            throw new Error('Received empty audio buffer from TTS');
          }

          audioChunks.push({
            buffer: audioBuffer,
            title: `Page ${i + 1}`,
            startTime: currentTime
          });

          // Add a small pause between pages (1s of silence)
          const silenceBuffer = new ArrayBuffer(48000);
          audioChunks.push({
            buffer: silenceBuffer,
            startTime: currentTime + (audioBuffer.byteLength / 48000)
          });

          currentTime += (audioBuffer.byteLength + 48000) / 48000;

          // Update progress based on processed text length
          processedLength += text.length;
          onProgress((processedLength / totalLength) * 100);

        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('TTS request aborted');
            const partialBuffer = await combineAudioChunks(audioChunks, format);
            return partialBuffer;
          }
          console.error('Error processing page:', error);
        }
      }

      if (audioChunks.length === 0) {
        throw new Error('No audio was generated from the PDF content');
      }

      return combineAudioChunks(audioChunks, format);
    } catch (error) {
      console.error('Error creating audiobook:', error);
      throw error;
    }
  }, [pdfDocument, headerMargin, footerMargin, leftMargin, rightMargin, apiKey, baseUrl, voice, voiceSpeed]);

  const combineAudioChunks = async (
    audioChunks: { buffer: ArrayBuffer; title?: string; startTime: number }[],
    format: 'mp3' | 'm4b'
  ): Promise<ArrayBuffer> => {
    setIsAudioCombining(true);
    try {
      if (format === 'm4b') {
        // Convert to M4B format using the audio conversion API
        const response = await fetch('/api/audio/convert', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            chapters: audioChunks
              .filter(chunk => chunk.title) // Only include chunks with titles
              .map(chunk => ({
                title: chunk.title,
                buffer: Array.from(new Uint8Array(chunk.buffer))
              }))
          }),
        });

        if (!response.ok) {
          throw new Error('Failed to convert audio to M4B format');
        }

        return response.arrayBuffer();
      }

      // For MP3, just concatenate the buffers
      const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.buffer.byteLength, 0);
      const combinedBuffer = new Uint8Array(totalLength);

      let offset = 0;
      for (const chunk of audioChunks) {
        combinedBuffer.set(new Uint8Array(chunk.buffer), offset);
        offset += chunk.buffer.byteLength;
      }

      return combinedBuffer.buffer;
    } finally {
      setIsAudioCombining(false);
    }
  }

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
      createFullAudioBook,
      isAudioCombining,
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
      createFullAudioBook,
      isAudioCombining,
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