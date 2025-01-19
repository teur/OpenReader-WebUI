'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
} from 'react';
import nlp from 'compromise';
import OpenAI from 'openai';
import { LRUCache } from 'lru-cache'; // Import LRUCache directly

// Add type declarations
declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext;
  }
}

type AudioContextType = typeof window extends undefined
  ? never
  : AudioContext | null;

interface TTSContextType {
  isPlaying: boolean;
  currentText: string;
  togglePlay: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  setText: (text: string) => void;
  currentSentence: string;
  audioQueue: AudioBuffer[];
  currentAudioIndex: number;
  stop: () => void;
  setCurrentIndex: (index: number) => void;
  stopAndPlayFromIndex: (index: number) => void;
  sentences: string[];
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [audioContext, setAudioContext] = useState<AudioContextType>(null);
  const currentRequestRef = useRef<AbortController | null>(null);
  const [activeSource, setActiveSource] = useState<AudioBufferSourceNode | null>(null);
  const [audioQueue, setAudioQueue] = useState<AudioBuffer[]>([]);
  const [currentAudioIndex, setCurrentAudioIndex] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const skipTriggeredRef = useRef(false);
  const skipTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isPausingRef = useRef(false);

  // Create OpenAI instance
  const [openai] = useState(
    () =>
      new OpenAI({
        apiKey: process.env.NEXT_PUBLIC_OPENAI_API_KEY,
        baseURL: process.env.NEXT_PUBLIC_OPENAI_API_BASE,
        dangerouslyAllowBrowser: true,
      })
  );

  // Audio cache using LRUCache with a maximum size of 50 entries
  const audioCacheRef = useRef(new LRUCache<string, AudioBuffer>({ max: 50 }));

  useEffect(() => {
    // Initialize AudioContext on client side only
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
  }, [audioContext]);

  // Text preprocessing function to clean and normalize text
  const preprocessText = (text: string): string => {
    return text
      // Replace URLs with descriptive text including domain
      .replace(/\S*(?:https?:\/\/|www\.)([^\/\s]+)(?:\/\S*)?/gi, '- (link to $1) -')
      // Remove special characters except basic punctuation
      .replace(/[^\w\s.,!?;:'"()-]/g, ' ')
      // Fix hyphenated words at line breaks (word- word -> wordword)
      .replace(/(\w+)-\s+(\w+)/g, '$1$2')
      // Replace multiple spaces with single space
      .replace(/\s+/g, ' ')
      // Trim whitespace
      .trim();
  };

  const splitIntoSentences = (text: string): string[] => {
    // Preprocess the text before splitting into sentences
    const cleanedText = preprocessText(text);
    const doc = nlp(cleanedText);
    return doc.sentences().out('array') as string[];
  };

  const processNextSentence = useCallback(async () => {
    if (!isPlaying || currentIndex >= sentences.length - 1 || skipTriggeredRef.current) {
      setIsPlaying(false);
      return;
    }

    setCurrentIndex((prev) => {
      const nextIndex = prev + 1;
      if (nextIndex < sentences.length) {
        console.log('Auto-advancing to next sentence:', sentences[nextIndex]);
        return nextIndex;
      }
      return prev;
    });
  }, [isPlaying, currentIndex, sentences]);

  const processAndPlaySentence = async (sentence: string) => {
    if (!audioContext || isProcessing) return;
    setIsProcessing(true);

    try {
      // Cancel any existing request
      if (currentRequestRef.current) {
        currentRequestRef.current.abort();
      }

      // Create new abort controller for this request
      currentRequestRef.current = new AbortController();

      // Stop any currently playing audio
      if (activeSource) {
        activeSource.stop();
        setActiveSource(null);
      }

      // Clean the sentence before processing
      const cleanedSentence = preprocessText(sentence);
      let audioBuffer = audioCacheRef.current.get(cleanedSentence);

      if (!audioBuffer) {
        console.log(' Processing TTS for sentence:', cleanedSentence.substring(0, 50) + '...');
        const startTime = Date.now();
        const response = await openai.audio.speech.create({
          model: 'tts-1',
          voice: 'alloy',
          input: cleanedSentence,
        });

        const duration = Date.now() - startTime;
        console.log(` TTS processing completed in ${duration}ms`);

        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Store in cache
        audioCacheRef.current.set(cleanedSentence, audioBuffer);
      }

      // If the request was aborted, do not proceed
      if (!currentRequestRef.current) return;

      const source = audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContext.destination);
      setActiveSource(source);

      // Set up onended handler before starting
      source.onended = () => {
        setActiveSource(null);
        setIsProcessing(false);
        // Only advance if we're playing and not pausing or skipping
        if (isPlaying && !skipTriggeredRef.current && !isPausingRef.current) {
          processNextSentence();
        }
        isPausingRef.current = false; // Reset pause flag
      };

      source.start(0);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was cancelled');
      } else {
        console.error('Error processing TTS:', error);
      }
      setActiveSource(null);
      setIsProcessing(false);
    } finally {
      currentRequestRef.current = null;
    }
  };

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => {
      if (!prev) {
        isPausingRef.current = false;
        return true;
      } else {
        if (activeSource) {
          isPausingRef.current = true;
          activeSource.stop();
          setActiveSource(null);
        }
        return false;
      }
    });
  }, [activeSource]);

  const skipForward = useCallback(() => {
    if (skipTimeoutRef.current) {
      clearTimeout(skipTimeoutRef.current);
    }

    skipTriggeredRef.current = true;
    // Cancel any ongoing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
      currentRequestRef.current = null;
    }

    // Stop current audio
    if (activeSource) {
      activeSource.stop();
      setActiveSource(null);
    }

    setCurrentIndex((prev) => {
      const nextIndex = Math.min(prev + 1, sentences.length - 1);
      console.log('Skipping forward to:', sentences[nextIndex]);
      return nextIndex;
    });

    // Reset skip flag after a short delay
    skipTimeoutRef.current = setTimeout(() => {
      skipTriggeredRef.current = false;
    }, 100);
  }, [sentences, activeSource]);

  const skipBackward = useCallback(() => {
    if (skipTimeoutRef.current) {
      clearTimeout(skipTimeoutRef.current);
    }

    skipTriggeredRef.current = true;
    // Cancel any ongoing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
      currentRequestRef.current = null;
    }

    // Stop current audio
    if (activeSource) {
      activeSource.stop();
      setActiveSource(null);
    }

    setCurrentIndex((prev) => {
      const nextIndex = Math.max(prev - 1, 0);
      console.log('Skipping backward to:', sentences[nextIndex]);
      return nextIndex;
    });

    // Reset skip flag after a short delay
    skipTimeoutRef.current = setTimeout(() => {
      skipTriggeredRef.current = false;
    }, 100);
  }, [sentences, activeSource]);

  const setText = useCallback((text: string) => {
    setCurrentText(text);
    const newSentences = splitIntoSentences(text);
    setSentences(newSentences);
    setCurrentIndex(0);
    setIsPlaying(false);

    // Clear audio cache
    audioCacheRef.current.clear();

    // Preload the first sentence immediately
    if (newSentences.length > 0) {
      preloadSentence(newSentences[0]).then(() => {
        // Preload the second sentence after a small delay
        if (newSentences[1]) {
          setTimeout(() => preloadSentence(newSentences[1]), 200);
        }
      });
    }
  }, []);

  // Preload adjacent sentences when currentIndex changes
  useEffect(() => {
    const preloadAdjacentSentences = async () => {
      try {
        // Only preload next sentence to reduce API load
        if (sentences[currentIndex + 1] && !audioCacheRef.current.has(sentences[currentIndex + 1])) {
          await new Promise((resolve) => setTimeout(resolve, 200)); // Add small delay
          await preloadSentence(sentences[currentIndex + 1]);
        }
      } catch (error) {
        console.error('Error preloading adjacent sentences:', error);
      }
    };
    preloadAdjacentSentences();
  }, [currentIndex, sentences]);

  useEffect(() => {
    if (isPlaying && sentences[currentIndex] && !isProcessing) {
      processAndPlaySentence(sentences[currentIndex]);
    }
  }, [isPlaying, currentIndex, sentences, isProcessing]);

  const preloadSentence = async (sentence: string) => {
    if (!audioContext) return;
    if (audioCacheRef.current.has(sentence)) return; // Already cached

    try {
      console.log(' Preloading TTS for sentence:', sentence.substring(0, 50) + '...');
      const startTime = Date.now();
      const response = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'alloy',
        input: sentence,
      });

      const duration = Date.now() - startTime;
      console.log(` Preload TTS completed in ${duration}ms`);

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      // Store in cache
      audioCacheRef.current.set(sentence, audioBuffer);
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Request was cancelled');
      } else {
        console.error('Error preloading TTS:', error);
      }
    }
  };

  const stop = useCallback(() => {
    // Cancel any ongoing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
      currentRequestRef.current = null;
    }

    // Stop current audio
    if (activeSource) {
      activeSource.stop();
      setActiveSource(null);
    }

    setIsPlaying(false);
    setCurrentIndex(0);
    setCurrentText('');
    setIsProcessing(false);
  }, [activeSource]);

  const stopAndPlayFromIndex = useCallback((index: number) => {
    // Cancel any ongoing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
      currentRequestRef.current = null;
    }

    // Stop current audio
    if (activeSource) {
      activeSource.stop();
      setActiveSource(null);
    }

    // Set skip flag to prevent immediate auto-advance
    skipTriggeredRef.current = true;

    // Set new index and start playing
    setCurrentIndex(index);
    setIsPlaying(true);

    // Reset skip flag after a short delay to allow future auto-advance
    if (skipTimeoutRef.current) {
      clearTimeout(skipTimeoutRef.current);
    }
    skipTimeoutRef.current = setTimeout(() => {
      skipTriggeredRef.current = false;
    }, 100);
  }, [activeSource]);

  const setCurrentIndexWithoutPlay = useCallback((index: number) => {
    // Cancel any ongoing request
    if (currentRequestRef.current) {
      currentRequestRef.current.abort();
      currentRequestRef.current = null;
    }

    // Stop current audio
    if (activeSource) {
      activeSource.stop();
      setActiveSource(null);
    }

    setCurrentIndex(index);
    skipTriggeredRef.current = false;
  }, [activeSource]);

  const value = {
    isPlaying,
    currentText,
    togglePlay,
    skipForward,
    skipBackward,
    setText,
    currentSentence: sentences[currentIndex] || '',
    audioQueue,
    currentAudioIndex,
    stop,
    setCurrentIndex: setCurrentIndexWithoutPlay,
    stopAndPlayFromIndex,
    sentences,
  };

  return (
    <TTSContext.Provider value={value}>
      {children}
    </TTSContext.Provider>
  );
}

export function useTTS() {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error('useTTS must be used within a TTSProvider');
  }
  return context;
}