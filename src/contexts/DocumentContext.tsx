'use client';

import { createContext, useContext, ReactNode } from 'react';
import { usePDFDocuments } from '@/hooks/pdf/usePDFDocuments';
import { useEPUBDocuments } from '@/hooks/epub/useEPUBDocuments';
import { useHTMLDocuments } from '@/hooks/html/useHTMLDocuments';
import { PDFDocument, EPUBDocument, HTMLDocument } from '@/types/documents';

interface DocumentContextType {
  // PDF Documents
  pdfDocs: PDFDocument[];
  addPDFDocument: (file: File) => Promise<string>;
  removePDFDocument: (id: string) => Promise<void>;
  isPDFLoading: boolean;

  // EPUB Documents
  epubDocs: EPUBDocument[];
  addEPUBDocument: (file: File) => Promise<string>;
  removeEPUBDocument: (id: string) => Promise<void>;
  isEPUBLoading: boolean;

  // HTML Documents
  htmlDocs: HTMLDocument[];
  addHTMLDocument: (file: File) => Promise<string>;
  removeHTMLDocument: (id: string) => Promise<void>;
  isHTMLLoading: boolean;

  refreshPDFs: () => Promise<void>;
  refreshEPUBs: () => Promise<void>;
  refreshHTML: () => Promise<void>;

  clearPDFs: () => Promise<void>;
  clearEPUBs: () => Promise<void>;
  clearHTML: () => Promise<void>;
}

const DocumentContext = createContext<DocumentContextType | undefined>(undefined);

export function DocumentProvider({ children }: { children: ReactNode }) {
  const {
    documents: pdfDocs,
    addDocument: addPDFDocument,
    removeDocument: removePDFDocument,
    isLoading: isPDFLoading,
    refresh: refreshPDFs,
    clearDocuments: clearPDFs
  } = usePDFDocuments();

  const {
    documents: epubDocs,
    addDocument: addEPUBDocument,
    removeDocument: removeEPUBDocument,
    isLoading: isEPUBLoading,
    refresh: refreshEPUBs,
    clearDocuments: clearEPUBs
  } = useEPUBDocuments();

  const {
    documents: htmlDocs,
    addDocument: addHTMLDocument,
    removeDocument: removeHTMLDocument,
    isLoading: isHTMLLoading,
    refresh: refreshHTML,
    clearDocuments: clearHTML
  } = useHTMLDocuments();

  return (
    <DocumentContext.Provider value={{
      pdfDocs,
      addPDFDocument,
      removePDFDocument,
      isPDFLoading,
      epubDocs,
      addEPUBDocument,
      removeEPUBDocument,
      isEPUBLoading,
      htmlDocs,
      addHTMLDocument,
      removeHTMLDocument,
      isHTMLLoading,
      refreshPDFs,
      refreshEPUBs,
      refreshHTML,
      clearPDFs,
      clearEPUBs,
      clearHTML
    }}>
      {children}
    </DocumentContext.Provider>
  );
}

export function useDocuments() {
  const context = useContext(DocumentContext);
  if (context === undefined) {
    throw new Error('useDocuments must be used within a DocumentProvider');
  }
  return context;
}
