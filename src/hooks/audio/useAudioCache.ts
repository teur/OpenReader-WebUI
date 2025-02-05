'use client';

import { useRef } from 'react';
import { LRUCache } from 'lru-cache';

/**
 * Custom hook for managing audio cache using LRU strategy
 * @param maxSize Maximum number of items to store in cache
 * @returns Object containing cache methods
 */
export function useAudioCache(maxSize = 50) {
  const cacheRef = useRef(new LRUCache<string, AudioBuffer>({ max: maxSize }));

  return {
    get: (key: string) => cacheRef.current.get(key),
    set: (key: string, value: AudioBuffer) => cacheRef.current.set(key, value),
    has: (key: string) => cacheRef.current.has(key),
    clear: () => cacheRef.current.clear(),
  };
}
