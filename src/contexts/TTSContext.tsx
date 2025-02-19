/**
 * Text-to-Speech (TTS) Context Provider
 * 
 * This module provides a React context for managing text-to-speech functionality.
 * It handles audio playback, sentence processing, and integration with OpenAI's TTS API.
 * 
 * Key features:
 * - Audio playback control (play/pause/skip)
 * - Sentence-by-sentence processing
 * - Audio caching for better performance
 * - Voice and speed control
 * - Document navigation
 */

'use client';

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
  ReactNode,
} from 'react';
import OpenAI from 'openai';
import { Howl } from 'howler';
import toast from 'react-hot-toast';
import { useParams } from 'next/navigation';

import { useConfig } from '@/contexts/ConfigContext';
import { audioBufferToURL } from '@/utils/audio';
import { useAudioCache } from '@/hooks/audio/useAudioCache';
import { useVoiceManagement } from '@/hooks/audio/useVoiceManagement';
import { useMediaSession } from '@/hooks/audio/useMediaSession';
import { useAudioContext } from '@/hooks/audio/useAudioContext';
import { getLastDocumentLocation } from '@/utils/indexedDB';

// Media globals
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

/**
 * Interface defining all available methods and properties in the TTS context
 */
interface TTSContextType {
  // Playback state
  isPlaying: boolean;
  isProcessing: boolean;
  currentSentence: string;

  // Navigation
  currDocPage: string | number;  // Change this to allow both types
  currDocPageNumber: number; // For PDF
  currDocPages: number | undefined;

  // Voice settings
  availableVoices: string[];

  // Control functions
  togglePlay: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  stop: () => void;
  stopAndPlayFromIndex: (index: number) => void;
  setText: (text: string) => void;
  setCurrDocPages: (num: number | undefined) => void;
  setSpeedAndRestart: (speed: number) => void;
  setVoiceAndRestart: (voice: string) => void;
  skipToLocation: (location: string | number, keepPlaying?: boolean) => void;
  registerLocationChangeHandler: (handler: (location: string | number) => void) => void;  // EPUB-only: Handles chapter navigation
  setIsEPUB: (isEPUB: boolean) => void;
}

// Create the context
const TTSContext = createContext<TTSContextType | undefined>(undefined);

/**
 * Main provider component that manages the TTS state and functionality.
 * Handles initialization of OpenAI client, audio context, and media session.
 * 
 * @param {Object} props - Component props
 * @param {ReactNode} props.children - Child components to be wrapped by the provider
 * @returns {JSX.Element} TTSProvider component
 */
export function TTSProvider({ children }: { children: ReactNode }) {
  // Configuration context consumption
  const { 
    apiKey: openApiKey, 
    baseUrl: openApiBaseUrl, 
    isLoading: configIsLoading,
    voiceSpeed,
    voice: configVoice,
    updateConfigKey,
    skipBlank,
  } = useConfig();

  // OpenAI client reference
  const openaiRef = useRef<OpenAI | null>(null);

  // Use custom hooks
  const audioContext = useAudioContext();
  const audioCache = useAudioCache(25);
  const { availableVoices, fetchVoices } = useVoiceManagement(openApiKey, openApiBaseUrl);

  // Add ref for location change handler
  const locationChangeHandlerRef = useRef<((location: string | number) => void) | null>(null);

  /**
   * Registers a handler function for location changes in EPUB documents
   * This is only used for EPUB documents to handle chapter navigation
   * 
   * @param {Function} handler - Function to handle location changes
   */
  const registerLocationChangeHandler = useCallback((handler: (location: string | number) => void) => {
    locationChangeHandlerRef.current = handler;
  }, []);

  // Get document ID from URL params
  const { id } = useParams();

  /**
   * State Management
   */
  const [isPlaying, setIsPlaying] = useState(false);
  const [isEPUB, setIsEPUB] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [currDocPage, setCurrDocPage] = useState<string | number>(1);
  const currDocPageNumber = (!isEPUB ? parseInt(currDocPage.toString()) : 1); // PDF uses numbers only
  const [currDocPages, setCurrDocPages] = useState<number>();

  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeHowl, setActiveHowl] = useState<Howl | null>(null);
  const [speed, setSpeed] = useState(voiceSpeed);
  const [voice, setVoice] = useState(configVoice);
  const [nextPageLoading, setNextPageLoading] = useState(false);

  //console.log('page:', currDocPage, 'pages:', currDocPages);

  /**
   * Changes the current page by a specified amount
   * 
   * @param {number} [num=1] - The number of pages to increment by
   */
  const incrementPage = useCallback((num = 1) => {
    setNextPageLoading(true);
    setCurrDocPage(currDocPageNumber + num);
  }, [currDocPageNumber]);

  /**
   * Processes text through the NLP API to split it into sentences
   * 
   * @param {string} text - The text to be processed
   * @returns {Promise<string[]>} Array of processed sentences
   */
  const processTextToSentences = useCallback(async (text: string): Promise<string[]> => {
    if (text.length === 0) {
      return [];
    }

    const response = await fetch('/api/nlp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      throw new Error('Failed to process text');
    }

    const { sentences } = await response.json();
    return sentences;
  }, []);

  /**
   * Stops the current audio playback and clears the active Howl instance
   */
  const abortAudio = useCallback(() => {
    if (activeHowl) {
      activeHowl.stop();
      setActiveHowl(null);
    }
  }, [activeHowl]);

  /**
   * Navigates to a specific location in the document
   * Works for both PDF pages and EPUB locations
   * 
   * @param {string | number} location - The target location to navigate to
   */
  const skipToLocation = useCallback((location: string | number, keepPlaying = false) => {
    setNextPageLoading(true);

    // Reset state for new content
    abortAudio();
    if (!keepPlaying) {
      setIsPlaying(false);
    }
    setCurrentIndex(0);
    setSentences([]);

    // Update current page/location
    setCurrDocPage(location);
  }, [abortAudio]);

  /**
   * Handles blank text sections based on document type
   * 
   * @param {string[]} sentences - Array of processed sentences
   * @returns {boolean} - True if blank section was handled
   */
  const handleBlankSection = useCallback((text: string): boolean => {
    if (!isPlaying || !skipBlank || text.length > 0) {
      return false;
    }

    if (isEPUB && locationChangeHandlerRef.current) {
      locationChangeHandlerRef.current('next');
      
      toast.success('Skipping blank section', {
        id: `epub-section-skip`,
        iconTheme: {
          primary: 'var(--accent)',
          secondary: 'var(--background)',
        },
        style: {
          background: 'var(--background)',
          color: 'var(--accent)',
        },
        duration: 1000,
        position: 'top-center',
      });
      return true;
    } 
    
    if (currDocPageNumber < currDocPages!) {
      // Pass true to keep playing when skipping blank pages
      skipToLocation(currDocPageNumber + 1, true);
      
      toast.success(`Skipping blank page ${currDocPageNumber}`, {
        id: `page-${currDocPageNumber}`,
        iconTheme: {
          primary: 'var(--accent)',
          secondary: 'var(--background)',
        },
        style: {
          background: 'var(--background)',
          color: 'var(--accent)',
        },
        duration: 1000,
        position: 'top-center',
      });
      return true;
    }

    return false;
  }, [isPlaying, skipBlank, isEPUB, currDocPageNumber, currDocPages, skipToLocation]);

  /**
   * Sets the current text and splits it into sentences
   * 
   * @param {string} text - The text to be processed
   */
  const setText = useCallback((text: string) => {
    console.log('Setting page text:', text);

    if (handleBlankSection(text)) return;
    
    processTextToSentences(text)
      .then(newSentences => {
        if (newSentences.length === 0) {
          console.warn('No sentences found in text');
          return;
        }

        setSentences(newSentences);
        setNextPageLoading(false);
      })
      .catch(error => {
        console.warn('Error processing text:', error);
        toast.error('Failed to process text', {
          style: {
            background: 'var(--background)',
            color: 'var(--accent)',
          },
          duration: 3000,
        });
      });
  }, [processTextToSentences, handleBlankSection]);

  /**
   * Toggles the playback state between playing and paused
   */
  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev) {
        return true;
      } else {
        abortAudio();
        return false;
      }
    });
  }, [abortAudio]);

  /**
   * Moves to the next or previous sentence
   * 
   * @param {boolean} [backwards=false] - Whether to move backwards
   */
  const advance = useCallback(async (backwards = false) => {
    const nextIndex = currentIndex + (backwards ? -1 : 1);
    
    // Handle within current page bounds
    if (nextIndex < sentences.length && nextIndex >= 0) {
      console.log('Advancing to next sentence:', sentences[nextIndex]);
      setCurrentIndex(nextIndex);
      return;
    }
    
    // For EPUB documents, always try to advance to next/prev section
    if (isEPUB && locationChangeHandlerRef.current) {
      console.log('EPUB: Advancing to next/prev section');
      setCurrentIndex(0);
      setSentences([]);
      locationChangeHandlerRef.current(nextIndex >= sentences.length ? 'next' : 'prev');
      return;
    }
    
    // For PDFs and other documents, check page bounds
    if (!isEPUB) {
      // Handle next/previous page transitions
      if ((nextIndex >= sentences.length && currDocPageNumber < currDocPages!) || 
          (nextIndex < 0 && currDocPageNumber > 1)) {
        console.log('PDF: Advancing to next/prev page');
        setCurrentIndex(0);
        setSentences([]);
        incrementPage(nextIndex >= sentences.length ? 1 : -1);
        return;
      }
      
      // Handle end of document (PDF only)
      if (nextIndex >= sentences.length && currDocPageNumber >= currDocPages!) {
        console.log('PDF: Reached end of document');
        setIsPlaying(false);
      }
    }
  }, [currentIndex, incrementPage, sentences, currDocPageNumber, currDocPages, isEPUB]);

  /**
   * Moves forward one sentence in the text
   */
  const skipForward = useCallback(() => {
    setIsProcessing(true);

    abortAudio();

    advance();

    setIsProcessing(false);
  }, [abortAudio, advance]);

  /**
   * Moves backward one sentence in the text
   */
  const skipBackward = useCallback(() => {
    setIsProcessing(true);

    abortAudio();

    advance(true); // Pass true to go backwards

    setIsProcessing(false);
  }, [abortAudio, advance]);

  /**
   * Updates the voice and speed settings from the configuration
   */
  const updateVoiceAndSpeed = useCallback(() => {
    setVoice(configVoice);
    setSpeed(voiceSpeed);
  }, [configVoice, voiceSpeed]);

  /**
   * Initializes OpenAI configuration and fetches available voices
   */
  useEffect(() => {
    if (!configIsLoading && openApiKey && openApiBaseUrl) {
      openaiRef.current = new OpenAI({
        apiKey: openApiKey,
        baseURL: openApiBaseUrl,
        dangerouslyAllowBrowser: true,
      });
      fetchVoices();
      updateVoiceAndSpeed();
    }
  }, [configIsLoading, openApiKey, openApiBaseUrl, updateVoiceAndSpeed, fetchVoices]);

  /**
   * Generates and plays audio for the current sentence
   * 
   * @param {string} sentence - The sentence to generate audio for
   * @returns {Promise<AudioBuffer | undefined>} The generated audio buffer
   */
  const getAudio = useCallback(async (sentence: string): Promise<AudioBuffer | undefined> => {
    // Check if the audio is already cached
    const cachedAudio = audioCache.get(sentence);
    if (cachedAudio) {
      console.log('Using cached audio for sentence:', sentence.substring(0, 20));
      return cachedAudio;
    }

    // If not cached, fetch the audio from OpenAI API
    if (openaiRef.current) {
      try {
        console.log('Requesting audio for sentence:', sentence);

        const response = await openaiRef.current.audio.speech.create({
          model: 'tts-1',
          voice: voice as "alloy",
          input: sentence,
          speed: speed,
        });

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext!.decodeAudioData(arrayBuffer);

        // Cache the audio buffer
        audioCache.set(sentence, audioBuffer);

        return audioBuffer;
      } catch (error) {
        setIsPlaying(false);
        toast.error('Failed to generate audio. API not responding.', {
          id: 'tts-api-error',
          style: {
            background: 'var(--background)',
            color: 'var(--accent)',
          },
          duration: 7000,
        });
        throw error;
      }
    }
  }, [audioContext, voice, speed, audioCache]);

  /**
   * Processes and plays the current sentence
   * 
   * @param {string} sentence - The sentence to process
   * @param {boolean} [preload=false] - Whether this is a preload request
   * @returns {Promise<string>} The URL of the processed audio
   */
  const processSentence = useCallback(async (sentence: string, preload = false): Promise<string> => {
    if (isProcessing && !preload) throw new Error('Audio is already being processed');
    if (!audioContext || !openaiRef.current) throw new Error('Audio context not initialized');
    
    // Only set processing state if not preloading
    if (!preload) setIsProcessing(true);
  
    // No need to preprocess again since setText already did it
    const audioBuffer = await getAudio(sentence);
    return audioBufferToURL(audioBuffer!);
  }, [isProcessing, audioContext, getAudio]);

  /**
   * Plays the current sentence with Howl
   * 
   * @param {string} sentence - The sentence to play
   */
  const playSentenceWithHowl = useCallback(async (sentence: string) => {
    try {
      const audioUrl = await processSentence(sentence);
      if (!audioUrl) {
        throw new Error('No audio URL generated');
      }
  
      const howl = new Howl({
        src: [audioUrl],
        format: ['wav'],
        html5: true,
        onplay: () => {
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'playing';
          }
        },
        onpause: () => {
          if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = 'paused';
          }
        },
        onend: () => {
          URL.revokeObjectURL(audioUrl);
          setActiveHowl(null);
          if (isPlaying) {
            advance();
          }
        },
        onloaderror: (id, error) => {
          console.error('Error loading audio:', error);
          setIsProcessing(false);
          setActiveHowl(null);
          URL.revokeObjectURL(audioUrl);
          // Don't auto-advance on load error
          setIsPlaying(false);
        },
      });
  
      setActiveHowl(howl);
      howl.play();
      setIsProcessing(false);
  
    } catch (error) {
      console.error('Error playing TTS:', error);
      setActiveHowl(null);
      setIsProcessing(false);
      //setIsPlaying(false);
      
      toast.error('Failed to process audio. Skipping problematic sentence.', {
        id: 'tts-processing-error',
        style: {
          background: 'var(--background)',
          color: 'var(--accent)',
        },
        duration: 3000,
      });
      
      advance(); // Skip problematic sentence
    }
  }, [isPlaying, processSentence, advance]);

  /**
   * Preloads the next sentence's audio
   */
  const preloadNextAudio = useCallback(() => {
    try {
      if (sentences[currentIndex + 1] && !audioCache.has(sentences[currentIndex + 1])) {
        processSentence(sentences[currentIndex + 1], true); // True indicates preloading
      }
    } catch (error) {
      console.error('Error preloading next sentence:', error);
    }
  }, [currentIndex, sentences, audioCache, processSentence]);

  /**
   * Plays the current sentence's audio
   */
  const playAudio = useCallback(async () => {
    await playSentenceWithHowl(sentences[currentIndex]);
  }, [sentences, currentIndex, playSentenceWithHowl]);

  /**
   * Main Playback Driver
   * Controls the flow of audio playback and sentence processing
   */
  useEffect(() => {
    if (!isPlaying) return; // Don't proceed if stopped
    if (isProcessing) return; // Don't proceed if processing audio
    if (!sentences[currentIndex]) return; // Don't proceed if no sentence to play
    if (nextPageLoading) return; // Don't proceed if loading next page
    if (activeHowl) return; // Don't proceed if audio is already playing

    // Play the current sentence and preload the next one if available
    playAudio();
    if (sentences[currentIndex + 1]) {
      preloadNextAudio();
    }
    
    return () => {
      abortAudio();
    };
  }, [
    isPlaying,
    isProcessing,
    currentIndex,
    sentences,
    activeHowl,
    nextPageLoading,
    playAudio,
    preloadNextAudio,
    abortAudio
  ]);

  /**
   * Stops the current audio playback and resets all state
   */
  const stop = useCallback(() => {
    // Cancel any ongoing request
    abortAudio();
    locationChangeHandlerRef.current = null;
    setIsPlaying(false);
    setCurrentIndex(0);
    setSentences([]);
    setCurrDocPage(1);
    setCurrDocPages(undefined);
    setNextPageLoading(false);
    setIsProcessing(false);
    setIsEPUB(false);
  }, [abortAudio]);

  /**
   * Stops the current audio playback and starts playing from a specified index
   * 
   * @param {number} index - The index to start playing from
   */
  const stopAndPlayFromIndex = useCallback((index: number) => {
    abortAudio();
    
    setCurrentIndex(index);
    setIsPlaying(true);
  }, [abortAudio]);

  /**
   * Sets the speed and restarts the playback
   * 
   * @param {number} newSpeed - The new speed to set
   */
  const setSpeedAndRestart = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    updateConfigKey('voiceSpeed', newSpeed);
    // Clear the audio cache since it contains audio at the old speed
    audioCache.clear();

    if (isPlaying) {
      setIsPlaying(false);
      abortAudio();
      setIsPlaying(true);
    }
  }, [isPlaying, abortAudio, updateConfigKey, audioCache]);

  /**
   * Sets the voice and restarts the playback
   * 
   * @param {string} newVoice - The new voice to set
   */
  const setVoiceAndRestart = useCallback((newVoice: string) => {
    setVoice(newVoice);
    updateConfigKey('voice', newVoice);
    // Clear the audio cache since it contains audio with the old voice
    audioCache.clear();

    if (isPlaying) {
      setIsPlaying(false);
      abortAudio();
      setIsPlaying(true);
    }
  }, [isPlaying, abortAudio, updateConfigKey, audioCache]);

  /**
   * Provides the TTS context value to child components
   */
  const value = useMemo(() => ({
    isPlaying,
    isProcessing,
    currentSentence: sentences[currentIndex] || '',
    currDocPage,
    currDocPageNumber,
    currDocPages,
    availableVoices,
    togglePlay,
    skipForward,
    skipBackward,
    stop,
    stopAndPlayFromIndex,
    setText,
    setCurrDocPages,
    setSpeedAndRestart,
    setVoiceAndRestart,
    skipToLocation,
    registerLocationChangeHandler,
    setIsEPUB
  }), [
    isPlaying,
    isProcessing,
    sentences,
    currentIndex,
    currDocPage,
    currDocPageNumber,
    currDocPages,
    availableVoices,
    togglePlay,
    skipForward,
    skipBackward,
    stop,
    stopAndPlayFromIndex,
    setText,
    setCurrDocPages,
    setSpeedAndRestart,
    setVoiceAndRestart,
    skipToLocation,
    registerLocationChangeHandler,
    setIsEPUB
  ]);

  // Use media session hook
  useMediaSession({
    togglePlay,
    skipForward,
    skipBackward,
  });

  // Load last location on mount for EPUB only
  useEffect(() => {
    if (id && isEPUB) {
      getLastDocumentLocation(id as string).then(lastLocation => {
        if (lastLocation) {
          console.log('Setting last location:', lastLocation);
          if (locationChangeHandlerRef.current) {
            locationChangeHandlerRef.current(lastLocation);
          }
        }
      });
    }
  }, [id, isEPUB]);

  /**
   * Renders the TTS context provider with its children
   * 
   * @param {ReactNode} children - Child components to be wrapped
   * @returns {JSX.Element}
   */
  return (
    <TTSContext.Provider value={value}>
      {children}
    </TTSContext.Provider>
  );
}

/**
 * Custom hook to consume the TTS context
 * Ensures the context is used within a provider
 * 
 * @throws {Error} If used outside of TTSProvider
 * @returns {TTSContextType} The TTS context value
 */
export function useTTS() {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error('useTTS must be used within a TTSProvider');
  }
  return context;
}