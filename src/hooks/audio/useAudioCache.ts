'use client';

import { useRef } from 'react';
import { LRUCache } from 'lru-cache';

/**
 * Custom hook for managing audio cache using LRU strategy
 * @param maxSize Maximum number of items to store in cache
 * @returns Object containing cache methods
 */
export function useAudioCache(maxSize = 50) {
  const cacheRef = useRef(new LRUCache<string, ArrayBuffer>({ max: maxSize }));

  return {
    get: (key: string) => cacheRef.current.get(key),
    set: (key: string, value: ArrayBuffer) => cacheRef.current.set(key, value),
    delete: (key: string) => cacheRef.current.delete(key),
    has: (key: string) => cacheRef.current.has(key),
    clear: () => cacheRef.current.clear(),
  };
}
