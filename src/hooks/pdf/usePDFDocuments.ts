'use client';

import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { indexedDBService, type PDFDocument } from '@/utils/indexedDB';
import { useConfig } from '@/contexts/ConfigContext';

export function usePDFDocuments() {
  const { isDBReady } = useConfig();
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Load documents from IndexedDB when the database is ready
   */
  const loadDocuments = useCallback(async () => {
    if (isDBReady) {
      try {
        const docs = await indexedDBService.getAllDocuments();
        setDocuments(docs);
      } catch (error) {
        console.error('Failed to load documents:', error);
      } finally {
        setIsLoading(false);
      }
    }
  }, [isDBReady]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  /**
   * Adds a new document to IndexedDB
   * 
   * @param {File} file - The PDF file to add
   * @returns {Promise<string>} The ID of the added document
   */
  const addDocument = useCallback(async (file: File): Promise<string> => {
    const id = uuidv4();
    const newDoc: PDFDocument = {
      id,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      data: new Blob([file], { type: file.type }),
    };

    try {
      await indexedDBService.addDocument(newDoc);
      setDocuments((prev) => [...prev, newDoc]);
      return id;
    } catch (error) {
      console.error('Failed to add document:', error);
      throw error;
    }
  }, []);

  /**
   * Removes a document from IndexedDB
   * 
   * @param {string} id - The ID of the document to remove
   */
  const removeDocument = useCallback(async (id: string): Promise<void> => {
    try {
      await indexedDBService.removeDocument(id);
      setDocuments((prev) => prev.filter((doc) => doc.id !== id));
    } catch (error) {
      console.error('Failed to remove document:', error);
      throw error;
    }
  }, []);

  return {
    documents,
    isLoading,
    addDocument,
    removeDocument,
  };
}
