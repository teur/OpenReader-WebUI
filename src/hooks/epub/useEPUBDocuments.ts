'use client';

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { indexedDBService } from '@/utils/indexedDB';
import type { EPUBDocument } from '@/types/documents';
import { useConfig } from '@/contexts/ConfigContext';

export function useEPUBDocuments() {
  const { isDBReady } = useConfig();
  const [documents, setDocuments] = useState<EPUBDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDocuments = useCallback(async () => {
    if (isDBReady) {
      try {
        const docs = await indexedDBService.getAllEPUBDocuments();
        setDocuments(docs);
      } catch (error) {
        console.error('Failed to load EPUB documents:', error);
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
    const arrayBuffer = await file.arrayBuffer();
    
    console.log('Original file size:', file.size);
    console.log('ArrayBuffer size:', arrayBuffer.byteLength);
    
    const newDoc: EPUBDocument = {
      id,
      type: 'epub',
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      data: arrayBuffer,
    };

    try {
      await indexedDBService.addEPUBDocument(newDoc);
      setDocuments((prev) => [...prev, newDoc]);
      return id;
    } catch (error) {
      console.error('Failed to add EPUB document:', error);
      throw error;
    }
  }, []);

  const removeDocument = useCallback(async (id: string): Promise<void> => {
    try {
      await indexedDBService.removeEPUBDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch (error) {
      console.error('Failed to remove EPUB document:', error);
      throw error;
    }
  }, []);

  const refresh = useCallback(async () => {
    if (isDBReady) {
      setIsLoading(true);
      try {
        const docs = await indexedDBService.getAllEPUBDocuments();
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
      await indexedDBService.clearEPUBDocuments();
      setDocuments([]);
    } catch (error) {
      console.error('Failed to clear EPUB documents:', error);
      throw error;
    }
  }, []);

  return {
    documents,
    isLoading,
    addDocument,
    removeDocument,
    refresh,
    clearDocuments,  // Add clearDocuments to return value
  };
}
