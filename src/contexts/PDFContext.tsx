'use client';

import { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { indexedDBService, type PDFDocument } from '@/services/indexedDB';
import { v4 as uuidv4 } from 'uuid';
import { pdfjs } from 'react-pdf';
import stringSimilarity from 'string-similarity';
import nlp from 'compromise';

// Set worker from public directory
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';

interface PDFContextType {
  documents: PDFDocument[];
  addDocument: (file: File) => Promise<string>;
  getDocument: (id: string) => Promise<PDFDocument | undefined>;
  removeDocument: (id: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  extractTextFromPDF: (pdfData: Blob) => Promise<string>;
  highlightPattern: (text: string, pattern: string, containerRef: React.RefObject<HTMLDivElement>) => void;
  clearHighlights: () => void;
  handleTextClick: (event: MouseEvent, pdfText: string, containerRef: React.RefObject<HTMLDivElement>, stopAndPlayFromIndex: (index: number) => void) => void;
}

const PDFContext = createContext<PDFContextType | undefined>(undefined);

export function PDFProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<PDFDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    /*
     * Initializes the PDF document storage and loads existing documents.
     * Sets up IndexedDB and retrieves all stored documents on component mount.
     * Handles errors if IndexedDB initialization fails.
     * 
     * Dependencies:
     * - Empty array: Only runs once on mount as initialization should only happen once
     */
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
      data: new Blob([file], { type: file.type }),
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

  const extractTextFromPDF = useCallback(async (pdfData: Blob): Promise<string> => {
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(pdfData);
      });

      const base64Data = dataUrl.split(',')[1];
      const binaryData = atob(base64Data);
      const length = binaryData.length;
      const bytes = new Uint8Array(length);
      for (let i = 0; i < length; i++) {
        bytes[i] = binaryData.charCodeAt(i);
      }

      const loadingTask = pdfjs.getDocument({
        data: bytes,
        disableAutoFetch: true,
        disableStream: false,
      });

      const pdf = await loadingTask.promise;
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + ' ';
      }

      return fullText;
    } catch (error) {
      console.error('Error extracting text from PDF:', error);
      throw new Error('Failed to extract text from PDF');
    }
  }, []);

  const clearHighlights = useCallback(() => {
    const textNodes = document.querySelectorAll('.react-pdf__Page__textContent span');
    textNodes.forEach((node) => {
      const element = node as HTMLElement;
      element.style.backgroundColor = '';
      element.style.opacity = '1';
    });
  }, []);

  const highlightPattern = useCallback((text: string, pattern: string, containerRef: React.RefObject<HTMLDivElement>) => {
    clearHighlights();

    if (!pattern?.trim()) {
      return;
    }

    const cleanPattern = pattern.trim().replace(/\s+/g, ' ');
    const patternLength = cleanPattern.length;

    const container = containerRef.current;
    if (!container) return;

    const textNodes = container.querySelectorAll('.react-pdf__Page__textContent span');
    const allText = Array.from(textNodes).map(node => ({
      element: node as HTMLElement,
      text: (node.textContent || '').trim(),
    })).filter(node => node.text.length > 0);

    let bestMatch = {
      elements: [] as HTMLElement[],
      rating: 0,
      text: '',
      lengthDiff: Infinity,
    };

    for (let i = 0; i < allText.length; i++) {
      let combinedText = '';
      let currentElements = [];
      for (let j = i; j < Math.min(i + 10, allText.length); j++) {
        const node = allText[j];
        const newText = combinedText + (combinedText ? ' ' : '') + node.text;
        if (newText.length > patternLength * 2) {
          break;
        }

        combinedText = newText;
        currentElements.push(node.element);

        const similarity = stringSimilarity.compareTwoStrings(cleanPattern, combinedText);
        const lengthDiff = Math.abs(combinedText.length - patternLength);
        const lengthPenalty = lengthDiff / patternLength;
        const adjustedRating = similarity * (1 - lengthPenalty * 0.5);

        if (adjustedRating > bestMatch.rating) {
          bestMatch = {
            elements: [...currentElements],
            rating: adjustedRating,
            text: combinedText,
            lengthDiff,
          };
        }
      }
    }

    const similarityThreshold = bestMatch.lengthDiff < patternLength * 0.3 ? 0.3 : 0.5;
    if (bestMatch.rating >= similarityThreshold) {
      bestMatch.elements.forEach(element => {
        element.style.backgroundColor = 'grey';
        element.style.opacity = '0.4';
      });

      if (bestMatch.elements.length > 0) {
        setTimeout(() => {
          const element = bestMatch.elements[0];
          const container = containerRef.current;
          if (!container || !element) return;

          const containerRect = container.getBoundingClientRect();
          const elementRect = element.getBoundingClientRect();
          container.scrollTo({
            top: container.scrollTop + (elementRect.top - containerRect.top) - containerRect.height / 2,
            behavior: 'smooth',
          });
        }, 100);
      }
    }
  }, [clearHighlights]);

  const handleTextClick = useCallback((event: MouseEvent, pdfText: string, containerRef: React.RefObject<HTMLDivElement>, stopAndPlayFromIndex: (index: number) => void) => {
    const target = event.target as HTMLElement;
    if (!target.matches('.react-pdf__Page__textContent span')) return;

    const parentElement = target.closest('.react-pdf__Page__textContent');
    if (!parentElement) return;

    const spans = Array.from(parentElement.querySelectorAll('span'));
    const clickedIndex = spans.indexOf(target);
    const contextWindow = 3;
    const startIndex = Math.max(0, clickedIndex - contextWindow);
    const endIndex = Math.min(spans.length - 1, clickedIndex + contextWindow);
    const contextText = spans
      .slice(startIndex, endIndex + 1)
      .map(span => span.textContent)
      .join(' ')
      .trim();

    if (!contextText?.trim()) return;

    const cleanContext = contextText.trim().replace(/\s+/g, ' ');
    const contextLength = cleanContext.length;

    const allText = Array.from(parentElement.querySelectorAll('span')).map(node => ({
      element: node as HTMLElement,
      text: (node.textContent || '').trim(),
    })).filter(node => node.text.length > 0);

    let bestMatch = {
      elements: [] as HTMLElement[],
      rating: 0,
      text: '',
      lengthDiff: Infinity,
    };

    for (let i = 0; i < allText.length; i++) {
      let combinedText = '';
      let currentElements = [];
      for (let j = i; j < Math.min(i + 10, allText.length); j++) {
        const node = allText[j];
        const newText = combinedText + (combinedText ? ' ' : '') + node.text;
        if (newText.length > contextLength * 2) {
          break;
        }

        combinedText = newText;
        currentElements.push(node.element);

        const similarity = stringSimilarity.compareTwoStrings(cleanContext, combinedText);
        const lengthDiff = Math.abs(combinedText.length - contextLength);
        const lengthPenalty = lengthDiff / contextLength;
        const adjustedRating = similarity * (1 - lengthPenalty * 0.5);

        if (adjustedRating > bestMatch.rating) {
          bestMatch = {
            elements: [...currentElements],
            rating: adjustedRating,
            text: combinedText,
            lengthDiff,
          };
        }
      }
    }

    const similarityThreshold = bestMatch.lengthDiff < contextLength * 0.3 ? 0.3 : 0.5;
    if (bestMatch.rating >= similarityThreshold) {
      const matchText = bestMatch.text;
      const sentences = nlp(pdfText).sentences().out('array') as string[];
      let bestSentenceMatch = {
        sentence: '',
        rating: 0,
      };

      for (const sentence of sentences) {
        const rating = stringSimilarity.compareTwoStrings(matchText, sentence);
        if (rating > bestSentenceMatch.rating) {
          bestSentenceMatch = { sentence, rating };
        }
      }

      if (bestSentenceMatch.rating >= 0.5) {
        const sentenceIndex = sentences.findIndex(sentence => sentence === bestSentenceMatch.sentence);
        if (sentenceIndex !== -1) {
          stopAndPlayFromIndex(sentenceIndex);
          highlightPattern(pdfText, bestSentenceMatch.sentence, containerRef);
        }
      }
    }
  }, [highlightPattern]);

  return (
    <PDFContext.Provider value={{ documents, addDocument, getDocument, removeDocument, isLoading, error, extractTextFromPDF, highlightPattern, clearHighlights, handleTextClick }}>
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