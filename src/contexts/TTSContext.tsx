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

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  useMemo,
} from 'react';
import OpenAI from 'openai';
import { Howl } from 'howler';

import { useConfig } from '@/contexts/ConfigContext';
import { splitIntoSentences, preprocessSentenceForAudio } from '@/services/nlp';
import { audioBufferToURL } from '@/services/audio';
import { useAudioCache } from '@/hooks/audio/useAudioCache';
import { useVoiceManagement } from '@/hooks/audio/useVoiceManagement';
import { useMediaSession } from '@/hooks/audio/useMediaSession';
import { useAudioContext } from '@/hooks/audio/useAudioContext';

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
  currDocPage: number;
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
  skipToPage: (page: number) => void;
}

// Create the context
const TTSContext = createContext<TTSContextType | undefined>(undefined);

/**
 * TTSProvider Component
 * 
 * Main provider component that manages the TTS state and functionality.
 * Handles initialization of OpenAI client, audio context, and media session.
 */
export function TTSProvider({ children }: { children: React.ReactNode }) {
  // Configuration context consumption
  const { 
    apiKey: openApiKey, 
    baseUrl: openApiBaseUrl, 
    isLoading: configIsLoading,
    voiceSpeed,
    voice: configVoice,
    updateConfigKey
  } = useConfig();

  // OpenAI client reference
  const openaiRef = useRef<OpenAI | null>(null);

  // Use custom hooks
  const audioContext = useAudioContext();
  const audioCache = useAudioCache(50);
  const { availableVoices, fetchVoices } = useVoiceManagement(openApiKey, openApiBaseUrl);

  /**
   * State Management
   */
  const [isPlaying, setIsPlaying] = useState(false);
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [activeHowl, setActiveHowl] = useState<Howl | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speed, setSpeed] = useState(voiceSpeed);
  const [voice, setVoice] = useState(configVoice);
  const [currDocPage, setCurrDocPage] = useState<number>(1);
  const [currDocPages, setCurrDocPages] = useState<number>();
  const [nextPageLoading, setNextPageLoading] = useState(false);

  /**
   * Sets the current text and splits it into sentences
   * 
   * @param {string} text - The text to be processed
   * @returns {void}
   */
  const setText = useCallback((text: string) => {
    console.log('Setting page text:', text);
    const newSentences = splitIntoSentences(text);
    setSentences(newSentences);

    setNextPageLoading(false);
  }, []);

  /**
   * Stops the current audio playback and clears the active Howl instance
   * 
   * @returns {void}
   */
  const abortAudio = useCallback(() => {
    if (activeHowl) {
      activeHowl.stop();
      setActiveHowl(null);
    }
  }, [activeHowl]);

  /**
   * Toggles the playback state between playing and paused
   * 
   * @returns {void}
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
   * Navigates to a specific page in the document
   * 
   * @param {number} page - The target page number
   * @returns {void}
   */
  const skipToPage = useCallback((page: number) => {
    abortAudio();
    setIsPlaying(false);
    setNextPageLoading(true);
    setCurrentIndex(0);
    setCurrDocPage(page);
  }, [abortAudio]);

  /**
   * Changes the current page by a specified amount
   * 
   * @param {number} [num=1] - The number of pages to increment by
   * @returns {void}
   */
  const incrementPage = useCallback((num = 1) => {
    setNextPageLoading(true);
    setCurrDocPage(currDocPage + num);
  }, [currDocPage]);

  /**
   * Moves to the next or previous sentence
   * 
   * @param {boolean} [backwards=false] - Whether to move backwards
   * @returns {Promise<void>}
   */
  const advance = useCallback(async (backwards = false) => {
    setCurrentIndex((prev) => {
      const nextIndex = prev + (backwards ? -1 : 1);
      if (nextIndex < sentences.length && nextIndex >= 0) {
        console.log('Advancing to next sentence:', sentences[nextIndex]);
        return nextIndex;
      } else if (nextIndex >= sentences.length && currDocPage < currDocPages!) {
        console.log('Advancing to next page:', currDocPage + 1);

        incrementPage();

        return 0;
      } else if (nextIndex < 0 && currDocPage > 1) {
        console.log('Advancing to previous page:', currDocPage - 1);

        incrementPage(-1);

        return 0;
      } else if (nextIndex >= sentences.length && currDocPage >= currDocPages!) {
        console.log('Reached end of document');
        setIsPlaying(false);
        return prev;
      }
      return prev;
    });
  }, [sentences, currDocPage, currDocPages, incrementPage]);

  /**
   * Moves forward one sentence in the text
   * 
   * @returns {void}
   */
  const skipForward = useCallback(() => {
    setIsProcessing(true);

    abortAudio();

    advance();

    setIsProcessing(false);
  }, [abortAudio, advance]);

  /**
   * Moves backward one sentence in the text
   * 
   * @returns {void}
   */
  const skipBackward = useCallback(() => {
    setIsProcessing(true);

    abortAudio();

    advance(true); // Pass true to go backwards

    setIsProcessing(false);
  }, [abortAudio, advance]);

  /**
   * Updates the voice and speed settings from the configuration
   * 
   * @returns {void}
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
   * @returns {Promise<void>}
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
    }
  }, [audioContext, voice, speed, audioCache]);

  /**
   * Processes and plays the current sentence
   * 
   * @returns {Promise<void>}
   */
  const processSentence = useCallback(async (sentence: string, preload = false): Promise<string> => {
    if (isProcessing && !preload) throw new Error('Audio is already being processed');
    if (!audioContext || !openaiRef.current) throw new Error('Audio context not initialized');
    
    // Only set processing state if not preloading
    if (!preload) setIsProcessing(true);
  
    const cleanedSentence = preprocessSentenceForAudio(sentence);
    const audioBuffer = await getAudio(cleanedSentence);
    
    return audioBufferToURL(audioBuffer!);
  }, [isProcessing, audioContext, getAudio]);

  /**
   * Plays the current sentence with Howl
   * 
   * @returns {Promise<void>}
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
      //setIsPlaying(false); // Stop playback on error
      
      advance(); // Skip problematic sentence
    }
  }, [isPlaying, processSentence, advance]);

  /**
   * Preloads the next sentence's audio
   * 
   * @returns {void}
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
   * 
   * @returns {Promise<void>}
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
   * Stops the current audio playback
   * 
   * @returns {void}
   */
  const stop = useCallback(() => {
    // Cancel any ongoing request
    abortAudio();

    setIsPlaying(false);
    setCurrentIndex(0);
    setIsProcessing(false);
  }, [abortAudio]);

  /**
   * Stops the current audio playback and starts playing from a specified index
   * 
   * @param {number} index - The index to start playing from
   * @returns {void}
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
   * @returns {void}
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
   * @returns {void}
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
    skipToPage,
  }), [
    isPlaying,
    isProcessing,
    sentences,
    currentIndex,
    currDocPage,
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
    skipToPage,
  ]);

  // Use media session hook
  useMediaSession({
    togglePlay,
    skipForward,
    skipBackward,
  });

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
 */
export function useTTS() {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error('useTTS must be used within a TTSProvider');
  }
  return context;
}