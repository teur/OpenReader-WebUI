'use client';

import { useState, useCallback } from 'react';

const DEFAULT_VOICES = ['alloy', 'ash', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer'];

/**
 * Custom hook for managing TTS voices
 * @param apiKey OpenAI API key
 * @param baseUrl OpenAI API base URL
 * @returns Object containing available voices and fetch function
 */
export function useVoiceManagement(apiKey: string | undefined, baseUrl: string | undefined) {
  const [availableVoices, setAvailableVoices] = useState<string[]>([]);

  const fetchVoices = useCallback(async () => {
    if (!apiKey || !baseUrl) return;

    try {
      const response = await fetch(`${baseUrl}/audio/voices`, {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });
      if (!response.ok) throw new Error('Failed to fetch voices');
      const data = await response.json();
      setAvailableVoices(data.voices || []);
    } catch (error) {
      console.error('Error fetching voices:', error);
      // Set available voices to default openai voices
      setAvailableVoices(DEFAULT_VOICES);
    }
  }, [apiKey, baseUrl]);

  return { availableVoices, fetchVoices };
}
