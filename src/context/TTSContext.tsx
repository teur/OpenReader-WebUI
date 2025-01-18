'use client';

import React, { createContext, useContext, useState, useCallback } from 'react';
import nlp from 'compromise';

interface TTSContextType {
  isPlaying: boolean;
  currentText: string;
  togglePlay: () => void;
  skipForward: () => void;
  skipBackward: () => void;
  setText: (text: string) => void;
  currentSentence: string;
}

const TTSContext = createContext<TTSContextType | undefined>(undefined);

export function TTSProvider({ children }: { children: React.ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [sentences, setSentences] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const splitIntoSentences = (text: string): string[] => {
    const doc = nlp(text);
    // Convert to array and ensure we get strings
    return doc.sentences().out('array') as string[];
  };

  const togglePlay = useCallback(() => {
    setIsPlaying(prev => !prev);
    // TODO: Implement actual TTS play/pause logic
  }, []);

  const skipForward = useCallback(() => {
    setCurrentIndex(prev => {
      const nextIndex = Math.min(prev + 1, sentences.length - 1);
      console.log('Current sentence:', sentences[nextIndex]);
      return nextIndex;
    });
  }, [sentences]);

  const skipBackward = useCallback(() => {
    setCurrentIndex(prev => {
      const nextIndex = Math.max(prev - 1, 0);
      console.log('Current sentence:', sentences[nextIndex]);
      return nextIndex;
    });
  }, [sentences]);

  const setText = useCallback((text: string) => {
    setCurrentText(text);
    const newSentences = splitIntoSentences(text);
    setSentences(newSentences);
    setCurrentIndex(0);
    if (newSentences.length > 0) {
      console.log('Starting sentence:', newSentences[0]);
    }
  }, []);

  const value = {
    isPlaying,
    currentText,
    togglePlay,
    skipForward,
    skipBackward,
    setText,
    currentSentence: sentences[currentIndex] || '',
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
