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
} from 'react';
import OpenAI from 'openai';
import { LRUCache } from 'lru-cache'; // Import LRUCache directly
import { Howl } from 'howler';

import { useConfig } from '@/contexts/ConfigContext';
import { splitIntoSentences, preprocessSentenceForAudio } from '@/services/nlp';
import { audioBufferToURL } from '@/services/audio';

// Media globals
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

/**
 * Type definition for AudioContext to handle browser compatibility
 */
type AudioContextType = typeof window extends undefined
  ? never
  : (AudioContext);

/**
 * Interface defining all available methods and properties in the TTS context
 */
interface TTSContextType {
  isPlaying: boolean;
  currentText: string;
  togglePlay: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  setText: (text: string) => void;
  currentSentence: string;
  audioQueue: AudioBuffer[];
  stop: () => void;
  stopAndPlayFromIndex: (index: number) => void;
  sentences: string[];
  isProcessing: boolean;
  setIsProcessing: (value: boolean) => void;
  setIsPlaying: (value: boolean) => void;
  speed: number;
  setSpeed: (speed: number) => void;
  setSpeedAndRestart: (speed: number) => void;
  voice: string;
  setVoice: (voice: string) => void;
  setVoiceAndRestart: (voice: string) => void;
  availableVoices: string[];
  currentIndex: number;
  setCurrentIndex: (index: number) => void;
  currDocPage: number;
  currDocPages: number | undefined;
  setCurrDocPages: (num: number | undefined) => void;
  incrementPage: (num?: number) => void;
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

  /**
   * State Management
   * - Playback control
   * - Text and sentence management
   * - Audio processing
   * - Voice and speed settings
   * - Document navigation
   */
  // All existing state declarations and refs stay at the top
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [audioContext, setAudioContext] = useState<AudioContextType>();
  const [activeHowl, setActiveHowl] = useState<Howl | null>(null);
  const [audioQueue] = useState<AudioBuffer[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [speed, setSpeed] = useState(voiceSpeed);
  const [voice, setVoice] = useState(configVoice);
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);

  const [currDocPage, setCurrDocPage] = useState<number>(1);
  const [currDocPages, setCurrDocPages] = useState<number>();
  const [nextPageLoading, setNextPageLoading] = useState(false);

  /**
   * Audio Cache
   * LRU cache to store processed audio buffers and improve performance
   */
  const audioCacheRef = useRef(new LRUCache<string, AudioBuffer>({ max: 50 }));

  /**
   * Text Processing Functions
   * Handle text input and sentence splitting
   */
  const setText = useCallback((text: string) => {
    setCurrentText(text);
    console.log('Setting page text:', text);
    const newSentences = splitIntoSentences(text);
    setSentences(newSentences);

    // Clear audio cache
    //audioCacheRef.current.clear();

    setNextPageLoading(false);
  }, []);

  const abortAudio = useCallback(() => {
    if (activeHowl) {
      activeHowl.stop();
      setActiveHowl(null);
    }
  }, [activeHowl]);

  /**
   * Playback Control Functions
   * Manage audio playback, navigation, and state
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

  const skipToPage = useCallback((page: number) => {
    abortAudio();
    setIsPlaying(false);
    setNextPageLoading(true);
    setCurrentIndex(0);
    setCurrDocPage(page);
  }, [abortAudio]);

  const incrementPage = useCallback((num = 1) => {
    setNextPageLoading(true);
    setCurrDocPage(currDocPage + num);
  }, [currDocPage]);

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
  

  const skipForward = useCallback(() => {
    setIsProcessing(true);

    abortAudio();

    advance();

    setIsProcessing(false);
  }, [abortAudio, advance]);

  const skipBackward = useCallback(() => {
    setIsProcessing(true);

    abortAudio();

    advance(true); // Pass true to go backwards

    setIsProcessing(false);
  }, [abortAudio, advance]);

  /**
   * Audio Processing Functions
   * Handle audio generation, caching, and playback
   */
  // Initialize OpenAI instance when config loads
  useEffect(() => {
    const fetchVoices = async () => {
      try {
        const response = await fetch(`${openApiBaseUrl}/audio/voices`, {
          headers: {
            'Authorization': `Bearer ${openApiKey}`,
            'Content-Type': 'application/json',
          },
        });
        if (!response.ok) throw new Error('Failed to fetch voices');
        const data = await response.json();
        setAvailableVoices(data.voices || []);
      } catch (error) {
        console.error('Error fetching voices:', error);

        // Set available voices to default openai voices
        // Supported voices are alloy, ash, coral, echo, fable, onyx, nova, sage and shimmer
        setAvailableVoices(['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer']);
      }
    };

    if (!configIsLoading && openApiKey && openApiBaseUrl) {
      openaiRef.current = new OpenAI({
        apiKey: openApiKey,
        baseURL: openApiBaseUrl,
        dangerouslyAllowBrowser: true,
      });
      fetchVoices();
    }
  }, [configIsLoading, openApiKey, openApiBaseUrl]);

  // Initialize AudioContext
  useEffect(() => {
    /*
     * Initializes the AudioContext for text-to-speech playback.
     * Creates a new AudioContext instance if one doesn't exist.
     * Only runs on the client side to avoid SSR issues.
     * 
     * Dependencies:
     * - audioContext: Re-runs if the audioContext is null or changes
     */
    if (typeof window !== 'undefined' && !audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        try {
          setAudioContext(new AudioContextClass());
        } catch (error) {
          console.error('Failed to initialize AudioContext:', error);
        }
      }
    }

    return () => {
      if (audioContext) {
        audioContext.close().catch((error) => {
          console.error('Error closing AudioContext:', error);
        });
      }
    }
  }, [audioContext]);

  // Set up MediaSession API
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'Text-to-Speech',
        artist: 'OpenReader WebUI',
        album: 'Current Document',
      });

      navigator.mediaSession.setActionHandler('play', () => togglePlay());
      navigator.mediaSession.setActionHandler('pause', () => togglePlay());
      navigator.mediaSession.setActionHandler('nexttrack', () => skipForward());
      navigator.mediaSession.setActionHandler('previoustrack', () => skipBackward());
    }
  }, [togglePlay, skipForward, skipBackward]);

  //new function to return audio buffer with caching
  const getAudio = useCallback(async (sentence: string): Promise<AudioBuffer | undefined> => {
    // Check if the audio is already cached
    const cachedAudio = audioCacheRef.current.get(sentence);
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
      audioCacheRef.current.set(sentence, audioBuffer);

      return audioBuffer;
    }
  }, [audioContext, voice, speed]);

  const processSentence = useCallback(async (sentence: string, preload = false): Promise<string> => {
    if (isProcessing && !preload) throw new Error('Audio is already being processed');
    if (!audioContext || !openaiRef.current) throw new Error('Audio context not initialized');
    
    // Only set processing state if not preloading
    if (!preload) setIsProcessing(true);
  
    const cleanedSentence = preprocessSentenceForAudio(sentence);
    const audioBuffer = await getAudio(cleanedSentence);
    
    return audioBufferToURL(audioBuffer!);
  }, [isProcessing, audioContext, getAudio]);

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

  const preloadNextAudio = useCallback(() => {
    try {
      if (sentences[currentIndex + 1] && !audioCacheRef.current.has(sentences[currentIndex + 1])) {
        processSentence(sentences[currentIndex + 1], true); // True indicates preloading
      }
    } catch (error) {
      console.error('Error preloading next sentence:', error);
    }
  }, [currentIndex, sentences, audioCacheRef, processSentence]);

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

  const stop = useCallback(() => {
    // Cancel any ongoing request
    abortAudio();

    setIsPlaying(false);
    setCurrentIndex(0);
    setCurrentText('');
    setIsProcessing(false);
  }, [abortAudio]);

  const stopAndPlayFromIndex = useCallback((index: number) => {
    abortAudio();
    
    setCurrentIndex(index);
    setIsPlaying(true);
  }, [abortAudio]);

  const setCurrentIndexWithoutPlay = useCallback((index: number) => {
    abortAudio();

    setCurrentIndex(index);
  }, [abortAudio]);

  const setSpeedAndRestart = useCallback((newSpeed: number) => {
    setSpeed(newSpeed);
    updateConfigKey('voiceSpeed', newSpeed);
    // Clear the audio cache since it contains audio at the old speed
    audioCacheRef.current.clear();

    if (isPlaying) {
      setIsPlaying(false);
      abortAudio();
      setIsPlaying(true);
    }
  }, [isPlaying, abortAudio, updateConfigKey]);

  const setVoiceAndRestart = useCallback((newVoice: string) => {
    setVoice(newVoice);
    updateConfigKey('voice', newVoice);
    // Clear the audio cache since it contains audio with the old voice
    audioCacheRef.current.clear();

    if (isPlaying) {
      setIsPlaying(false);
      abortAudio();
      setIsPlaying(true);
    }
  }, [isPlaying, abortAudio, updateConfigKey]);

  /**
   * Context Value
   * Aggregate all functions and state to be provided to consumers
   */
  const value = {
    isPlaying,
    currentText,
    togglePlay,
    skipForward,
    skipBackward,
    setText,
    currentSentence: sentences[currentIndex] || '',
    audioQueue,
    stop,
    setCurrentIndex: setCurrentIndexWithoutPlay,
    stopAndPlayFromIndex,
    sentences,
    isProcessing,
    setIsProcessing,
    setIsPlaying,
    speed,
    setSpeed,
    setSpeedAndRestart,
    voice,
    setVoice,
    setVoiceAndRestart,
    availableVoices,
    currentIndex,
    currDocPage,
    currDocPages,
    setCurrDocPages,
    incrementPage,
    skipToPage,
  };

  // Render provider with value
  if (configIsLoading) {
    return null;
  }

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