'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { indexedDBService, type PDFDocument } from '@/services/indexedDB';
import { v4 as uuidv4 } from 'uuid';

interface PDFContextType {
  documents: PDFDocument[];
  addDocument: (file: File) => Promise<string>;
  getDocument: (id: string) => Promise<PDFDocument | undefined>;
  removeDocument: (id: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}

const PDFContext = createContext<PDFContextType | undefined>(undefined);

export function PDFProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadDocuments = async () => {
      try {
        setError(null);
        await indexedDBService.init();
        const docs = await indexedDBService.getAllDocuments();
        setDocuments(docs);
      } catch (error) {
        console.error('Failed to load documents:', error);
        setError('Failed to initialize document storage. Please check if your browser supports IndexedDB.');
      } finally {
        setIsLoading(false);
      }
    };

    loadDocuments();
  }, []);

  const addDocument = async (file: File): Promise<string> => {
    setError(null);
    const id = uuidv4();
    const newDoc: PDFDocument = {
      id,
      name: file.name,
      size: file.size,
      lastModified: file.lastModified,
      data: new Blob([file], { type: file.type })
    };

    try {
      await indexedDBService.addDocument(newDoc);
      setDocuments(prev => [...prev, newDoc]);
      return id;
    } catch (error) {
      console.error('Failed to add document:', error);
      setError('Failed to save the document. Please try again.');
      throw error;
    }
  };

  const getDocument = async (id: string): Promise<PDFDocument | undefined> => {
    setError(null);
    try {
      return await indexedDBService.getDocument(id);
    } catch (error) {
      console.error('Failed to get document:', error);
      setError('Failed to retrieve the document. Please try again.');
      return undefined;
    }
  };

  const removeDocument = async (id: string): Promise<void> => {
    setError(null);
    try {
      await indexedDBService.removeDocument(id);
      setDocuments(prev => prev.filter(doc => doc.id !== id));
    } catch (error) {
      console.error('Failed to remove document:', error);
      setError('Failed to remove the document. Please try again.');
      throw error;
    }
  };

  return (
    <PDFContext.Provider value={{ documents, addDocument, getDocument, removeDocument, isLoading, error }}>
      {children}
    </PDFContext.Provider>
  );
}

export function usePDF() {
  const context = useContext(PDFContext);
  if (context === undefined) {
    throw new Error('usePDF must be used within a PDFProvider');
  }
  return context;
}
