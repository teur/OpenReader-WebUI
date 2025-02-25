'use client';

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useMemo,
  useRef,
  RefObject,
} from 'react';
import { indexedDBService } from '@/utils/indexedDB';
import { useTTS } from '@/contexts/TTSContext';
import { Book, Rendition } from 'epubjs';
import { createRangeCfi } from '@/utils/epub';
import type { NavItem } from 'epubjs';
import { setLastDocumentLocation } from '@/utils/indexedDB';
import { SpineItem } from 'epubjs/types/section';
import { useParams } from 'next/navigation';
import { useConfig } from './ConfigContext';

interface EPUBContextType {
  currDocData: ArrayBuffer | undefined;
  currDocName: string | undefined;
  currDocPages: number | undefined;
  currDocPage: number | string;
  currDocText: string | undefined;
  setCurrentDocument: (id: string) => Promise<void>;
  clearCurrDoc: () => void;
  extractPageText: (book: Book, rendition: Rendition, shouldPause?: boolean) => Promise<string>;
  createFullAudioBook: (onProgress: (progress: number) => void, signal?: AbortSignal) => Promise<ArrayBuffer>;
  bookRef: RefObject<Book | null>;
  renditionRef: RefObject<Rendition | undefined>;
  tocRef: RefObject<NavItem[]>;
  locationRef: RefObject<string | number>;
  handleLocationChanged: (location: string | number) => void;
  setRendition: (rendition: Rendition) => void;
}

const EPUBContext = createContext<EPUBContextType | undefined>(undefined);

/**
 * Provider component for EPUB functionality
 * Manages the state and operations for EPUB document handling
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components to be wrapped by the provider
 */
export function EPUBProvider({ children }: { children: ReactNode }) {
  const { setText: setTTSText, currDocPage, currDocPages, setCurrDocPages, stop, skipToLocation, setIsEPUB } = useTTS();
  const { id } = useParams();
  // Configuration context to get TTS settings
  const {
    apiKey,
    baseUrl,
    voiceSpeed,
    voice,
  } = useConfig();
  // Current document state
  const [currDocData, setCurrDocData] = useState<ArrayBuffer>();
  const [currDocName, setCurrDocName] = useState<string>();
  const [currDocText, setCurrDocText] = useState<string>();

  // Add new refs
  const bookRef = useRef<Book | null>(null);
  const renditionRef = useRef<Rendition | undefined>(undefined);
  const tocRef = useRef<NavItem[]>([]);
  const locationRef = useRef<string | number>(currDocPage);
  const isEPUBSetOnce = useRef(false);

  /**
   * Clears all current document state and stops any active TTS
   */
  const clearCurrDoc = useCallback(() => {
    setCurrDocData(undefined);
    setCurrDocName(undefined);
    setCurrDocText(undefined);
    setCurrDocPages(undefined);
    stop();
  }, [setCurrDocPages, stop]);

  /**
   * Sets the current document based on its ID by fetching from IndexedDB
   * @param {string} id - The unique identifier of the document
   * @throws {Error} When document data is empty or retrieval fails
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

  /**
   * Extracts text content from the current EPUB page/location
   * @param {Book} book - The EPUB.js Book instance
   * @param {Rendition} rendition - The EPUB.js Rendition instance
   * @param {boolean} shouldPause - Whether to pause TTS
   * @returns {Promise<string>} The extracted text content
   */
  const extractPageText = useCallback(async (book: Book, rendition: Rendition, shouldPause = false): Promise<string> => {
    try {
      const { start, end } = rendition?.location;
      if (!start?.cfi || !end?.cfi || !book || !book.isOpen || !rendition) return '';

      const rangeCfi = createRangeCfi(start.cfi, end.cfi);

      const range = await book.getRange(rangeCfi);
      const textContent = range.toString().trim();

      setTTSText(textContent, shouldPause);
      setCurrDocText(textContent);

      return textContent;
    } catch (error) {
      console.error('Error extracting EPUB text:', error);
      return '';
    }
  }, [setTTSText]);

  /**
   * Extracts text content from the entire EPUB book
   * @returns {Promise<string[]>} Array of text content from each section
   */
  const extractBookText = useCallback(async (): Promise<string[]> => {
    try {
      if (!bookRef.current || !bookRef.current.isOpen) return [''];

      const book = bookRef.current;
      const spine = book.spine;
      const promises: Promise<string>[] = [];

      spine.each((item: SpineItem) => {
        const url = item.href || '';
        if (!url) return;

        const promise = book.load(url)
          .then((section) => (section as Document))
          .then((section) => {
            const textContent = section.body.textContent || '';
            return textContent;
          })
          .catch((err) => {
            console.error(`Error loading section ${url}:`, err);
            return '';
          });

        promises.push(promise);
      });

      const textArray = await Promise.all(promises);
      const filteredArray = textArray.filter(text => text.trim() !== '');
      console.log('Extracted entire EPUB text array:', filteredArray);
      return filteredArray;
    } catch (error) {
      console.error('Error extracting EPUB text:', error);
      return [''];
    }
  }, []);

  /**
   * Creates a complete audiobook by processing all text through NLP and TTS
   * @param {string} voice - The voice to use for TTS
   * @param {number} speed - The speed to use for TTS
   * @returns {Promise<ArrayBuffer>} The complete audiobook as an ArrayBuffer
   */
  const createFullAudioBook = useCallback(async (
    onProgress: (progress: number) => void,
    signal?: AbortSignal
  ): Promise<ArrayBuffer> => {
    try {
      // Get all text content from the book
      const textArray = await extractBookText();
      if (!textArray.length) throw new Error('No text content found in book');

      // Create an array to store all audio chunks
      const audioChunks: ArrayBuffer[] = [];
      let processedSections = 0;
      const totalSections = textArray.length;

      // Process each section of text
      for (const text of textArray) {
        // Check for cancellation
        if (signal?.aborted) {
          const partialBuffer = combineAudioChunks(audioChunks);
          return partialBuffer;
        }

        if (!text.trim()) {
          processedSections++;
          continue;
        }

        try {
          const ttsResponse = await fetch('/api/tts', {
            method: 'POST',
            headers: {
              'x-openai-key': apiKey,
              'x-openai-base-url': baseUrl,
            },
            body: JSON.stringify({
              text: text.trim(),
              voice: voice,
              speed: voiceSpeed,
            }),
            signal // Pass the AbortSignal to the fetch request
          });

          if (!ttsResponse.ok) {
            throw new Error(`TTS processing failed with status ${ttsResponse.status}`);
          }

          const audioBuffer = await ttsResponse.arrayBuffer();
          if (audioBuffer.byteLength === 0) {
            throw new Error('Received empty audio buffer from TTS');
          }

          audioChunks.push(audioBuffer);

          // Add a small pause between sections (1s of silence)
          const silenceBuffer = new ArrayBuffer(48000);
          audioChunks.push(silenceBuffer);

        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') {
            console.log('TTS request aborted');
            const partialBuffer = combineAudioChunks(audioChunks);
            return partialBuffer;
          }
          console.error('Error processing section:', error);
        }

        processedSections++;
        onProgress((processedSections / totalSections) * 100);
      }

      if (audioChunks.length === 0) {
        throw new Error('No audio was generated from the book content');
      }

      return combineAudioChunks(audioChunks);
    } catch (error) {
      console.error('Error creating audiobook:', error);
      throw error;
    }
  }, [extractBookText, apiKey, baseUrl, voice, voiceSpeed]);

  // Helper function to combine audio chunks
  const combineAudioChunks = (audioChunks: ArrayBuffer[]): ArrayBuffer => {
    const totalLength = audioChunks.reduce((acc, chunk) => acc + chunk.byteLength, 0);
    const combinedBuffer = new Uint8Array(totalLength);

    let offset = 0;
    for (const chunk of audioChunks) {
      combinedBuffer.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    return combinedBuffer.buffer;
  };

  const setRendition = useCallback((rendition: Rendition) => {
    bookRef.current = rendition.book;
    renditionRef.current = rendition;
  }, []);

  const handleLocationChanged = useCallback((location: string | number) => {
    // Set the EPUB flag once the location changes
    if (!isEPUBSetOnce.current) {
      setIsEPUB(true);
      isEPUBSetOnce.current = true;

      renditionRef.current?.display(location.toString());
      return;
    }

    if (!bookRef.current?.isOpen || !renditionRef.current) return;

    // Handle special 'next' and 'prev' cases
    if (location === 'next' && renditionRef.current) {
      renditionRef.current.next();
      return;
    }
    if (location === 'prev' && renditionRef.current) {
      renditionRef.current.prev();
      return;
    }

    // Save the location to IndexedDB if not initial
    if (id && locationRef.current !== 1) {
      console.log('Saving location:', location);
      setLastDocumentLocation(id as string, location.toString());
    }

    skipToLocation(location);

    locationRef.current = location;
    if (bookRef.current && renditionRef.current) {
      extractPageText(bookRef.current, renditionRef.current);
    }
  }, [id, skipToLocation, extractPageText, setIsEPUB]);

  // Context value memoization
  const contextValue = useMemo(
    () => ({
      setCurrentDocument,
      currDocData,
      currDocName,
      currDocPages,
      currDocPage,
      currDocText,
      clearCurrDoc,
      extractPageText,
      createFullAudioBook,
      bookRef,
      renditionRef,
      tocRef,
      locationRef,
      handleLocationChanged,
      setRendition,
    }),
    [
      setCurrentDocument,
      currDocData,
      currDocName,
      currDocPages,
      currDocPage,
      currDocText,
      clearCurrDoc,
      extractPageText,
      createFullAudioBook,
      handleLocationChanged,
      setRendition,
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
 * @returns {EPUBContextType} The EPUB context value
 * @throws {Error} When used outside of EPUBProvider
 */
export function useEPUB() {
  const context = useContext(EPUBContext);
  if (context === undefined) {
    throw new Error('useEPUB must be used within an EPUBProvider');
  }
  return context;
}