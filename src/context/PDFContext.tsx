'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface PDFDocument {
  id: string;
  name: string;
  size: number;
  lastModified: number;
  data: string; // Base64 encoded file data
}

interface PDFContextType {
  documents: PDFDocument[];
  addDocument: (file: File) => Promise<string>;
  getDocument: (id: string) => PDFDocument | undefined;
  removeDocument: (id: string) => void;
}

const PDFContext = createContext<PDFContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'pdf-documents';

export function PDFProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<PDFDocument[]>([]);

  // Load documents from local storage on mount
  useEffect(() => {
    const storedDocs = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedDocs) {
      setDocuments(JSON.parse(storedDocs));
    }
  }, []);

  // Save documents to local storage whenever they change
  useEffect(() => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(documents));
  }, [documents]);

  const addDocument = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result as string;
        const newDoc: PDFDocument = {
          id: `${file.name}-${Date.now()}`,
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          data: base64Data
        };
        
        setDocuments(prev => [...prev, newDoc]);
        resolve(newDoc.id);
      };
      reader.readAsDataURL(file);
    });
  };

  const getDocument = (id: string) => {
    return documents.find(doc => doc.id === id);
  };

  const removeDocument = (id: string) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  return (
    <PDFContext.Provider value={{ documents, addDocument, getDocument, removeDocument }}>
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
