'use client';

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { indexedDBService } from '@/utils/indexedDB';
import type { HTMLDocument } from '@/types/documents';
import { useConfig } from '@/contexts/ConfigContext';

export function useHTMLDocuments() {
  const { isDBReady } = useConfig();
  const [documents, setDocuments] = useState<HTMLDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDocuments = useCallback(async () => {
    if (isDBReady) {
      try {
        const docs = await indexedDBService.getAllHTMLDocuments();
        setDocuments(docs);
      } catch (error) {
        console.error('Failed to load HTML documents:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [isDBReady]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const addDocument = useCallback(async (file: File): Promise<string> => {
    const id = uuidv4();
    const content = await file.text();

    const newDoc: HTMLDocument = {
      id,
      type: 'html',
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      data: content,
    };

    try {
      await indexedDBService.addHTMLDocument(newDoc);
      setDocuments((prev) => [...prev, newDoc]);
      return id;
    } catch (error) {
      console.error('Failed to add HTML document:', error);
      throw error;
    }
  }, []);

  const removeDocument = useCallback(async (id: string): Promise<void> => {
    try {
      await indexedDBService.removeHTMLDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch (error) {
      console.error('Failed to remove HTML document:', error);
      throw error;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (isDBReady) {
      setIsLoading(true);
      try {
        const docs = await indexedDBService.getAllHTMLDocuments();
        setDocuments(docs);
      } catch (error) {
        console.error('Failed to refresh documents:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [isDBReady]);

  const clearDocuments = useCallback(async (): Promise<void> => {
    try {
      await indexedDBService.clearHTMLDocuments();
      setDocuments([]);
    } catch (error) {
      console.error('Failed to clear HTML documents:', error);
      throw error;
    }
  }, []);

  return {
    documents,
    isLoading,
    addDocument,
    removeDocument,
    refresh,
    clearDocuments,
  };
}
