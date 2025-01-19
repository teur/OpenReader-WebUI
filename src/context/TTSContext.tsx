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

  const splitIntoSentences = (text: string): string[] => {
    const doc = nlp(text);
    // Convert to array and ensure we get strings
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

      let audioBuffer = audioCacheRef.current.get(sentence);

      if (!audioBuffer) {
        console.log(' Processing TTS for sentence:', sentence.substring(0, 50) + '...');
        const startTime = Date.now();
        const response = await openai.audio.speech.create({
          model: 'tts-1',
          voice: 'alloy',
          input: sentence,
        });

        const duration = Date.now() - startTime;
        console.log(` TTS processing completed in ${duration}ms`);

        const arrayBuffer = await response.arrayBuffer();
        audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Store in cache
        audioCacheRef.current.set(sentence, audioBuffer);
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
        if (isPlaying && !skipTriggeredRef.current) {
          processNextSentence();
        }
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
        return true; // Start playing
      } else {
        // Pause playback
        if (activeSource) {
          activeSource.stop(); // Stop the audio source
          setActiveSource(null); // Clear the active source
        }
        return false; // Set isPlaying to false
      }
    });
  }, [activeSource]);

  const skipForward = useCallback(() => {
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
    setTimeout(() => {
      skipTriggeredRef.current = false;
    }, 100);
  }, [sentences, activeSource]);

  const skipBackward = useCallback(() => {
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
    setTimeout(() => {
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
  };

  return <TTSContext.Provider value={value}>{children}</TTSContext.Provider>;
}

export function useTTS() {
  const context = useContext(TTSContext);
  if (context === undefined) {
    throw new Error('useTTS must be used within a TTSProvider');
  }
  return context;
}